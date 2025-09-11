// popup/src/layouts/MainLayout.tsx
import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useStorage, settingsStorage, walletsStorage } from '@extension/storage';
import WalletDropdown from '../components/WalletDropdown';
import { PrimaryButton, SecondaryButton } from '@src/components/buttons';
import { useBalanceSync } from '@src/hooks/useBalanceSync';
import type { Wallet } from '@extension/shared';

function MainLayout() {
  const { walletId, view = 'assets' } = useParams();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const settings = useStorage(settingsStorage);
  const walletsData = useStorage(walletsStorage);

  const wallets = walletsData?.wallets || [];
  const currentWallet = wallets.find((w: Wallet) => w.id === walletId);
  const isDark = settings?.theme === 'dark';
  const iconUrl = isDark ? chrome.runtime.getURL('icon-dark.svg') : chrome.runtime.getURL('icon-light.svg');

  // Balance sync functionality
  const { isRefreshing, lastSynced, error, refreshBalance } = useBalanceSync(currentWallet);

  // Format time since last sync and update every second
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getSyncCountdown = () => {
    if (!lastSynced) return '';
    const timeSinceSync = Math.floor((now - lastSynced) / 1000);
    const timeUntilNext = Math.max(0, 30 - timeSinceSync);

    if (timeUntilNext <= 1) {
      return 'syncing soon...';
    }

    return `sync in: ${timeUntilNext}s`;
  };

  const handleWalletSelect = async (newWalletId: string) => {
    // Update the active wallet in storage
    await walletsStorage.setActiveWallet(newWalletId);
    // Navigate to the wallet page
    navigate(`/wallet/${newWalletId}/${view}`);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
        <img src={iconUrl} alt="icon" width="34" height="34" />
        <div className="mx-auto flex items-center">
          <WalletDropdown currentWalletId={walletId} onSelectWallet={handleWalletSelect} />
        </div>
        <Link
          to="/settings"
          className="flex size-8 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </header>
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="relative my-1 border-b border-gray-300 dark:border-gray-600">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute bottom-0 left-1/2 flex h-6 -translate-x-1/2 translate-y-1/2 items-center justify-center bg-slate-50 px-2 text-gray-400 focus:outline-none dark:bg-gray-800 dark:text-gray-500"
            aria-expanded={isExpanded}>
            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2 2L8 6L14 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 6L8 10L14 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>
        </div>
        <div
          className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="border-b border-gray-300 p-4 dark:border-gray-600">
              <div className="mb-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs text-gray-500">Current Balance</p>
                  <button
                    onClick={refreshBalance}
                    disabled={isRefreshing}
                    className="flex size-6 items-center justify-center rounded-full hover:bg-gray-200 disabled:opacity-50 dark:hover:bg-gray-700"
                    title="Refresh balance">
                    <svg
                      className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-2xl font-bold">
                  {(parseInt(currentWallet?.balance || '0') / 1_000_000).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{' '}
                  ₳
                </p>
                <div className="mt-1 text-xs text-gray-400">
                  {isRefreshing ? (
                    'Syncing...'
                  ) : error ? (
                    <span className="text-red-500">{error}</span>
                  ) : lastSynced ? (
                    getSyncCountdown()
                  ) : (
                    'Not synced yet'
                  )}
                </div>
              </div>
              {currentWallet?.type === 'SPOOFED' ? (
                <div className="text-center">
                  <p className="mb-2 font-semibold text-red-500">Spoofed wallets are not able to send/receive.</p>
                  <Link to="/spoofed-info" className="text-sm text-blue-500 underline hover:text-blue-600">
                    Learn more about read-only wallets
                  </Link>
                </div>
              ) : (
                <div className="flex justify-center space-x-4">
                  <SecondaryButton className="flex-1" onClick={() => alert('Send not implemented yet')}>
                    Send
                  </SecondaryButton>
                  <SecondaryButton className="flex-1" onClick={() => alert('Receive not implemented yet')}>
                    Receive
                  </SecondaryButton>
                </div>
              )}
            </div>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
      <footer className="flex justify-center space-x-4 border-t border-gray-300 p-4 dark:border-gray-600">
        <Link
          to={`/wallet/${walletId}/assets`}
          className={`rounded-md px-6 py-2 transition ${view === 'assets' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
          Assets
        </Link>
        <Link
          to={`/wallet/${walletId}/transactions`}
          className={`rounded-md px-4 py-2 text-sm transition ${view === 'transactions' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
          Transactions
        </Link>
        <Link
          to={`/wallet/${walletId}/utxos`}
          className={`rounded-md px-6 py-2 transition ${view === 'utxos' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
          UTXOs
        </Link>
      </footer>
    </div>
  );
}

export default MainLayout;
