// popup/src/layouts/OnboardingLayout.tsx
import { Outlet } from 'react-router-dom';
import { useStorage, settingsStorage, onboardingStorage } from '@extension/storage';
import ThemeToggle from '../components/themeToggle';

function OnboardingLayout({ children }) {
  // Use the new unified settings storage
  const settings = useStorage(settingsStorage);
  const onboardingState = useStorage(onboardingStorage);
  const isDark = settings?.theme === 'dark';
  const iconUrl = isDark ? chrome.runtime.getURL('icon-dark.svg') : chrome.runtime.getURL('icon-light.svg');

  // Get progress from onboarding state, default to 0 if not available
  const progress = onboardingState?.progress || 0;

  return (
    <>
      <header className="relative flex items-center justify-between border-b border-gray-300 px-4 py-3 dark:border-gray-600">
        <img src={iconUrl} alt="icon" width="34" height="34" />
        <span className="absolute left-1/2 -translate-x-1/2 text-2xl font-semibold">Onboarding</span>
        <ThemeToggle />
      </header>
      <main className="flex-1 overflow-auto p-4">{children ? children : <Outlet />}</main>
      <footer className="border-t border-gray-300 p-4 text-center dark:border-gray-600">
        <div className="flex items-center justify-center">
          <div className="text-sm">Onboarding Progress ({Math.round(progress)}%)</div>
          <div className="relative ml-3 h-2 w-32 rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </footer>
    </>
  );
}

export default OnboardingLayout;
