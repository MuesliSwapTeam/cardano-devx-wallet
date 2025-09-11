// popup/src/App.tsx
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useStorage, settingsStorage, walletsStorage, onboardingStorage } from '@extension/storage';
import { useEffect } from 'react';

// Layouts
import MainLayout from './layouts/MainLayout';
import OnboardingLayout from './layouts/OnboardingLayout';
import SubPageLayout from './layouts/SubPageLayout';
import WalletActionLayout from './layouts/WalletActionLayout';

// Views
import WalletView from './wallet/WalletView';
import UTXODetail from './wallet/UTXODetail';
import Settings from './Settings';
import SpoofedWalletInfo from './info/SpoofedWalletInfo';
import DAppPermission from './cip30/DAppPermission';
import NoWallets from './components/NoWallets';

// Onboarding Pages
import Welcome from './onboarding/Welcome';
import Legal from './onboarding/Legal';

// Wallet Action Pages
import AddWallet from './wallet-actions/NewWalletView';
import CreateNew from './wallet-actions/CreateNew';
import CreateSuccess from './wallet-actions/CreateSuccess';
import ImportSeed from './wallet-actions/ImportSeed';
import ImportSuccess from './wallet-actions/ImportSuccess';
import Spoof from './wallet-actions/Spoof';
import SpoofSuccess from './wallet-actions/SpoofSuccess';
import WalletSettings from './wallet-actions/WalletSettings';

// Component to handle navigation messages (must be inside Router)
function NavigationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'NAVIGATE_TO_PERMISSION') {
        const { origin, tabId } = message.payload;
        navigate(`/dapp-permission?origin=${encodeURIComponent(origin)}&tabId=${tabId}`);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [navigate]);

  return null;
}

function App() {
  const settings = useStorage(settingsStorage);
  const walletsData = useStorage(walletsStorage);
  const onboardingState = useStorage(onboardingStorage);

  const isDark = settings?.theme === 'dark';
  const wallets = walletsData?.wallets || [];
  const hasWallets = wallets.length > 0;
  const isOnboarded = settings?.onboarded && hasWallets;

  // Function to get the appropriate onboarding redirect path
  const getOnboardingRedirectPath = () => {
    if (!onboardingState?.isActive) {
      return '/onboarding';
    }

    // Use the stored current route if available, otherwise fallback to step mapping
    if (onboardingState.currentRoute) {
      return onboardingState.currentRoute;
    }

    // Fallback mapping for older sessions that don't have currentRoute
    const stepRouteMap = {
      welcome: '/onboarding',
      legal: '/onboarding/legal',
      'select-method': '/add-wallet',
      'create-form': '/create-new-wallet',
      'import-form': '/import-wallet-from-seed-phrase',
      'spoof-form': '/spoof-wallet',
      'api-key-setup': '/spoof-wallet', // Fallback case
      success: '/onboarding',
      completed: '/onboarding',
    };

    const currentStep = onboardingState.currentStep;
    return stepRouteMap[currentStep] || '/onboarding';
  };

  // Debug logging to help track onboarding issues
  useEffect(() => {
    console.log('App.tsx state:', {
      onboarded: settings?.onboarded,
      hasWallets,
      walletsCount: wallets.length,
      isOnboarded,
      activeWalletId: settings?.activeWalletId,
      onboardingActive: onboardingState?.isActive,
      currentStep: onboardingState?.currentStep,
      currentRoute: onboardingState?.currentRoute,
      lastVisitedRoute: onboardingState?.lastVisitedRoute,
      progress: onboardingState?.progress,
      redirectPath: getOnboardingRedirectPath(),
    });
  }, [settings?.onboarded, hasWallets, wallets.length, isOnboarded, settings?.activeWalletId, onboardingState]);

  // Auto-set activeWalletId if it's null but we have wallets
  useEffect(() => {
    if (hasWallets && !settings?.activeWalletId) {
      settingsStorage.setActiveWalletId(wallets[0].id);
    }
  }, [hasWallets, settings?.activeWalletId, wallets]);

  // Use the active wallet from settings, or fall back to the first wallet
  const activeWalletId = settings?.activeWalletId;
  const defaultWalletId = (() => {
    // If we have an activeWalletId and it exists in wallets, use it
    if (activeWalletId && wallets.find(w => w.id === activeWalletId)) {
      return activeWalletId;
    }
    // Otherwise, use the first available wallet
    if (wallets.length > 0) {
      return wallets[0].id;
    }
    // No wallets available
    return 'no-wallets';
  })();

  return (
    <Router>
      <NavigationHandler />
      <div className={`${isDark ? 'dark' : ''} h-full`}>
        <div className="App flex h-full flex-col bg-slate-50 text-black dark:bg-gray-800 dark:text-white">
          <Routes>
            {/* Initial Onboarding Flow */}
            <Route path="/onboarding" element={<OnboardingLayout />}>
              <Route index element={<Welcome />} />
              <Route path="legal" element={<Legal />} />
            </Route>

            {/* Wallet Action Flows */}
            <Route element={<WalletActionLayout />}>
              <Route path="/add-wallet" element={<AddWallet />} />
              <Route path="/create-new-wallet" element={<CreateNew />} />
              <Route path="/create-new-wallet-success" element={<CreateSuccess />} />
              <Route path="/import-wallet-from-seed-phrase" element={<ImportSeed />} />
              <Route path="/import-wallet-from-seed-phrase-success" element={<ImportSuccess />} />
              <Route path="/spoof-wallet" element={<Spoof />} />
              <Route path="/spoof-wallet-success" element={<SpoofSuccess />} />
            </Route>

            {/* Sub-Pages (Settings) */}
            <Route element={<SubPageLayout />}>
              <Route path="/settings" element={<Settings />} />
              <Route path="/wallet-settings/:walletId" element={<WalletSettings />} />
              <Route path="/spoofed-info" element={<SpoofedWalletInfo />} />
              <Route path="/no-wallets" element={<NoWallets />} />
            </Route>

            {/* CIP-30 Permission Popup (no layout) */}
            <Route path="/dapp-permission" element={<DAppPermission />} />

            {/* UTXO Detail Page (without MainLayout) */}
            <Route element={<SubPageLayout />}>
              <Route path="/wallet/:walletId/utxo/:txHash/:outputIndex" element={<UTXODetail />} />
            </Route>

            {/* Main Application */}
            <Route path="/wallet/:walletId/:view" element={<MainLayout />}>
              <Route index element={<WalletView />} />
            </Route>

            {/* Fallback Redirect */}
            <Route
              path="*"
              element={
                <Navigate
                  to={
                    isOnboarded
                      ? hasWallets
                        ? `/wallet/${defaultWalletId}/assets`
                        : '/no-wallets'
                      : getOnboardingRedirectPath()
                  }
                  replace
                />
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
