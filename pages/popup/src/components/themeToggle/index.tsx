import { useStorage, settingsStorage } from '@extension/storage';
import './style.css';

const ThemeToggle = () => {
  // Use the new unified settings storage
  const settings = useStorage(settingsStorage);
  const isDark = settings?.theme === 'dark';

  const dayModeIcon = chrome.runtime.getURL('DayMode.svg');
  const nightModeIcon = chrome.runtime.getURL('NightMode.svg');

  return (
    <label className="switch" htmlFor="theme-toggle">
      <input
        type="checkbox"
        id="theme-toggle"
        checked={isDark}
        // Use the new toggleTheme method
        onChange={() => settingsStorage.toggleTheme()}
        className="sr-only"
      />
      <span className="slider round flex items-center justify-between px-1.5">
        <img
          src={dayModeIcon}
          alt="Day Mode"
          className={`day-icon z-10 size-3.5 ${isDark ? 'icon-inactive' : 'icon-day'}`}
          draggable="false"
        />
        <img
          src={nightModeIcon}
          alt="Night Mode"
          className={`night-icon z-10 size-3.5 ${isDark ? 'icon-night' : 'icon-inactive'}`}
          draggable="false"
        />
      </span>
    </label>
  );
};

export default ThemeToggle;
