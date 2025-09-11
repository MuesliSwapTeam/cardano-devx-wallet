import { handleCip30Messages } from './cip30';
import { handleWalletMessages } from './wallet';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    // Try CIP-30 handlers first
    const cip30Handled = await handleCip30Messages(message, sender, sendResponse);
    if (cip30Handled) return;

    // Try wallet handlers next
    const walletHandled = await handleWalletMessages(message, sender, sendResponse);
    if (walletHandled) return;

    // If no handler processed the message, send an error response
    console.warn(`Unknown message type: ${message.type}`);
    sendResponse({
      success: false,
      error: `Unknown message type: ${message.type}`,
    });
  })();

  return true; // Indicates an async response
});
