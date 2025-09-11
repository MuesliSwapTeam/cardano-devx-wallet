import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FormikHelpers } from 'formik';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

import { PrimaryButton, SecondaryButton, CancelButton } from '@src/components/buttons';
import FloatingLabelInput from '@src/components/FloatingLabelInput'; // Make sure this path is correct
import NetworkToggle from '@src/components/NetworkToggle';
import { onboardingStorage, useStorage } from '@extension/storage';
import { generateRootKeyFromMnemonic, deriveAddressFromMnemonic } from '../utils/crypto';

// Simple fuzzy search function
const fuzzySearch = (query, words) => {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  // Exact matches first, then starts with, then includes
  const exactMatches = words.filter(word => word === lowerQuery);
  const startsWithMatches = words.filter(word => word !== lowerQuery && word.startsWith(lowerQuery));
  const includesMatches = words.filter(word => !word.startsWith(lowerQuery) && word.includes(lowerQuery));

  return [...exactMatches, ...startsWithMatches, ...includesMatches];
};

// Function to highlight matching text in suggestions
const highlightMatch = (word, query) => {
  if (!query.trim()) return word;

  const lowerWord = word.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerWord.indexOf(lowerQuery);

  if (index === -1) return word;

  return (
    <>
      {word.substring(0, index)}
      <span className="font-bold">{word.substring(index, index + query.length)}</span>
      {word.substring(index + query.length)}
    </>
  );
};

const ImportNewWallet = () => {
  const [step, setStep] = useState(1);
  const [wordCount, setWordCount] = useState(15);
  const [suggestions, setSuggestions] = useState({});
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState({});
  const [BIP39_WORDS, setBIP39_WORDS] = useState<string[]>([]);
  const [scrollStates, setScrollStates] = useState({});
  const [validWords, setValidWords] = useState({});

  const navigate = useNavigate();
  const onboardingState = useStorage(onboardingStorage);

  // Initialize onboarding state
  useEffect(() => {
    const initOnboarding = async () => {
      if (!onboardingState?.isActive) {
        await onboardingStorage.startOnboarding('import');
      }
      await onboardingStorage.setCurrentFlow('import');
      await onboardingStorage.goToStep('import-form');
      await onboardingStorage.setCurrentRoute('/import-wallet-from-seed-phrase');
    };
    initOnboarding();
  }, []);

  // Load word list from file
  useEffect(() => {
    const BIP39_WORDSurl = chrome.runtime.getURL('BIP39_WORDS.txt');
    console.log('BIP39_WORDSurl', BIP39_WORDSurl);

    fetch(BIP39_WORDSurl)
      .then(response => response.text())
      .then(text => {
        const words = text
          .split('\n')
          .map(word => word.trim())
          .filter(word => word.length > 0);
        setBIP39_WORDS(words);
      })
      .catch(error => {
        console.error('Error loading word list:', error);
      });
  }, []);

  // Create validation schema dynamically based on word count and current step
  const createValidationSchema = (count, currentStep) => {
    const schema = {};

    // Step 2 validation - only validate seed words when on step 2 or 3
    if (currentStep >= 2) {
      for (let i = 0; i < count; i++) {
        schema[`word_${i}`] = Yup.string().required().oneOf(BIP39_WORDS, 'Invalid word');
      }
    }

    // Step 3 validation - only validate wallet details when on step 3
    if (currentStep >= 3) {
      schema.walletName = Yup.string().required('Wallet name is required');
      schema.network = Yup.string()
        .oneOf(['Mainnet', 'Preprod'], 'Please select a valid network')
        .required('Network is required');
      schema.walletPassword = Yup.string().when('skipPassword', {
        is: false,
        then: schema => schema.required('Password is required'),
      });
      schema.confirmPassword = Yup.string().when('skipPassword', {
        is: false,
        then: schema =>
          schema.required('Please confirm your password').oneOf([Yup.ref('walletPassword')], 'Passwords do not match'),
      });
      schema.skipPassword = Yup.boolean();
    }

    return Yup.object(schema);
  };

  // Create initial values dynamically
  const createInitialValues = count => {
    const seedWords = {};

    // Load seed phrase from onboarding state if available
    const savedSeedPhrase = onboardingState?.importFormData.seedPhrase;
    const savedWords = savedSeedPhrase ? savedSeedPhrase.split(' ') : [];

    for (let i = 0; i < count; i++) {
      seedWords[`word_${i}`] = savedWords[i] || '';
    }

    return {
      ...seedWords,
      walletName: onboardingState?.importFormData.walletName || '',
      network: onboardingState?.importFormData.network || 'Preprod',
      walletPassword: onboardingState?.importFormData.password || '',
      confirmPassword: '',
      skipPassword: false,
    };
  };

  const handleWordCountChange = count => {
    setWordCount(count);
    setSuggestions({});
    setActiveSuggestionIndex({});
    setScrollStates({});
    setValidWords({});
  };

  const handleScroll = (e, index) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight;

    setScrollStates(prev => ({
      ...prev,
      [index]: { canScrollUp, canScrollDown },
    }));
  };

  const handleWordChange = (index, value, setFieldValue) => {
    const fieldName = `word_${index}`;
    setFieldValue(fieldName, value);

    // Check if the word is valid and update styling
    const isValidWord = BIP39_WORDS.includes(value.trim().toLowerCase());
    setValidWords(prev => ({ ...prev, [index]: isValidWord }));

    if (value.trim()) {
      const matches = fuzzySearch(value.trim(), BIP39_WORDS);
      setSuggestions(prev => ({ ...prev, [index]: matches }));

      // Reset scroll state and set first item as default selected
      setTimeout(() => {
        const dropdown = document.getElementById(`suggestions-${index}`);
        if (dropdown) {
          const { scrollHeight, clientHeight } = dropdown;
          const canScrollDown = scrollHeight > clientHeight;
          setScrollStates(prev => ({
            ...prev,
            [index]: { canScrollUp: false, canScrollDown },
          }));
        }
      }, 0);

      // Set first suggestion as default active (instead of -1)
      setActiveSuggestionIndex(prev => ({ ...prev, [index]: 0 }));
    } else {
      setSuggestions(prev => ({ ...prev, [index]: [] }));
      setScrollStates(prev => ({ ...prev, [index]: {} }));
      setActiveSuggestionIndex(prev => ({ ...prev, [index]: -1 }));
    }
  };

  const handleSuggestionClick = (index, word, setFieldValue) => {
    const fieldName = `word_${index}`;
    setFieldValue(fieldName, word);
    setSuggestions(prev => ({ ...prev, [index]: [] }));
    setValidWords(prev => ({ ...prev, [index]: true }));

    // Defocus the input
    const input = document.querySelector(`input[name="${fieldName}"]`);
    if (input) {
      input.blur();
    }
  };

  const handleKeyDown = (e, index, setFieldValue) => {
    const currentSuggestions = suggestions[index] || [];
    const currentActive = activeSuggestionIndex[index] ?? -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Loop to beginning if at end
      const newIndex = currentActive < currentSuggestions.length - 1 ? currentActive + 1 : 0;
      setActiveSuggestionIndex(prev => ({ ...prev, [index]: newIndex }));

      // Scroll logic
      setTimeout(() => {
        const dropdown = document.getElementById(`suggestions-${index}`);
        const buttons = dropdown?.querySelectorAll('button');
        if (buttons && buttons[newIndex]) {
          const button = buttons[newIndex];
          const container = dropdown;

          const buttonRect = button.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const indicatorHeight = 24;

          const bottomIndicatorTop = containerRect.bottom - indicatorHeight;
          if (buttonRect.bottom > bottomIndicatorTop) {
            const scrollAmount = buttonRect.bottom - bottomIndicatorTop + 4;
            container.scrollTop += scrollAmount;
          }

          const topIndicatorBottom = containerRect.top + indicatorHeight;
          if (buttonRect.top < topIndicatorBottom) {
            const scrollAmount = topIndicatorBottom - buttonRect.top + 4;
            container.scrollTop -= scrollAmount;
          }
        }
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Loop to end if at beginning
      const newIndex = currentActive > 0 ? currentActive - 1 : currentSuggestions.length - 1;
      setActiveSuggestionIndex(prev => ({ ...prev, [index]: newIndex }));

      // Scroll logic
      setTimeout(() => {
        const dropdown = document.getElementById(`suggestions-${index}`);
        const buttons = dropdown?.querySelectorAll('button');
        if (buttons && buttons[newIndex]) {
          const button = buttons[newIndex];
          const container = dropdown;

          const buttonRect = button.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const indicatorHeight = 24;

          const topIndicatorBottom = containerRect.top + indicatorHeight;
          if (buttonRect.top < topIndicatorBottom) {
            const scrollAmount = topIndicatorBottom - buttonRect.top + 4;
            container.scrollTop -= scrollAmount;
          }

          const bottomIndicatorTop = containerRect.bottom - indicatorHeight;
          if (buttonRect.bottom > bottomIndicatorTop) {
            const scrollAmount = buttonRect.bottom - bottomIndicatorTop + 4;
            container.scrollTop += scrollAmount;
          }
        }
      }, 0);
    } else if (e.key === 'Enter' && currentActive >= 0) {
      e.preventDefault();
      const selectedWord = currentSuggestions[currentActive];
      handleSuggestionClick(index, selectedWord, setFieldValue);
    } else if (e.key === 'Escape') {
      setSuggestions(prev => ({ ...prev, [index]: [] }));
      setActiveSuggestionIndex(prev => ({ ...prev, [index]: -1 }));
    }
  };

  const validateStep2 = values => {
    const emptyFields = [];
    for (let i = 0; i < wordCount; i++) {
      if (!values[`word_${i}`] || !values[`word_${i}`].trim()) {
        emptyFields.push(i);
      }
    }
    return emptyFields.length === 0;
  };

  const handleNext = (values, { setSubmitting }) => {
    if (step === 2 && !validateStep2(values)) {
      setSubmitting(false);
      return;
    }
    setStep(prev => prev + 1);
    setSubmitting(false);
  };

  const handleBack = () => {
    const newStep = Math.max(1, step - 1);
    setStep(newStep);
    // Don't change onboarding storage step for internal navigation within the same form
  };

  const handleImport = async (values: IFormValues, { setSubmitting }: FormikHelpers<IFormValues>) => {
    try {
      const seedPhraseWords = Array.from({ length: wordCount }, (_, i) => values[`word_${i}`]);
      const seedPhrase = seedPhraseWords.join(' ');

      // Save form data to onboarding state
      await onboardingStorage.updateImportFormData({
        walletName: values.walletName,
        seedPhrase: seedPhrase,
        network: values.network,
        password: values.skipPassword ? undefined : values.walletPassword,
      });

      // Derive addresses and generate rootKey from seedPhrase in frontend
      const { address, stakeAddress } = await deriveAddressFromMnemonic(seedPhrase, values.network);
      const rootKey = await generateRootKeyFromMnemonic(seedPhrase);

      const payload = {
        name: values.walletName,
        network: values.network,
        seedPhrase: seedPhrase,
        address: address,
        stakeAddress: stakeAddress,
        password: values.skipPassword ? undefined : values.walletPassword,
        rootKey: rootKey,
      };

      chrome.runtime.sendMessage({ type: 'IMPORT_WALLET', payload }, response => {
        if (chrome.runtime.lastError) {
          console.error('Message sending failed:', chrome.runtime.lastError.message);
        } else if (response?.success) {
          // Mark onboarding as complete and clear form data
          onboardingStorage.goToStep('success');
          onboardingStorage.clearFormData('import');
          alert('Not implemented yet. Redirecting to success anyway.');
          navigate('/import-wallet-from-seed-phrase-success');
        } else {
          console.error('UI: Failed to import wallet:', response?.error);
        }
        setSubmitting(false);
      });
    } catch (error) {
      console.error('UI: Failed to generate rootKey:', error);
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    // Rollback to select-method step
    await onboardingStorage.goToStep('select-method');
    navigate('/add-wallet');
  };

  const stepSubtitle = {
    1: 'Choose Wallet Type',
    2: 'Enter Seed Phrase',
    3: 'Enter Wallet Details',
  }[step];

  return (
    <div className="flex h-full flex-col items-center">
      <h2 className="mb-1 text-xl font-medium">Import Wallet</h2>
      <p className="mb-6 text-sm">
        Step {step}/3 — {stepSubtitle}
      </p>

      <Formik
        initialValues={createInitialValues(wordCount)}
        validationSchema={createValidationSchema(wordCount, step)}
        onSubmit={step === 3 ? handleImport : handleNext}
        enableReinitialize={true}>
        {({ values, errors, touched, setFieldValue, setFieldError, setFieldTouched, isSubmitting }) => (
          <Form className="flex size-full max-w-sm flex-col">
            {/* Step 1: Choose Word Count */}
            {step === 1 && (
              <div className="flex flex-col items-center">
                <p className="mb-4 text-center">How many words does your seed phrase have?</p>
                <div className="flex space-x-4">
                  <SecondaryButton onClick={() => handleWordCountChange(15)}>15 Words</SecondaryButton>
                  <SecondaryButton onClick={() => handleWordCountChange(24)}>24 Words</SecondaryButton>
                </div>
              </div>
            )}

            {/* Step 2: Enter Seed Phrase (Unchanged) */}
            {step === 2 && (
              <div className="w-full">
                <p className="mb-4 text-center">Enter your {wordCount}-word seed phrase</p>
                <div className="relative grid grid-cols-3 gap-2">
                  {Array.from({ length: wordCount }).map((_, idx) => {
                    const fieldName = `word_${idx}`;
                    const hasError = errors[fieldName] && touched[fieldName];
                    const currentSuggestions = suggestions[idx] || [];
                    const activeIndex = activeSuggestionIndex[idx] ?? -1;

                    return (
                      <div key={idx} className="relative">
                        <Field
                          name={fieldName}
                          type="text"
                          className={`w-full rounded border p-1 ${
                            validWords[idx]
                              ? 'border-transparent bg-blue-100'
                              : hasError
                                ? 'border-red-500'
                                : 'border-gray-300'
                          } dark:text-black`}
                          placeholder={`Word ${idx + 1}`}
                          onChange={e => handleWordChange(idx, e.target.value, setFieldValue)}
                          onKeyDown={e => handleKeyDown(e, idx, setFieldValue)}
                          onClick={e => {
                            if (validWords[idx]) {
                              setFieldValue(fieldName, '');
                              setValidWords(prev => ({ ...prev, [idx]: false }));
                            }
                          }}
                          onFocus={e => {
                            if (e.target.value.trim() && !validWords[idx]) {
                              const matches = fuzzySearch(e.target.value.trim(), BIP39_WORDS);
                              setSuggestions(prev => ({ ...prev, [idx]: matches }));
                              setActiveSuggestionIndex(prev => ({ ...prev, [idx]: 0 }));
                              setTimeout(() => {
                                const dropdown = document.getElementById(`suggestions-${idx}`);
                                if (dropdown) {
                                  const { scrollHeight, clientHeight } = dropdown;
                                  const canScrollDown = scrollHeight > clientHeight;
                                  setScrollStates(prev => ({
                                    ...prev,
                                    [idx]: { canScrollUp: false, canScrollDown },
                                  }));
                                }
                              }, 0);
                            }
                          }}
                          onBlur={() => {
                            const currentSuggestions = suggestions[idx] || [];
                            const activeIndex = activeSuggestionIndex[idx] ?? -1;
                            if (currentSuggestions.length > 0 && activeIndex >= 0) {
                              const selectedWord = currentSuggestions[activeIndex];
                              setFieldValue(fieldName, selectedWord);
                              setValidWords(prev => ({ ...prev, [idx]: true }));
                            }
                            setTimeout(() => {
                              setSuggestions(prev => ({ ...prev, [idx]: [] }));
                            }, 200);
                          }}
                          autoComplete="off"
                        />
                        {currentSuggestions.length > 0 && (
                          <div
                            className="absolute z-50 max-h-32 w-full overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg"
                            style={{ top: 'calc(100% + 4px)', left: 0 }}>
                            {scrollStates[idx]?.canScrollUp && (
                              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center bg-white bg-opacity-90 py-1">
                                <div className="size-0 border-x-4 border-b-4 border-x-transparent border-b-gray-400"></div>
                              </div>
                            )}
                            <div
                              id={`suggestions-${idx}`}
                              className="max-h-32 overflow-y-auto"
                              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                              onScroll={e => handleScroll(e, idx)}>
                              {currentSuggestions.map((word, suggestionIdx) => {
                                const isActive = activeIndex === suggestionIdx;
                                return (
                                  <button
                                    key={word}
                                    type="button"
                                    className={`w-full px-3 py-1 text-left text-sm dark:text-black ${
                                      isActive ? 'bg-gray-200' : 'hover:bg-gray-100'
                                    }`}
                                    onMouseDown={e => e.preventDefault()}
                                    onMouseEnter={() => {
                                      setActiveSuggestionIndex(prev => ({ ...prev, [idx]: suggestionIdx }));
                                    }}
                                    onMouseLeave={() => {}}
                                    onClick={() => handleSuggestionClick(idx, word, setFieldValue)}>
                                    {highlightMatch(word, values[fieldName] || '')}
                                  </button>
                                );
                              })}
                            </div>
                            {scrollStates[idx]?.canScrollDown && (
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-white bg-opacity-90 py-1">
                                <div className="size-0 border-x-4 border-t-4 border-x-transparent border-t-gray-400"></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {Object.keys(errors).some(key => key.startsWith('word_') && touched[key]) && (
                  <p className="mt-2 text-center text-sm text-red-500">Please fill out missing words</p>
                )}
              </div>
            )}

            {/* Step 3: Wallet Details (Refactored) */}
            {step === 3 && (
              <div className="w-full">
                {/* Wallet Name Field */}
                <div className="mb-4">
                  <FloatingLabelInput
                    name="walletName"
                    label="Wallet Name"
                    type="text"
                    required
                    error={touched.walletName && errors.walletName}
                  />
                  <ErrorMessage name="walletName" component="p" className="mt-1 text-sm text-red-500" />
                </div>

                {/* Network Selection Field */}
                <div className="mb-4">
                  <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Network <span className="text-red-500">*</span>
                  </label>
                  <NetworkToggle value={values.network} onChange={network => setFieldValue('network', network)} />
                  <ErrorMessage name="network" component="p" className="mt-1 text-xs text-red-500" />
                </div>

                {/* Wallet Password Field */}
                <div className="mb-4">
                  <FloatingLabelInput
                    name="walletPassword"
                    label="Password"
                    type="password"
                    disabled={values.skipPassword}
                    required={!values.skipPassword}
                    error={touched.walletPassword && errors.walletPassword}
                  />
                  <ErrorMessage name="walletPassword" component="p" className="mt-1 text-sm text-red-500" />
                </div>

                {/* Confirm Password Field */}
                <div className="mb-4">
                  <FloatingLabelInput
                    name="confirmPassword"
                    label="Confirm Password"
                    type="password"
                    disabled={values.skipPassword}
                    required={!values.skipPassword}
                    error={touched.confirmPassword && errors.confirmPassword}
                  />
                  <ErrorMessage name="confirmPassword" component="p" className="mt-1 text-sm text-red-500" />
                </div>

                {/* Password Skip Option */}
                <div className="mb-4">
                  <label className="flex cursor-pointer items-center space-x-2">
                    <Field
                      type="checkbox"
                      name="skipPassword"
                      className="size-4"
                      onChange={e => {
                        const checked = e.target.checked;
                        setFieldValue('skipPassword', checked);
                        if (checked) {
                          setFieldValue('walletPassword', '');
                          setFieldValue('confirmPassword', '');
                          setFieldError('walletPassword', undefined);
                          setFieldError('confirmPassword', undefined);
                          setFieldTouched('walletPassword', false);
                          setFieldTouched('confirmPassword', false);
                        }
                      }}
                    />
                    <span className="text-sm">I understand the security risks — create wallet without a password</span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-auto flex justify-center space-x-4">
              <CancelButton type="button" onClick={handleCancel}>
                Cancel
              </CancelButton>
              {step > 1 && (
                <SecondaryButton type="button" onClick={handleBack}>
                  Back
                </SecondaryButton>
              )}
              {step < 3 && (
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  Next
                </PrimaryButton>
              )}
              {step === 3 && (
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  Import
                </PrimaryButton>
              )}
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ImportNewWallet;
