import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

// --- Define the types for our settings ---
export type Theme = 'light' | 'dark';
export type Network = 'Mainnet' | 'Preprod';

// This is the new, unified shape for all app settings.
export interface AppSettings {
  theme: Theme;
  onboarded: boolean;
  legalAccepted?: boolean;
  mainnetApiKey?: string;
  preprodApiKey?: string;
  activeWalletId?: string | null;
  lastSyncBlock?: Record<string, number>; // walletId -> block height
}

// Define the default state for a first-time user.
const defaultSettings: AppSettings = {
  theme: 'dark',
  onboarded: false,
  legalAccepted: false,
  mainnetApiKey: '',
  preprodApiKey: '',
  activeWalletId: null,
  lastSyncBlock: {},
};

// --- Define the custom methods for our new storage object ---
export interface SettingsStorage extends BaseStorage<AppSettings> {
  toggleTheme: () => Promise<void>;
  markOnboarded: () => Promise<void>;
  unmarkOnboarded: () => Promise<void>;
  markLegalAccepted: () => Promise<void>;
  setMainnetApiKey: (apiKey: string) => Promise<void>;
  setPreprodApiKey: (apiKey: string) => Promise<void>;
  setActiveWalletId: (walletId: string | null) => Promise<void>;
  getActiveWalletId: () => Promise<string | null>;
}

// Create the base storage instance using the factory from base.ts.
const storage = createStorage<AppSettings>('app-settings-key', defaultSettings, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

// --- Export the final, complete storage object ---
export const settingsStorage: SettingsStorage = {
  // Include all the base methods (get, set, subscribe, getSnapshot)
  ...storage,

  toggleTheme: async () => {
    await storage.set(settings => ({
      ...settings,
      theme: settings.theme === 'light' ? 'dark' : 'light',
    }));
  },

  markOnboarded: async () => {
    await storage.set(settings => ({
      ...settings,
      onboarded: true,
    }));
  },

  unmarkOnboarded: async () => {
    await storage.set(settings => ({
      ...settings,
      onboarded: false,
    }));
  },

  /** Marks that the user has accepted the legal terms. */
  markLegalAccepted: async () => {
    await storage.set(settings => ({
      ...settings,
      legalAccepted: true,
    }));
  },

  /** Sets the Mainnet Blockfrost API key. */
  setMainnetApiKey: async (apiKey: string) => {
    await storage.set(settings => ({
      ...settings,
      mainnetApiKey: apiKey,
    }));
  },

  /** Sets the Preprod Blockfrost API key. */
  setPreprodApiKey: async (apiKey: string) => {
    await storage.set(settings => ({
      ...settings,
      preprodApiKey: apiKey,
    }));
  },

  /** Sets the active wallet ID. */
  setActiveWalletId: async (walletId: string | null) => {
    await storage.set(settings => ({
      ...settings,
      activeWalletId: walletId,
    }));
  },

  /** Gets the active wallet ID. */
  getActiveWalletId: async (): Promise<string | null> => {
    const settings = await storage.get();
    return settings.activeWalletId || null;
  },
};
