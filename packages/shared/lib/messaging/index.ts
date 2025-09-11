import { METHOD, SENDER, TARGET, APIError } from '../config/messaging';
import { HANDLERS } from './handlers';
import type { IMessage, MethodCallback, IWhitelistedResponse } from './types';

/**
 * InternalController
 *
 * Manages a persistent Port connection to communicate with a popup while it’s open.
 */
class InternalController {
  private port: chrome.runtime.Port;
  private tabId: Promise<number>;

  constructor() {
    // Create a named connection for the popup <-> background communication
    this.port = chrome.runtime.connect({
      name: 'internal-background-popup-communication',
    });

    // Retrieve the current tab ID (in background context, may be null if not a tab)
    this.tabId = new Promise<number>((resolve, reject) => {
      chrome.tabs.getCurrent(tab => {
        if (!tab || tab.id === undefined) {
          reject(new Error('No active tab found.'));
        } else {
          resolve(tab.id);
        }
      });
    });
  }

  /**
   * Request data from the popup.
   * Waits for a single message response, then resolves.
   */
  public requestData = (): Promise<unknown> => {
    return new Promise(async (resolve, _reject) => {
      // Refresh tabId if needed
      this.tabId = new Promise<number>((_resolve, _reject) => {
        chrome.tabs.getCurrent(tab => {
          if (!tab || tab.id === undefined) {
            _reject(new Error('No active tab found.'));
          } else {
            _resolve(tab.id);
          }
        });
      });

      const tabId = await this.tabId;

      const messageHandler = (response: unknown) => {
        // Remove this listener immediately after receiving the response
        this.port.onMessage.removeListener(messageHandler);
        resolve(response);
      };

      // Wait for a single response
      this.port.onMessage.addListener(messageHandler);

      // Send a request to the popup
      this.port.postMessage({
        tabId,
        method: METHOD.requestData,
      });
    });
  };

  /**
   * Return data back to the popup by posting a message on the Port.
   */
  public returnData = async ({ data, error }: { data?: unknown; error?: unknown }): Promise<void> => {
    const tabId = await this.tabId;
    this.port.postMessage({
      data,
      error,
      method: METHOD.returnData,
      tabId,
    });
  };
}

/**
 * BackgroundController
 *
 * Manages a list of “methods” (callbacks) that can be called
 * when a message arrives from the webpage context.
 */
class BackgroundController {
  // Map from method name to callback
  private _methodList: Record<string, MethodCallback>;

  constructor() {
    this._methodList = HANDLERS;
  }

  /**
   * Start listening for messages in the background.
   * If the sender is the webpage, call the corresponding method handler.
   */
  public listen = (): void => {
    chrome.runtime.onMessage.addListener((request: IMessage, _sender, sendResponse) => {
      if (request.sender === SENDER.webpage && request.method) {
        const handler = this._methodList[request.method];
        if (handler) {
          handler(request, sendResponse);
        }
      }
      // Indicate an asynchronous sendResponse
      return true;
    });
  };
}

/**
 * Messaging
 *
 * Provides static/utility-like functions to message between:
 * - Webpage <-> Background
 * - Webpage <-> Content script
 * - Tab <-> Popup (internal)
 * - Controllers
 */
export const Messaging = {
  /**
   * Sends a message to the background script.
   */
  sendToBackground: async function (request: Record<string, unknown>): Promise<unknown> {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ ...request, target: TARGET, sender: SENDER.webpage }, (response: unknown) => {
        resolve(response);
      });
    });
  },

  /**
   * Sends a message to the content script via window.postMessage.
   * Listens for a matching response with the same requestId.
   */
  sendToContent: function ({ method, data }: { method: string; data: unknown }): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(2, 9);

      function responseHandler(e: MessageEvent) {
        const response = e.data as IMessage;

        if (
          typeof response !== 'object' ||
          response === null ||
          response.target !== TARGET ||
          response.id !== requestId ||
          response.sender !== SENDER.extension
        ) {
          return;
        }

        window.removeEventListener('message', responseHandler);

        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      }

      window.addEventListener('message', responseHandler);

      window.postMessage(
        {
          method,
          data,
          target: TARGET,
          sender: SENDER.webpage,
          id: requestId,
        },
        window.origin,
      );
    });
  },

  /**
   * Sends a message to the popup by listening for an onConnect event from the popup,
   * then passing data back and forth (if needed).
   */
  sendToPopupInternal: function (tab: chrome.tabs.Tab, request: Record<string, unknown>): Promise<unknown> {
    return new Promise(resolve => {
      function connectionHandler(port: chrome.runtime.Port) {
        function messageHandler(response: IMessage) {
          if (response.tabId !== tab.id) return;

          if (response.method === METHOD.requestData) {
            // If the popup asks for data, post it
            port.postMessage(request);
          } else if (response.method === METHOD.returnData) {
            // Resolve once we get the data back
            resolve(response);
          }

          // Listen for tab removal
          chrome.tabs.onRemoved.addListener(function tabsHandler(removedTabId) {
            if (removedTabId !== tab.id) return;
            resolve({
              target: TARGET,
              sender: SENDER.extension,
              error: APIError.Refused,
            });
            chrome.runtime.onConnect.removeListener(connectionHandler);
            port.onMessage.removeListener(messageHandler);
            chrome.tabs.onRemoved.removeListener(tabsHandler);
          });
        }

        port.onMessage.addListener(messageHandler);
      }

      chrome.runtime.onConnect.addListener(connectionHandler);
    });
  },

  /**
   * Creates a new InternalController instance.
   */
  createInternalController: (): InternalController => {
    return new InternalController();
  },

  /**
   * Creates a proxy controller on the webpage side that:
   *   1. Listens for messages from the background and re-dispatches them as custom DOM events.
   *   2. Listens for certain messages from the webpage and forwards them to the background
   *      only if the origin is whitelisted.
   */
  createProxyController: (): void => {
    // Listen to events from the background
    chrome.runtime.onMessage.addListener(async (response: IMessage) => {
      if (
        typeof response !== 'object' ||
        response === null ||
        response.target !== TARGET ||
        response.sender !== SENDER.extension ||
        !response.event
      ) {
        return;
      }

      // Check if the origin is whitelisted
      const whitelisted = (await Messaging.sendToBackground({
        method: METHOD.isWhitelisted,
        origin: window.origin,
      })) as IWhitelistedResponse;

      if (!whitelisted || whitelisted.error) return;

      const event = new CustomEvent(`${TARGET}${response.event}`, {
        detail: response.data,
      });

      window.dispatchEvent(event);
    });

    // Listen to function calls from the webpage
    window.addEventListener('message', async (e: MessageEvent) => {
      const request = e.data as IMessage;

      if (
        typeof request !== 'object' ||
        request === null ||
        request.target !== TARGET ||
        request.sender !== SENDER.webpage
      ) {
        return;
      }

      request.origin = window.origin;

      // Only allow certain methods before checking whitelist
      if (request.method === METHOD.enable || request.method === METHOD.isEnabled) {
        Messaging.sendToBackground({ ...request }).then(response => {
          window.postMessage(response, window.origin);
        });
        return;
      }

      // Otherwise, check if user is whitelisted
      const whitelisted = (await Messaging.sendToBackground({
        method: METHOD.isWhitelisted,
        origin: window.origin,
      })) as IWhitelistedResponse;

      if (!whitelisted || whitelisted.error) {
        window.postMessage({ ...whitelisted, id: request.id }, window.origin);
        return;
      }

      // Forward request to background once whitelisted
      Messaging.sendToBackground(request).then(response => {
        window.postMessage(response, window.origin);
      });
    });
  },

  /**
   * Creates a new BackgroundController instance.
   */
  createBackgroundController: (): BackgroundController => {
    return new BackgroundController();
  },
};
