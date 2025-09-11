// packages/storage/lib/impl/walletsStorage.ts

import { createIndexedDBStorage } from '../base/indexeddb';
import type { BaseStorage } from '../base/types';
import type { Wallet } from '@extension/shared';
import { settingsStorage } from './settingsStorage';

// Define the shape of our wallets data structure (just wallets array now)
interface WalletsData {
  wallets: Wallet[];
}

// Define the shape of our custom storage object, including our new methods
type WalletsStorage = BaseStorage<WalletsData> & {
  addWallet: (newWallet: Wallet) => Promise<void>;
  removeWallet: (walletId: string) => Promise<void>;
  updateWallet: (walletId: string, updatedFields: Partial<Wallet>) => Promise<void>;
  getActiveWallet: () => Promise<Wallet | null>;
  setActiveWallet: (walletId: string | null) => Promise<void>;
  getWallets: () => Promise<Wallet[]>; // Helper to get just the wallets array
};

// Create the IndexedDB storage instance for wallets data
const storage = createIndexedDBStorage<WalletsData>(
  'cardano-wallet-db', // Database name
  'wallets', // Store name
  { wallets: [] }, // Default value (no activeWalletId anymore)
);

// Export the final object, combining the base storage with our custom methods
export const walletsStorage: WalletsStorage = {
  ...storage,

  /**
   * Helper method to get just the wallets array
   */
  getWallets: async (): Promise<Wallet[]> => {
    const data = await storage.get();
    return data.wallets;
  },

  /**
   * Adds a new wallet to the list using an immutable update.
   */
  addWallet: async (newWallet: Wallet) => {
    await storage.set(data => {
      // Ensure data has the correct structure with safe defaults
      const currentData = data || { wallets: [] };
      const currentWallets = Array.isArray(currentData.wallets) ? currentData.wallets : [];

      return {
        wallets: [...currentWallets, newWallet],
      };
    });

    // If this is the first wallet being added, automatically set it as active
    const activeWalletId = await settingsStorage.getActiveWalletId();
    if (!activeWalletId) {
      await settingsStorage.setActiveWalletId(newWallet.id);
    }
  },

  /**
   * Removes a wallet from the list by its unique ID.
   */
  removeWallet: async (walletId: string) => {
    await storage.set(data => {
      const newWallets = data.wallets.filter(w => w.id !== walletId);
      return {
        wallets: newWallets,
      };
    });

    // If we removed the active wallet, clear it
    const activeWalletId = await settingsStorage.getActiveWalletId();
    if (activeWalletId === walletId) {
      await settingsStorage.setActiveWalletId(null);
    }
  },

  /**
   * Finds a wallet by its ID and updates one or more of its properties.
   */
  updateWallet: async (walletId: string, updatedFields: Partial<Wallet>) => {
    await storage.set(data => ({
      wallets: data.wallets.map(w => (w.id === walletId ? { ...w, ...updatedFields } : w)),
    }));
  },

  /**
   * Gets the currently active wallet.
   * Returns null if no wallet is set as active or if the active wallet no longer exists.
   */
  getActiveWallet: async (): Promise<Wallet | null> => {
    const activeWalletId = await settingsStorage.getActiveWalletId();
    if (!activeWalletId) {
      return null;
    }

    const data = await storage.get();
    const activeWallet = data.wallets.find(w => w.id === activeWalletId);

    // If the active wallet ID exists but the wallet was deleted, clear the active wallet
    if (!activeWallet) {
      await settingsStorage.setActiveWalletId(null);
      return null;
    }

    return activeWallet;
  },

  /**
   * Sets the active wallet by ID.
   * Pass null to clear the active wallet.
   * The wallet ID must exist in the wallets list, or an error will be thrown.
   */
  setActiveWallet: async (walletId: string | null): Promise<void> => {
    if (walletId === null) {
      await settingsStorage.setActiveWalletId(null);
      return;
    }

    // Verify the wallet exists before setting it as active
    const data = await storage.get();
    const wallet = data.wallets.find(w => w.id === walletId);
    if (!wallet) {
      throw new Error(`Cannot set active wallet: wallet with ID "${walletId}" not found`);
    }

    await settingsStorage.setActiveWalletId(walletId);
  },
};
