// Consolidated storage using single IndexedDB with multiple stores
import type { Wallet } from '@extension/shared';
import type { UTXO, TransactionRecord } from './transactionsStorage';

// Store names
const STORE_NAMES = {
  SETTINGS: 'settings',
  WALLETS: 'wallets',
  TRANSACTIONS: 'transactions',
  UTXOS: 'utxos',
} as const;

// Data types
export type Theme = 'light' | 'dark';
export type Network = 'Mainnet' | 'Preprod';

export interface AppSettings {
  theme: Theme;
  onboarded: boolean;
  legalAccepted?: boolean;
  mainnetApiKey?: string;
  preprodApiKey?: string;
  activeWalletId?: string | null;
}

export interface UTXORecord extends UTXO {
  walletId: string;
  lastSynced: number;
}

export interface WalletMetadata {
  lastFullSync: number;
}

// Database configuration
const DB_NAME = 'cardano-wallet';
const DB_VERSION = 1;

// Default values
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  onboarded: false,
  legalAccepted: false,
  mainnetApiKey: '',
  preprodApiKey: '',
  activeWalletId: null,
};

class ConsolidatedStorage {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) {
          db.createObjectStore(STORE_NAMES.SETTINGS);
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.WALLETS)) {
          const walletsStore = db.createObjectStore(STORE_NAMES.WALLETS, { keyPath: 'id' });
          walletsStore.createIndex('network', 'network', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORE_NAMES.TRANSACTIONS, { keyPath: 'hash' });
          txStore.createIndex('walletId', 'walletId', { unique: false });
          txStore.createIndex('block_time', 'block_time', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.UTXOS)) {
          const utxoStore = db.createObjectStore(STORE_NAMES.UTXOS, {
            keyPath: ['tx_hash', 'output_index'],
          });
          utxoStore.createIndex('walletId', 'walletId', { unique: false });
          utxoStore.createIndex('tx_hash', 'tx_hash', { unique: false });
          utxoStore.createIndex('walletId_tx_hash', ['walletId', 'tx_hash'], { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  // Settings methods
  async getSettings(): Promise<AppSettings> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.SETTINGS);
      const request = store.get('app-settings');

      request.onsuccess = () => {
        resolve(request.result || DEFAULT_SETTINGS);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.SETTINGS);
      const request = store.put(settings, 'app-settings');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Wallet methods
  async getWallets(): Promise<Wallet[]> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.WALLETS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.WALLETS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addWallet(wallet: Wallet): Promise<void> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.WALLETS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.WALLETS);
      const request = store.add(wallet);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateWallet(walletId: string, updates: Partial<Wallet>): Promise<void> {
    const db = await this.getDatabase();
    return new Promise(async (resolve, reject) => {
      try {
        const wallets = await this.getWallets();
        const walletIndex = wallets.findIndex(w => w.id === walletId);

        if (walletIndex === -1) {
          reject(new Error(`Wallet not found: ${walletId}`));
          return;
        }

        const updatedWallet = { ...wallets[walletIndex], ...updates };

        const transaction = db.transaction([STORE_NAMES.WALLETS], 'readwrite');
        const store = transaction.objectStore(STORE_NAMES.WALLETS);
        const request = store.put(updatedWallet);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async removeWallet(walletId: string): Promise<void> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_NAMES.WALLETS, STORE_NAMES.TRANSACTIONS, STORE_NAMES.UTXOS],
        'readwrite',
      );

      // Remove wallet
      const walletsStore = transaction.objectStore(STORE_NAMES.WALLETS);
      walletsStore.delete(walletId);

      // Remove associated transactions
      const txStore = transaction.objectStore(STORE_NAMES.TRANSACTIONS);
      const txIndex = txStore.index('walletId');
      txIndex.openCursor(IDBKeyRange.only(walletId)).onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Remove associated UTXOs
      const utxoStore = transaction.objectStore(STORE_NAMES.UTXOS);
      const utxoIndex = utxoStore.index('walletId');
      utxoIndex.openCursor(IDBKeyRange.only(walletId)).onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Transaction methods
  async getWalletTransactions(walletId: string): Promise<TransactionRecord[]> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.TRANSACTIONS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.TRANSACTIONS);
      const index = store.index('walletId');
      const request = index.getAll(walletId);

      request.onsuccess = () => {
        const transactions = request.result || [];
        transactions.sort((a, b) => b.block_time - a.block_time);
        resolve(transactions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async storeTransactions(walletId: string, transactions: TransactionRecord[]): Promise<void> {
    const db = await this.getDatabase();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.TRANSACTIONS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.TRANSACTIONS);

      const requests = transactions.map(tx => {
        const record: TransactionRecord = {
          ...tx,
          walletId,
          lastSynced: now,
        };
        return store.put(record);
      });

      let completed = 0;
      requests.forEach(request => {
        request.onsuccess = () => {
          completed++;
          if (completed === requests.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });

      if (requests.length === 0) resolve();
    });
  }

  // UTXO methods
  async getWalletUTXOs(walletId: string): Promise<UTXORecord[]> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.UTXOS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.UTXOS);
      const index = store.index('walletId');
      const request = index.getAll(walletId);

      request.onsuccess = () => {
        const utxos = request.result || [];
        utxos.sort((a, b) => b.tx_hash.localeCompare(a.tx_hash));
        resolve(utxos);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getWalletUnspentUTXOs(walletId: string): Promise<UTXORecord[]> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.UTXOS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.UTXOS);
      const index = store.index('walletId');
      const request = index.getAll(walletId);

      request.onsuccess = () => {
        const allUtxos = request.result || [];
        const unspentUtxos = allUtxos.filter(utxo => !utxo.isSpent);
        unspentUtxos.sort((a, b) => b.tx_hash.localeCompare(a.tx_hash));
        resolve(unspentUtxos);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async storeUTXOs(walletId: string, utxos: UTXO[]): Promise<void> {
    const db = await this.getDatabase();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.UTXOS], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.UTXOS);

      const requests = utxos.map(utxo => {
        const record: UTXORecord = {
          ...utxo,
          walletId,
          lastSynced: now,
        };
        return store.put(record);
      });

      let completed = 0;
      requests.forEach(request => {
        request.onsuccess = () => {
          completed++;
          if (completed === requests.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });

      if (requests.length === 0) resolve();
    });
  }

  async getUTXO(txHash: string, outputIndex: number): Promise<UTXORecord | null> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.UTXOS], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.UTXOS);
      const request = store.get([txHash, outputIndex]);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Statistics
  async getStats(): Promise<{
    totalTransactions: number;
    totalUTXOs: number;
    walletCounts: Record<string, { transactions: number; utxos: number; unspentUTXOs: number }>;
  }> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAMES.TRANSACTIONS, STORE_NAMES.UTXOS], 'readonly');
      const txStore = transaction.objectStore(STORE_NAMES.TRANSACTIONS);
      const utxoStore = transaction.objectStore(STORE_NAMES.UTXOS);

      const stats = {
        totalTransactions: 0,
        totalUTXOs: 0,
        walletCounts: {} as Record<string, { transactions: number; utxos: number; unspentUTXOs: number }>,
      };

      // Count transactions
      const txCountRequest = txStore.count();
      txCountRequest.onsuccess = () => {
        stats.totalTransactions = txCountRequest.result;
      };

      // Count UTXOs
      const utxoCountRequest = utxoStore.count();
      utxoCountRequest.onsuccess = () => {
        stats.totalUTXOs = utxoCountRequest.result;
      };

      // Get wallet-specific counts
      Promise.all([
        new Promise<void>(resolve => {
          const txRequest = txStore.getAll();
          txRequest.onsuccess = () => {
            const transactions = txRequest.result;
            transactions.forEach(tx => {
              if (!stats.walletCounts[tx.walletId]) {
                stats.walletCounts[tx.walletId] = { transactions: 0, utxos: 0, unspentUTXOs: 0 };
              }
              stats.walletCounts[tx.walletId].transactions++;
            });
            resolve();
          };
        }),
        new Promise<void>(resolve => {
          const utxoRequest = utxoStore.getAll();
          utxoRequest.onsuccess = () => {
            const utxos = utxoRequest.result;
            utxos.forEach(utxo => {
              if (!stats.walletCounts[utxo.walletId]) {
                stats.walletCounts[utxo.walletId] = { transactions: 0, utxos: 0, unspentUTXOs: 0 };
              }
              stats.walletCounts[utxo.walletId].utxos++;
              if (!utxo.isSpent) {
                stats.walletCounts[utxo.walletId].unspentUTXOs++;
              }
            });
            resolve();
          };
        }),
      ]).then(() => resolve(stats));

      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Export singleton instance
export const consolidatedStorage = new ConsolidatedStorage();
