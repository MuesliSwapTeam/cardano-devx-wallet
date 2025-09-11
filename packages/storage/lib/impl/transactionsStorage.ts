import { createIndexedDBStorage } from '../base/indexeddb';

// Local type definitions to avoid circular imports
export interface BlockfrostAmount {
  unit: string;
  quantity: string;
}

export interface TransactionInput {
  address: string;
  amount: BlockfrostAmount[];
  tx_hash: string;
  output_index: number;
}

export interface TransactionOutput {
  address: string;
  amount: BlockfrostAmount[];
  output_index: number;
  data_hash?: string | null;
  inline_datum?: string | null;
  reference_script_hash?: string | null;
}

export interface Transaction {
  hash: string;
  block: string;
  block_height: number;
  block_time: number;
  slot: number;
  index: number;
  output_amount: BlockfrostAmount[];
  fees: string;
  deposit: string;
  size: number;
  invalid_before: string | null;
  invalid_hereafter: string | null;
  utxo_count: number;
  withdrawal_count: number;
  mir_cert_count: number;
  delegation_count: number;
  stake_cert_count: number;
  pool_update_count: number;
  pool_retire_count: number;
  asset_mint_or_burn_count: number;
  redeemer_count: number;
  valid_contract: boolean;
  // Input/Output data for complete UTXO tracking
  inputs?: TransactionInput[];
  outputs?: TransactionOutput[];
}

export interface UTXO {
  address: string;
  tx_hash: string;
  output_index: number;
  amount: BlockfrostAmount[];
  block: string;
  data_hash?: string | null;
  inline_datum?: string | null;
  reference_script_hash?: string | null;
  isSpent: boolean;
  spentInTx?: string | null;
  isExternal?: boolean;
}

// Re-export Asset type from shared
export type { Asset } from '@extension/shared';

// Storage data structures
export interface TransactionRecord extends Transaction {
  walletId: string;
  lastSynced: number;
  isExternal?: boolean; // Mark transactions not directly related to wallet
}

export interface UTXORecord extends UTXO {
  walletId: string;
  lastSynced: number;
}

export interface TransactionsStorageData {
  transactions: Record<string, TransactionRecord>; // hash -> transaction
  utxos: Record<string, UTXORecord>; // `${tx_hash}:${output_index}` -> utxo
  lastFullSync: Record<string, number>; // walletId -> timestamp
}

const fallbackData: TransactionsStorageData = {
  transactions: {},
  utxos: {},
  lastFullSync: {},
};

// Create the storage instance
const storage = createIndexedDBStorage('cardano-wallet-dev', 'transactions', fallbackData);

// Helper functions for working with the storage
export const transactionsStorage = {
  ...storage,

  // Get all transactions for a wallet
  async getWalletTransactions(walletId: string): Promise<TransactionRecord[]> {
    const data = await storage.get();
    return Object.values(data.transactions)
      .filter(tx => tx.walletId === walletId)
      .sort((a, b) => b.block_time - a.block_time);
  },

  // Get all UTXOs for a wallet
  async getWalletUTXOs(walletId: string): Promise<UTXORecord[]> {
    const data = await storage.get();
    return Object.values(data.utxos)
      .filter(utxo => utxo.walletId === walletId)
      .sort((a, b) => b.tx_hash.localeCompare(a.tx_hash));
  },

  // Get unspent UTXOs for a wallet
  async getWalletUnspentUTXOs(walletId: string): Promise<UTXORecord[]> {
    const utxos = await this.getWalletUTXOs(walletId);
    return utxos.filter(utxo => !utxo.isSpent);
  },

  // Get spent UTXOs for a wallet
  async getWalletSpentUTXOs(walletId: string): Promise<UTXORecord[]> {
    const utxos = await this.getWalletUTXOs(walletId);
    return utxos.filter(utxo => utxo.isSpent);
  },

  // Get a specific UTXO
  async getUTXO(txHash: string, outputIndex: number): Promise<UTXORecord | null> {
    const data = await storage.get();
    const key = `${txHash}:${outputIndex}`;
    return data.utxos[key] || null;
  },

  // Get a specific transaction
  async getTransaction(txHash: string): Promise<TransactionRecord | null> {
    const data = await storage.get();
    return data.transactions[txHash] || null;
  },

  // Store multiple transactions
  async storeTransactions(walletId: string, transactions: Transaction[]): Promise<void> {
    const now = Date.now();

    await storage.set(data => {
      for (const tx of transactions) {
        data.transactions[tx.hash] = {
          ...tx,
          walletId,
          lastSynced: now,
        };
      }
      return data;
    });
  },

  // Store multiple UTXOs
  async storeUTXOs(walletId: string, utxos: UTXO[]): Promise<void> {
    const now = Date.now();

    await storage.set(data => {
      for (const utxo of utxos) {
        const key = `${utxo.tx_hash}:${utxo.output_index}`;

        data.utxos[key] = {
          ...utxo,
          walletId,
          lastSynced: now,
        };
      }
      return data;
    });
  },

  // Mark UTXOs as spent
  async markUTXOsAsSpent(utxoKeys: string[], spentInTx: string): Promise<void> {
    await storage.set(data => {
      for (const key of utxoKeys) {
        if (data.utxos[key]) {
          data.utxos[key].isSpent = true;
          data.utxos[key].spentInTx = spentInTx;
        }
      }
      return data;
    });
  },

  // Update last sync timestamp for a wallet
  async updateLastSync(walletId: string): Promise<void> {
    await storage.set(data => {
      data.lastFullSync[walletId] = Date.now();
      return data;
    });
  },

  // Get last sync timestamp for a wallet
  async getLastSync(walletId: string): Promise<number> {
    const data = await storage.get();
    return data.lastFullSync[walletId] || 0;
  },

  // Clear all data for a wallet (e.g., when wallet is deleted)
  async clearWalletData(walletId: string): Promise<void> {
    await storage.set(data => {
      // Remove transactions
      Object.keys(data.transactions).forEach(hash => {
        if (data.transactions[hash].walletId === walletId) {
          delete data.transactions[hash];
        }
      });

      // Remove UTXOs
      Object.keys(data.utxos).forEach(key => {
        if (data.utxos[key].walletId === walletId) {
          delete data.utxos[key];
        }
      });

      // Remove sync timestamp
      delete data.lastFullSync[walletId];

      return data;
    });
  },

  // Get storage statistics
  async getStats(): Promise<{
    totalTransactions: number;
    totalUTXOs: number;
    walletCounts: Record<string, { transactions: number; utxos: number; unspentUTXOs: number }>;
  }> {
    const data = await storage.get();
    const stats = {
      totalTransactions: Object.keys(data.transactions).length,
      totalUTXOs: Object.keys(data.utxos).length,
      walletCounts: {} as Record<string, { transactions: number; utxos: number; unspentUTXOs: number }>,
    };

    // Count by wallet
    const walletStats = stats.walletCounts;

    Object.values(data.transactions).forEach(tx => {
      if (!walletStats[tx.walletId]) {
        walletStats[tx.walletId] = { transactions: 0, utxos: 0, unspentUTXOs: 0 };
      }
      walletStats[tx.walletId].transactions++;
    });

    Object.values(data.utxos).forEach(utxo => {
      if (!walletStats[utxo.walletId]) {
        walletStats[utxo.walletId] = { transactions: 0, utxos: 0, unspentUTXOs: 0 };
      }
      walletStats[utxo.walletId].utxos++;
      if (!utxo.isSpent) {
        walletStats[utxo.walletId].unspentUTXOs++;
      }
    });

    return stats;
  },
};
