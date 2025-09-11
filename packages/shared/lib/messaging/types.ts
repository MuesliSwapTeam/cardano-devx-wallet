/**
 * Global type definitions and interfaces used by the messaging system.
 */

export interface IMessage {
  method?: string;
  data?: unknown;
  error?: unknown;
  sender?: string;
  target?: string;
  id?: string;
  origin?: string;
  event?: string;
  tabId?: number;
  [key: string]: unknown;
}

export type MethodCallback = (request: IMessage, sendResponse: (response: unknown) => void) => void;

export interface IWhitelistedResponse {
  error?: string;
  [key: string]: unknown;
}
