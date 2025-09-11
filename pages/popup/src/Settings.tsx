import { useState } from 'react';
import { Formik, Form, Field } from 'formik';
import ThemeToggle from './components/themeToggle';
import { settingsStorage, useStorage, walletsStorage, onboardingStorage } from '@extension/storage';
import { CancelButton } from '@src/components/buttons';
import FloatingLabelInput from './components/FloatingLabelInput';
import { ChevronUpIcon, ChevronDownIcon, TrashIcon } from '@heroicons/react/24/outline';

// --- Helper Functions (unchanged) ---
const maskApiKey = (key: string): string => {
  if (!key) return '';
  if (key.startsWith('mainnet')) {
    return key.substring(0, 13) + '********************';
  }
  if (key.startsWith('preprod')) {
    return key.substring(0, 12) + '********************';
  }
  return '********************';
};

const isValidBlockfrostKey = (key: string, network: 'Mainnet' | 'Preprod'): boolean => {
  if (!key) return false;
  const prefix = network === 'Mainnet' ? 'mainnet' : 'preprod';
  const expectedLength = 32;
  if (!key.startsWith(prefix)) return false;
  const secretPart = key.substring(prefix.length);
  if (secretPart.length !== expectedLength) return false;
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(secretPart);
};

// --- Main Settings Component ---
function Settings() {
  const settings = useStorage(settingsStorage);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);

  const handleDelete = (network: 'Mainnet' | 'Preprod') => {
    if (confirm(`Are you sure you want to delete the ${network} API key?`)) {
      if (network === 'Mainnet') {
        settingsStorage.setMainnetApiKey('');
      } else {
        settingsStorage.setPreprodApiKey('');
      }
    }
  };

  const handleResetOnboarding = async () => {
    if (confirm('Are you sure you want to reset all data? This will delete all your wallets and cannot be undone.')) {
      try {
        // 1. Reset onboarding storage
        await onboardingStorage.resetOnboarding();

        // 2. Clear IndexedDB (wallets)
        await walletsStorage.set({ wallets: [] });

        // 3. Reset all settings to defaults (this clears activeWalletId, API keys, etc.)
        await settingsStorage.set({
          theme: 'dark',
          onboarded: false,
          legalAccepted: false,
          mainnetApiKey: '',
          preprodApiKey: '',
          activeWalletId: null,
        });

        // 4. Completely clear all localStorage items related to this extension
        if (typeof localStorage !== 'undefined') {
          const keysToRemove: string[] = [];

          // Collect all keys that might be related to the extension
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
              key &&
              (key.startsWith('cardano-') ||
                key.startsWith('extension-') ||
                key.startsWith('wallet-') ||
                key === 'user-wallets' ||
                key === 'app-settings' ||
                key.includes('wallet') ||
                key.includes('blockfrost') ||
                key.includes('theme') ||
                key.includes('onboarding'))
            ) {
              keysToRemove.push(key);
            }
          }

          // Remove all identified keys
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`Removed localStorage key: ${key}`);
          });
        }

        // 5. Completely nuke all IndexedDB databases - delete all related databases
        if (typeof indexedDB !== 'undefined') {
          const databasesToDelete = ['cardano-wallet-db', 'cardano-wallet', 'cardano-wallet-dev'];

          for (const dbName of databasesToDelete) {
            try {
              await new Promise<void>((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(dbName);
                deleteReq.onsuccess = () => {
                  console.log(`IndexedDB ${dbName} deleted successfully`);
                  resolve();
                };
                deleteReq.onerror = () => {
                  console.warn(`Failed to delete IndexedDB ${dbName}`);
                  resolve(); // Continue with other databases
                };
                deleteReq.onblocked = () => {
                  console.warn(`IndexedDB ${dbName} deletion blocked - may need to close other tabs`);
                  // Force close any open connections
                  setTimeout(() => resolve(), 1000);
                };
              });
            } catch (error) {
              console.warn(`Error deleting IndexedDB ${dbName}:`, error);
            }
          }
        }

        // 6. Clear Chrome extension storage (if available)
        if (typeof chrome !== 'undefined' && chrome.storage) {
          try {
            await chrome.storage.local.clear();
            await chrome.storage.sync.clear();
            console.log('Chrome storage cleared successfully');
          } catch (error) {
            console.warn('Error clearing Chrome storage:', error);
          }
        }

        // 7. Reload the extension to show onboarding screen immediately
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            // Close the popup window
            window.close();
            // Reload the extension
            chrome.runtime.reload();
          } catch (error) {
            console.warn('Could not reload extension:', error);
            // Fallback: reload the current window
            window.location.reload();
          }
        } else {
          // Fallback for development or when chrome APIs are not available
          window.location.reload();
        }
      } catch (error) {
        console.error('Error during reset:', error);
        alert('Error occurred during reset. Please try again.');
      }
    }
  };

  if (!settings) {
    return null;
  }

  const mainnetKeyExists = !!settings.mainnetApiKey;
  const preprodKeyExists = !!settings.preprodApiKey;

  return (
    <div className="flex flex-col space-y-6">
      {/* General Settings */}
      <div>
        <h2 className="mb-2 text-lg font-medium">General</h2>
        <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow dark:bg-gray-700">
          <span className="font-medium">Theme</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Blockfrost API Keys Section */}
      <div>
        <h2 className="mb-1 text-lg font-medium">Blockfrost API Keys</h2>
        <a
          href="https://blockfrost.io/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 inline-block text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          Get API Key here
        </a>
        <div className="flex flex-col space-y-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
          {/* --- Mainnet API Key --- */}
          <div>
            {mainnetKeyExists ? (
              // --- DISPLAY MODE ---
              <div className="flex items-center space-x-2">
                <div className="grow">
                  <FloatingLabelInput
                    label="Mainnet API Key"
                    name="mainnetApiKey_display"
                    value={maskApiKey(settings.mainnetApiKey || '')}
                    disabled={true}
                  />
                </div>
                <button type="button" onClick={() => handleDelete('Mainnet')} className="p-1">
                  <TrashIcon className="size-5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              // --- INPUT MODE ---
              <Formik
                initialValues={{ mainnetInput: '' }}
                validate={values => {
                  if (values.mainnetInput && !isValidBlockfrostKey(values.mainnetInput, 'Mainnet')) {
                    return { mainnetInput: 'Invalid API key format' };
                  }
                  return {};
                }}
                // --- START OF CHANGE ---
                onSubmit={values => {
                  // This is triggered by the "Enter" key
                  if (isValidBlockfrostKey(values.mainnetInput, 'Mainnet')) {
                    settingsStorage.setMainnetApiKey(values.mainnetInput);
                  }
                }}>
                {/* --- END OF CHANGE --- */}
                {({ values, errors, handleBlur }) => (
                  <Form>
                    <Field name="mainnetInput">
                      {({ field }: any) => (
                        <FloatingLabelInput
                          {...field}
                          // This is triggered by defocusing (clicking away)
                          onBlur={e => {
                            handleBlur(e);
                            if (isValidBlockfrostKey(field.value, 'Mainnet')) {
                              settingsStorage.setMainnetApiKey(field.value);
                            }
                          }}
                          label="Mainnet API Key"
                          type="password"
                          error={!!errors.mainnetInput}
                        />
                      )}
                    </Field>
                    <div className="h-4 px-1 pt-1 text-xs">
                      {errors.mainnetInput ? (
                        <span className="text-red-500">{errors.mainnetInput}</span>
                      ) : (
                        values.mainnetInput && <span className="text-green-500">Correct format</span>
                      )}
                    </div>
                  </Form>
                )}
              </Formik>
            )}
          </div>

          {/* --- Preprod API Key --- */}
          <div>
            {preprodKeyExists ? (
              // --- DISPLAY MODE ---
              <div className="flex items-center space-x-2">
                <div className="grow">
                  <FloatingLabelInput
                    label="Preprod API Key"
                    name="preprodApiKey_display"
                    value={maskApiKey(settings.preprodApiKey || '')}
                    disabled={true}
                  />
                </div>
                <button type="button" onClick={() => handleDelete('Preprod')} className="p-1">
                  <TrashIcon className="size-5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              // --- INPUT MODE ---
              <Formik
                initialValues={{ preprodInput: '' }}
                validate={values => {
                  if (values.preprodInput && !isValidBlockfrostKey(values.preprodInput, 'Preprod')) {
                    return { preprodInput: 'Invalid API key format' };
                  }
                  return {};
                }}
                // --- START OF CHANGE ---
                onSubmit={values => {
                  // This is triggered by the "Enter" key
                  if (isValidBlockfrostKey(values.preprodInput, 'Preprod')) {
                    settingsStorage.setPreprodApiKey(values.preprodInput);
                  }
                }}>
                {/* --- END OF CHANGE --- */}
                {({ values, errors, handleBlur }) => (
                  <Form>
                    <Field name="preprodInput">
                      {({ field }: any) => (
                        <FloatingLabelInput
                          {...field}
                          // This is triggered by defocusing (clicking away)
                          onBlur={e => {
                            handleBlur(e);
                            if (isValidBlockfrostKey(field.value, 'Preprod')) {
                              settingsStorage.setPreprodApiKey(field.value);
                            }
                          }}
                          label="Preprod API Key"
                          type="password"
                          error={!!errors.preprodInput}
                        />
                      )}
                    </Field>
                    <div className="h-4 px-1 pt-1 text-xs">
                      {errors.preprodInput ? (
                        <span className="text-red-500">{errors.preprodInput}</span>
                      ) : (
                        values.preprodInput && <span className="text-green-500">Correct format</span>
                      )}
                    </div>
                  </Form>
                )}
              </Formik>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone (unchanged) */}
      <div>
        <h2 className="mb-2 text-lg font-medium text-red-500">Danger Zone</h2>
        <div className="rounded-lg bg-white shadow dark:bg-gray-700">
          <button
            onClick={() => setIsDangerZoneOpen(!isDangerZoneOpen)}
            className="flex w-full items-center justify-between p-4 font-medium text-red-500">
            <span>Reset Application Data</span>
            {isDangerZoneOpen ? <ChevronUpIcon className="size-5" /> : <ChevronDownIcon className="size-5" />}
          </button>
          {isDangerZoneOpen && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Resetting will delete all wallets and application data permanently.
              </p>
              <div className="pt-4">
                <CancelButton onClick={handleResetOnboarding}>Reset All Data</CancelButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
