import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStorage, walletsStorage, settingsStorage } from '@extension/storage';
import { PrimaryButton, SecondaryButton } from '@src/components/buttons';

const DAppPermission = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const origin = searchParams.get('origin');
  const walletName = searchParams.get('walletName') || 'DevX';
  const tabId = searchParams.get('tabId');

  const walletsData = useStorage(walletsStorage);
  const settings = useStorage(settingsStorage);

  const currentWallet = walletsData?.wallets?.find(w => w.id === settings?.activeWalletId);

  useEffect(() => {
    if (!origin || !tabId) {
      // Invalid request, close popup
      window.close();
    }
  }, [origin, tabId]);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      // Send approval to background script
      await chrome.runtime.sendMessage({
        type: 'CIP30_PERMISSION_RESPONSE',
        payload: {
          origin,
          approved: true,
          tabId: parseInt(tabId || '0'),
        },
      });
      window.close();
    } catch (error) {
      console.error('Failed to approve permission:', error);
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      // Send rejection to background script
      await chrome.runtime.sendMessage({
        type: 'CIP30_PERMISSION_RESPONSE',
        payload: {
          origin,
          approved: false,
          tabId: parseInt(tabId || '0'),
        },
      });
      window.close();
    } catch (error) {
      console.error('Failed to reject permission:', error);
      setIsProcessing(false);
    }
  };

  if (!origin || !currentWallet) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Invalid permission request</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-black dark:bg-gray-800 dark:text-white">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <svg
              className="size-6 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-lg font-bold">Connect to DApp</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold">{new URL(origin).hostname}</span> wants to connect
          </p>
        </div>

        <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
          <h2 className="mb-2 text-sm font-semibold">Connection Details</h2>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Wallet:</span>
              <span className="ml-2 truncate font-medium">{currentWallet.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Network:</span>
              <span className="font-medium">{currentWallet.network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="font-medium">{currentWallet.type === 'SPOOFED' ? 'Read-only' : 'Full Access'}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <h2 className="mb-2 text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            ⚠️ This allows the DApp to:
          </h2>
          <ul className="ml-4 list-outside list-disc space-y-1 text-xs">
            <li>View wallet balance and addresses</li>
            <li>View transaction history</li>
            <li>Request transaction signatures</li>
            {currentWallet.type === 'SPOOFED' && (
              <li className="font-medium text-red-600 dark:text-red-400">Note: Read-only wallet - no signing</li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-300 p-4 dark:border-gray-600">
        <div className="flex space-x-3">
          <SecondaryButton onClick={handleReject} disabled={isProcessing} className="flex-1">
            Reject
          </SecondaryButton>
          <PrimaryButton onClick={handleApprove} disabled={isProcessing} className="flex-1">
            {isProcessing ? 'Connecting...' : 'Connect'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};

export default DAppPermission;
