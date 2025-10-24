import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useStorage, walletsStorage } from '@extension/storage';
import type { Wallet } from '@extension/shared';
import type { TransactionRecord, UTXORecord } from '@extension/storage';
import Transactions from './Transactions';

const TransactionsView = () => {
  const { walletId } = useParams();
  const [syncPromise, setSyncPromise] = useState<Promise<any> | null>(null);
  const [syncProgress, setSyncProgress] = useState({
    current: 0,
    total: 0,
    message: '',
    phase: 'checking',
    newItemsCount: 0,
  });
  const [showCompletedIndicator, setShowCompletedIndicator] = useState(false);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [utxos, setUTXOs] = useState<UTXORecord[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const walletsData = useStorage(walletsStorage);
  const wallets = walletsData?.wallets || [];
  const wallet = wallets.find((w: Wallet) => w.id === walletId);

  // Load existing data and sync when component mounts or refreshTrigger changes
  useEffect(() => {
    if (!wallet) return;

    // First, load existing data from storage immediately
    loadExistingData();
    // Then sync in the background
    syncTransactions();
  }, [wallet?.id, refreshTrigger]);

  // Listen for sync progress updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'SYNC_PROGRESS' && message.payload.walletId === wallet?.id) {
        setSyncProgress(message.payload);

        // Handle completion phase
        if (message.payload.phase === 'complete') {
          setShowCompletedIndicator(true);
          // Clear sync promise immediately when complete
          setSyncPromise(null);
          // Hide completed indicator after 1 second
          setTimeout(() => {
            setShowCompletedIndicator(false);
            setSyncProgress({ current: 0, total: 0, message: '', phase: 'checking', newItemsCount: 0 });
          }, 1000);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [wallet?.id]);

  const loadExistingData = async () => {
    if (!wallet) return;

    try {
      // Send a message to load existing data from storage without syncing
      chrome.runtime.sendMessage({ type: 'GET_CACHED_DATA', payload: { walletId: wallet.id } }, response => {
        if (response?.success) {
          setTransactions(response.transactions || []);
          setUTXOs(response.utxos || []);
        }
      });
    } catch (error) {
      console.error('Failed to load existing data:', error);
    }
  };

  const syncTransactions = async () => {
    if (!wallet || syncPromise) return;

    console.log(`Starting sync for wallet ${wallet.id}`);

    // Reset sync progress when starting new sync
    setSyncProgress({ current: 0, total: 0, message: '', phase: 'checking', newItemsCount: 0 });

    const promise = new Promise(async (resolve, reject) => {
      try {
        // Add timeout to prevent infinite loading
        const timeout = setTimeout(() => {
          reject(new Error('Sync timeout after 60 seconds'));
        }, 60000);

        await new Promise((resolveMessage, rejectMessage) =>
          chrome.runtime.sendMessage({ type: 'GET_TRANSACTIONS', payload: { walletId: wallet.id } }, response => {
            clearTimeout(timeout);
            console.log('GET_TRANSACTIONS response:', response);
            if (response?.success) {
              console.log(
                `Sync successful: ${response.transactions?.length || 0} transactions, ${response.utxos?.length || 0} UTXOs`,
              );
              setTransactions(response.transactions || []);
              setUTXOs(response.utxos || []);
              resolveMessage(response);
            } else {
              const errorMsg = response?.error || 'Failed to fetch transactions';
              console.error('Sync failed with error:', errorMsg);
              rejectMessage(new Error(errorMsg));
            }
          }),
        );
        resolve(undefined);
      } catch (error) {
        console.error('Sync promise error:', error);
        reject(error);
      }
    });

    setSyncPromise(promise);

    try {
      await promise;
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncProgress({
        current: 0,
        total: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        phase: 'checking',
        newItemsCount: 0,
      });
      // Clear error message after 5 seconds
      setTimeout(() => {
        setSyncProgress({ current: 0, total: 0, message: '', phase: 'checking', newItemsCount: 0 });
      }, 5000);
    } finally {
      setSyncPromise(null);
    }
  };

  const forceRefresh = () => {
    console.log('Force refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  if (!wallet) {
    return <div>Loading wallet...</div>;
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Sync indicator */}
      {(syncPromise || showCompletedIndicator) && (
        <div
          className={`fixed inset-x-0 bottom-16 z-10 rounded-t-lg px-3 py-2 ${
            showCompletedIndicator ? 'bg-green-50 dark:bg-green-900 animate-fadeOut' : 'bg-blue-50 dark:bg-blue-900'
          }`}>
          <div className="flex items-center gap-2">
            {!showCompletedIndicator && (
              <div className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            )}
            {showCompletedIndicator && (
              <div className="size-4 flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400">✓</span>
              </div>
            )}
            <div
              className={`text-sm ${
                showCompletedIndicator ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'
              }`}>
              {showCompletedIndicator
                ? 'Up to date'
                : syncProgress.phase === 'checking'
                  ? 'Checking for updates...'
                  : `Downloading ${syncProgress.current}/${syncProgress.total}`}
            </div>
          </div>
        </div>
      )}

      {/* Always show transactions if we have them */}
      {transactions.length === 0 && !syncPromise ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-sm text-gray-600 dark:text-gray-400">No transactions yet</div>
          <button onClick={forceRefresh} className="mt-2 text-xs text-blue-500 underline hover:text-blue-600">
            Force Refresh
          </button>
        </div>
      ) : (
        <div>
          <Transactions wallet={wallet} transactions={transactions} />
        </div>
      )}
    </div>
  );
};

export default TransactionsView;
