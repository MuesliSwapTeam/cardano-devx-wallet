import { transactionsStorage, type TransactionRecord, type UTXORecord } from '@extension/storage';
import { getWalletUTXOs, getTransactions, getWalletPaymentAddresses } from './provider';
import type { Wallet } from '@extension/shared';

export interface SyncOptions {
  forceFullSync?: boolean;
  maxAge?: number; // Maximum age in milliseconds before forcing a sync
}

export interface SyncResult {
  success: boolean;
  newTransactions: number;
  newUTXOs: number;
  updatedUTXOs: number;
  error?: string;
  syncDuration: number;
}

// Default sync settings
const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const SYNC_COOLDOWN = 30 * 1000; // 30 seconds minimum between syncs

// Track ongoing syncs to prevent duplicates
const ongoingSyncs = new Set<string>();
const lastSyncTimes = new Map<string, number>();

export class WalletSyncService {
  /**
   * Synchronizes wallet data from Blockfrost to local IndexedDB cache.
   * This is the main entry point for keeping wallet data up to date.
   */
  static async syncWallet(wallet: Wallet, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const walletId = wallet.id;

    // Prevent concurrent syncs for the same wallet
    if (ongoingSyncs.has(walletId)) {
      return {
        success: false,
        newTransactions: 0,
        newUTXOs: 0,
        updatedUTXOs: 0,
        error: 'Sync already in progress for this wallet',
        syncDuration: 0,
      };
    }

    // Check cooldown period
    const lastSync = lastSyncTimes.get(walletId) || 0;
    const timeSinceLastSync = Date.now() - lastSync;
    if (!options.forceFullSync && timeSinceLastSync < SYNC_COOLDOWN) {
      return {
        success: false,
        newTransactions: 0,
        newUTXOs: 0,
        updatedUTXOs: 0,
        error: 'Sync cooldown in effect',
        syncDuration: Date.now() - startTime,
      };
    }

    ongoingSyncs.add(walletId);
    lastSyncTimes.set(walletId, Date.now());

    try {
      const maxAge = options.maxAge || DEFAULT_MAX_AGE;
      const lastStoredSync = await transactionsStorage.getLastSync(walletId);
      const needsSync = options.forceFullSync || Date.now() - lastStoredSync > maxAge;

      if (!needsSync) {
        return {
          success: true,
          newTransactions: 0,
          newUTXOs: 0,
          updatedUTXOs: 0,
          syncDuration: Date.now() - startTime,
        };
      }

      console.log(`Starting sync for wallet ${walletId}...`);

      // Fetch fresh UTXOs first, then use them for both transactions and UTXO storage
      const [freshUTXOs, transactions, paymentAddresses] = await Promise.all([
        getWalletUTXOs(wallet),
        getTransactions(wallet),
        getWalletPaymentAddresses(wallet),
      ]);

      // Enhance transactions with the UTXOs we already fetched
      const freshTransactions = transactions.map(tx => {
        const relatedUtxos = freshUTXOs.filter(utxo => utxo.tx_hash === tx.hash || utxo.spentInTx === tx.hash);
        return {
          ...tx,
          relatedUtxos,
        };
      });

      // Get existing data from storage
      const [existingTransactions, existingUTXOs] = await Promise.all([
        transactionsStorage.getWalletTransactions(walletId),
        transactionsStorage.getWalletUTXOs(walletId),
      ]);

      // Identify new transactions
      const existingTxHashes = new Set(existingTransactions.map(tx => tx.hash));
      const newTransactions = freshTransactions.filter(tx => !existingTxHashes.has(tx.hash));

      // Identify new UTXOs
      const existingUTXOKeys = new Set(existingUTXOs.map(utxo => `${utxo.tx_hash}:${utxo.output_index}`));
      const newUTXOs = freshUTXOs.filter(utxo => !existingUTXOKeys.has(`${utxo.tx_hash}:${utxo.output_index}`));

      // Identify UTXOs that changed spent status
      const updatedUTXOs = freshUTXOs.filter(freshUtxo => {
        const key = `${freshUtxo.tx_hash}:${freshUtxo.output_index}`;
        const existing = existingUTXOs.find(utxo => `${utxo.tx_hash}:${utxo.output_index}` === key);
        return existing && existing.isSpent !== freshUtxo.isSpent;
      });

      // Store new data
      if (newTransactions.length > 0) {
        await transactionsStorage.storeTransactions(walletId, newTransactions);
      }

      if (newUTXOs.length > 0 || updatedUTXOs.length > 0) {
        const utxosToStore = [...newUTXOs, ...updatedUTXOs];
        await transactionsStorage.storeUTXOs(walletId, utxosToStore);
      }

      // Update sync timestamp
      await transactionsStorage.updateLastSync(walletId);

      const syncDuration = Date.now() - startTime;
      console.log(`Sync completed for wallet ${walletId} in ${syncDuration}ms:`, {
        newTransactions: newTransactions.length,
        newUTXOs: newUTXOs.length,
        updatedUTXOs: updatedUTXOs.length,
      });

      return {
        success: true,
        newTransactions: newTransactions.length,
        newUTXOs: newUTXOs.length,
        updatedUTXOs: updatedUTXOs.length,
        syncDuration,
      };
    } catch (error) {
      console.error(`Sync failed for wallet ${walletId}:`, error);

      let errorMessage = 'Unknown sync error';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Provide more helpful error messages for common issues
        if (error.message.includes('API key invalid or missing')) {
          errorMessage = 'Blockfrost API key not configured. Please set it in Settings.';
        } else if (error.message.includes('Invalid stake address')) {
          errorMessage = 'Invalid wallet stake address. Please check wallet configuration.';
        } else if (error.message.includes('Stake address not found')) {
          errorMessage = 'Wallet has no on-chain activity yet. This is normal for new wallets.';
        }
      }

      return {
        success: false,
        newTransactions: 0,
        newUTXOs: 0,
        updatedUTXOs: 0,
        error: errorMessage,
        syncDuration: Date.now() - startTime,
      };
    } finally {
      ongoingSyncs.delete(walletId);
    }
  }

  /**
   * Performs an incremental sync - only fetches data if the cache is stale.
   */
  static async incrementalSync(wallet: Wallet): Promise<SyncResult> {
    return this.syncWallet(wallet, { forceFullSync: false });
  }

  /**
   * Performs a full sync - always fetches fresh data from Blockfrost.
   */
  static async fullSync(wallet: Wallet): Promise<SyncResult> {
    return this.syncWallet(wallet, { forceFullSync: true });
  }

  /**
   * Syncs multiple wallets in parallel with rate limiting.
   */
  static async syncMultipleWallets(wallets: Wallet[], options: SyncOptions = {}): Promise<Record<string, SyncResult>> {
    const results: Record<string, SyncResult> = {};

    // Sync wallets in batches to avoid overwhelming the API
    const BATCH_SIZE = 3;
    const batches = [];

    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      batches.push(wallets.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async wallet => {
        const result = await this.syncWallet(wallet, options);
        results[wallet.id] = result;
        return result;
      });

      await Promise.all(batchPromises);

      // Small delay between batches to be respectful to the API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Gets cached data for a wallet with optional auto-sync if stale.
   */
  static async getWalletData(
    wallet: Wallet,
    autoSync = true,
  ): Promise<{
    transactions: Awaited<ReturnType<typeof transactionsStorage.getWalletTransactions>>;
    utxos: Awaited<ReturnType<typeof transactionsStorage.getWalletUTXOs>>;
    lastSync: number;
    isStale: boolean;
  }> {
    const walletId = wallet.id;
    const lastSync = await transactionsStorage.getLastSync(walletId);
    const isStale = Date.now() - lastSync > DEFAULT_MAX_AGE;

    // Auto-sync if data is stale
    if (autoSync && isStale) {
      await this.incrementalSync(wallet);
    }

    const [transactions, utxos] = await Promise.all([
      transactionsStorage.getWalletTransactions(walletId),
      transactionsStorage.getWalletUTXOs(walletId),
    ]);

    return {
      transactions,
      utxos,
      lastSync: await transactionsStorage.getLastSync(walletId),
      isStale: Date.now() - (await transactionsStorage.getLastSync(walletId)) > DEFAULT_MAX_AGE,
    };
  }

  /**
   * Clears all cached data and resyncs from scratch.
   */
  static async resetAndResync(wallet: Wallet): Promise<SyncResult> {
    await transactionsStorage.clearWalletData(wallet.id);
    return this.fullSync(wallet);
  }

  /**
   * Gets sync status for a wallet.
   */
  static async getSyncStatus(walletId: string): Promise<{
    lastSync: number;
    isStale: boolean;
    isSyncing: boolean;
    timeSinceLastSync: number;
  }> {
    const lastSync = await transactionsStorage.getLastSync(walletId);
    const timeSinceLastSync = Date.now() - lastSync;

    return {
      lastSync,
      isStale: timeSinceLastSync > DEFAULT_MAX_AGE,
      isSyncing: ongoingSyncs.has(walletId),
      timeSinceLastSync,
    };
  }
}
