import '@src/Options.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { useStorage, settingsStorage } from '@extension/storage';
import { Button } from '@extension/ui';

const Options = () => {
  // Use the new unified settings storage
  const settings = useStorage(settingsStorage);
  const isLight = settings?.theme === 'light';
  const logo = isLight ? 'options/logo_horizontal.svg' : 'options/logo_horizontal_dark.svg';

  const goGithubSite = () =>
    chrome.tabs.create({ url: 'https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite' });

  return (
    <div className={`App ${isLight ? 'bg-slate-50 text-gray-900' : 'bg-gray-800 text-gray-100'}`}>
      <button onClick={goGithubSite}>
        <img src={chrome.runtime.getURL(logo)} className="App-logo" alt="logo" />
      </button>
      <p>
        Edit <code>pages/options/src/Options.tsx</code>
      </p>
      {/* Use the new toggleTheme method */}
      <Button className="mt-4" onClick={settingsStorage.toggleTheme} theme={settings?.theme}>
        Toggle theme
      </Button>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div> Loading ... </div>), <div> Error Occur </div>);
