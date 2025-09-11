import { useEffect, useState, useRef, useCallback } from 'react';
import type { Wallet } from '@extension/shared';

interface BalanceSyncState {
  isRefreshing: boolean;
  lastSynced: number | null;
  error: string | null;
}

export const useBalanceSync = (wallet: Wallet | undefined) => {
  const [syncState, setSyncState] = useState<BalanceSyncState>({
    isRefreshing: false,
    lastSynced: null,
    error: null,
  });

  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const refreshBalance = useCallback(async () => {
    if (!wallet) return;

    const syncStartTime = Date.now();
    setSyncState(prev => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REFRESH_WALLET_BALANCE',
        payload: { walletId: wallet.id },
      });

      if (mountedRef.current) {
        if (response?.success) {
          setSyncState(prev => ({
            ...prev,
            isRefreshing: false,
            lastSynced: syncStartTime, // Use when we started the sync, not the response timestamp
            error: null,
          }));
        } else {
          setSyncState(prev => ({
            ...prev,
            isRefreshing: false,
            error: response?.error || 'Failed to refresh balance',
          }));
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        setSyncState(prev => ({
          ...prev,
          isRefreshing: false,
          error: error instanceof Error ? error.message : 'Failed to refresh balance',
        }));
      }
    }
  }, [wallet]);

  // Refresh immediately when wallet changes
  useEffect(() => {
    if (wallet) {
      refreshBalance();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [wallet?.id]); // Only depend on wallet ID, not the whole wallet object

  // Start 30-second polling when component mounts
  useEffect(() => {
    if (wallet) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Start new interval for 30-second polling
      intervalRef.current = setInterval(() => {
        refreshBalance();
      }, 30000);
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [wallet?.id]); // Only depend on wallet ID, not refreshBalance

  return {
    ...syncState,
    refreshBalance,
  };
};
