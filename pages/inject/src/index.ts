import { createDevXCIP30Provider } from './cip30-provider';

declare global {
  interface Window {
    cardano: {
      [name: string]: any;
    };
  }
}

console.log('DevX Wallet: Injecting CIP-30 provider...');
console.log('runtime exists:', !!chrome.runtime);
// Inject DevX CIP-30 compliant wallet provider
window.cardano = {
  ...(window.cardano || {}),
  devx: createDevXCIP30Provider(),
};

console.log('DevX Wallet: CIP-30 provider injected successfully');

export {};
