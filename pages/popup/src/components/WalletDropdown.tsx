// popup/src/components/WalletDropdown.tsx
import { useState, useEffect } from 'react';
import { useStorage, walletsStorage, settingsStorage } from '@extension/storage';
import { Link, useNavigate } from 'react-router-dom';

interface WalletDropdownProps {
  currentWalletId: string | undefined;
  onSelectWallet: (walletId: string) => void;
}

function WalletDropdown({ currentWalletId, onSelectWallet }: WalletDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const walletsData = useStorage(walletsStorage);
  const settings = useStorage(settingsStorage);
  const navigate = useNavigate();

  const wallets = walletsData?.wallets || [];
  const activeWalletId = settings?.activeWalletId; // Extract active wallet ID from settings
  const currentWallet = wallets.find(w => w.id === currentWalletId) || wallets[0];

  // Group wallets by network
  const mainnetWallets = wallets.filter(w => w.network === 'Mainnet');
  const preprodWallets = wallets.filter(w => w.network === 'Preprod');

  useEffect(() => {
    if (dropdownOpen) {
      const handleClickOutside = () => setDropdownOpen(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
    return undefined;
  }, [dropdownOpen]);

  const handleWalletSelect = (walletId: string) => {
    onSelectWallet(walletId);
    setDropdownOpen(false);
  };

  const handleSettingsClick = (e: React.MouseEvent, walletId: string) => {
    e.stopPropagation(); // Prevent dropdown from closing immediately
    setDropdownOpen(false); // Manually close dropdown
    navigate(`/wallet-settings/${walletId}`);
  };

  const handleSetActiveWallet = async (e: React.MouseEvent, walletId: string) => {
    e.stopPropagation(); // Prevent dropdown from closing

    try {
      // Find the wallet to get its name
      const wallet = wallets?.find(w => w.id === walletId);
      if (!wallet) {
        alert('Wallet not found. Please try again.');
        return;
      }

      await walletsStorage.setActiveWallet(walletId);
      // No need to manually set state - useStorage(settingsStorage) will update automatically
    } catch (error) {
      console.error('Failed to set active wallet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to set active wallet: ${errorMessage}`);
    }
  };

  if (!wallets || wallets.length === 0) {
    return (
      <Link
        to="/add-wallet"
        className="rounded-md border border-gray-400 bg-blue-600 px-3 py-1.5 text-white transition-colors hover:bg-blue-700">
        <span className="font-semibold">Add First Wallet</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        className="flex w-40 items-center justify-between rounded-md bg-transparent px-2 py-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={e => {
          e.stopPropagation();
          setDropdownOpen(!dropdownOpen);
        }}>
        <div className="flex grow items-center justify-center">
          <span className="truncate text-lg font-semibold">{currentWallet?.name || 'Select Wallet'}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`size-5 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownOpen && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {/* Mainnet Section */}
          <div className="flex items-center py-1">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            <span className="px-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              mainnet
            </span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          {mainnetWallets.length > 0 ? (
            mainnetWallets.map(wallet => (
              <div
                key={wallet.id}
                className={`flex items-center justify-between px-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentWalletId === wallet.id ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
                <div className="flex grow items-center">
                  <button
                    className="grow px-1 py-2 text-center"
                    onClick={() => handleWalletSelect(wallet.id)}
                    title={activeWalletId === wallet.id ? 'Active wallet for dApps' : 'Click to view wallet'}>
                    {wallet.name}
                  </button>
                </div>
                <div className="flex items-center space-x-1">
                  {/* Settings button */}
                  <button
                    onClick={e => handleSettingsClick(e, wallet.id)}
                    className="p-1 text-gray-500 hover:text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs italic text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300">
              No wallets in this network
            </div>
          )}

          {/* Preprod Section */}
          <div className="flex items-center py-1">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            <span className="px-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              preprod
            </span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          {preprodWallets.length > 0 ? (
            preprodWallets.map(wallet => (
              <div
                key={wallet.id}
                className={`flex items-center justify-between px-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentWalletId === wallet.id ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
                <div className="flex grow items-center">
                  <button
                    className="grow px-1 py-2 text-center"
                    onClick={() => handleWalletSelect(wallet.id)}
                    title={activeWalletId === wallet.id ? 'Active wallet for dApps' : 'Click to view wallet'}>
                    {wallet.name}
                  </button>
                </div>
                <div className="flex items-center space-x-1">
                  {/* Settings button */}
                  <button
                    onClick={e => handleSettingsClick(e, wallet.id)}
                    className="p-1 text-gray-500 hover:text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs italic text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300">
              No wallets in this network
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-600"></div>
          <Link
            to="/add-wallet"
            className="block w-full bg-blue-600 px-4 py-2 text-center text-white transition-colors hover:bg-blue-700"
            onClick={() => setDropdownOpen(false)}>
            Add New Wallet
          </Link>
        </div>
      )}
    </div>
  );
}

export default WalletDropdown;
