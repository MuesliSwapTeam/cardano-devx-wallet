// popup/src/index.tsx
import { createRoot } from 'react-dom/client';
import '@src/index.css';
import App from './App';

/**
 * The only job of this file is to find the root HTML element
 * and render our main <App /> component into it.
 */
function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Cannot find #app-container');
  }

  const root = createRoot(appContainer);
  root.render(<App />);
}

init();
