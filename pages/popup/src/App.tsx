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
import AssetsView from './wallet/AssetsView';
import TransactionsView from './wallet/TransactionsView';
import UTXOsViewWrapper from './wallet/UTXOsViewWrapper';
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
import CreateSuccess from './wallet-actions/CreateSuccess';
import ImportSuccess from './wallet-actions/ImportSuccess';
import SpoofSuccess from './wallet-actions/SpoofSuccess';
import WalletSettings from './wallet-actions/WalletSettings';

// Split Component Imports for Clean Routing
import CreateWalletForm from './wallet-actions/CreateWalletForm';
import CreateWalletApiKey from './wallet-actions/CreateWalletApiKey';
import ImportSelectWords from './wallet-actions/ImportSelectWords';
import ImportEnterPhrase from './wallet-actions/ImportEnterPhrase';
import ImportWalletDetails from './wallet-actions/ImportWalletDetails';
import ImportWalletApiKey from './wallet-actions/ImportWalletApiKey';
import SpoofWalletForm from './wallet-actions/SpoofWalletForm';
import SpoofWalletApiKey from './wallet-actions/SpoofWalletApiKey';

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

    const currentStep = onboardingState.currentStep;

    // Special handling for api-key-setup step - redirect to correct API key route
    if (currentStep === 'api-key-setup' && onboardingState.apiKeySetupData?.requiredFor) {
      const apiKeyRoutes = {
        create: '/create-new-wallet/api-key',
        import: '/import-wallet/api-key',
        spoof: '/spoof-wallet/api-key',
      };
      return apiKeyRoutes[onboardingState.apiKeySetupData.requiredFor] || '/spoof-wallet/api-key';
    }

    // Fallback mapping for older sessions that don't have currentRoute
    const stepRouteMap = {
      welcome: '/onboarding',
      legal: '/onboarding/legal',
      'select-method': '/add-wallet',
      'create-form': '/create-new-wallet',
      'import-form': '/import-wallet',
      'spoof-form': '/spoof-wallet',
      'api-key-setup': '/spoof-wallet/api-key', // Final fallback if requiredFor is missing
      success: '/onboarding',
      completed: '/onboarding',
    };

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

              {/* Create Wallet Flow */}
              <Route path="/create-new-wallet" element={<CreateWalletForm />} />
              <Route path="/create-new-wallet/api-key" element={<CreateWalletApiKey />} />
              <Route path="/create-new-wallet/success" element={<CreateSuccess />} />

              {/* Import Wallet Flow */}
              <Route path="/import-wallet" element={<ImportSelectWords />} />
              <Route path="/import-wallet/enter/:wordCount" element={<ImportEnterPhrase />} />
              <Route path="/import-wallet/details" element={<ImportWalletDetails />} />
              <Route path="/import-wallet/api-key" element={<ImportWalletApiKey />} />
              <Route path="/import-wallet/success" element={<ImportSuccess />} />

              {/* Spoof Wallet Flow */}
              <Route path="/spoof-wallet" element={<SpoofWalletForm />} />
              <Route path="/spoof-wallet/api-key" element={<SpoofWalletApiKey />} />
              <Route path="/spoof-wallet/success" element={<SpoofSuccess />} />
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
            <Route path="/wallet/:walletId" element={<MainLayout />}>
              <Route path="assets" element={<AssetsView />} />
              <Route path="transactions" element={<TransactionsView />} />
              <Route path="utxos" element={<UTXOsViewWrapper />} />
              <Route index element={<Navigate to="assets" replace />} />
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
