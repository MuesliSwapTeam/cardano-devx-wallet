import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { PrimaryButton, SecondaryButton, CancelButton } from '@src/components/buttons';
import { onboardingStorage, useStorage } from '@extension/storage';

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

const ImportEnterPhrase = () => {
  const { words } = useParams();
  const navigate = useNavigate();
  const onboardingState = useStorage(onboardingStorage);

  const wordCount = parseInt(words) || 15;
  const [suggestions, setSuggestions] = useState({});
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState({});
  const [BIP39_WORDS, setBIP39_WORDS] = useState<string[]>([]);
  const [scrollStates, setScrollStates] = useState({});
  const [validWords, setValidWords] = useState({});

  // Load word list from file
  useEffect(() => {
    const BIP39_WORDSurl = chrome.runtime.getURL('BIP39_WORDS.txt');

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

  // Create validation schema dynamically based on word count
  const createValidationSchema = count => {
    const schema = {};
    for (let i = 0; i < count; i++) {
      schema[`word_${i}`] = Yup.string().required().oneOf(BIP39_WORDS, 'Invalid word');
    }
    return Yup.object(schema);
  };

  // Create initial values dynamically
  const createInitialValues = count => {
    const seedWords = {};

    // Load individual words from onboarding state if available
    const savedSeedWords = onboardingState?.importFormData.seedWords || {};

    for (let i = 0; i < count; i++) {
      seedWords[`word_${i}`] = savedSeedWords[`word_${i}`] || '';
    }

    return seedWords;
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

  const handlePaste = async (e, setFieldValue) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const words = pastedText
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);

    // Check if word count matches
    if (words.length !== wordCount) {
      alert(
        `Your seed phrase seems to be ${words.length} words but you chose ${wordCount} words. Please go back and choose the right option.`,
      );
      return;
    }

    // Validate all words against BIP39 word list
    const invalidWords = words.filter(word => !BIP39_WORDS.includes(word.toLowerCase()));
    if (invalidWords.length > 0) {
      alert(`Invalid words found in seed phrase: ${invalidWords.join(', ')}. Please check your seed phrase.`);
      return;
    }

    // Fill in all the words
    const seedWordsObject = {};
    words.forEach((word, index) => {
      const fieldName = `word_${index}`;
      setFieldValue(fieldName, word.toLowerCase());
      setValidWords(prev => ({ ...prev, [index]: true }));
      seedWordsObject[fieldName] = word.toLowerCase();
    });

    // Save all words to onboarding storage
    await onboardingStorage.updateImportFormData({
      seedWords: seedWordsObject,
    });

    // Clear any suggestions
    setSuggestions({});
    setActiveSuggestionIndex({});
    setScrollStates({});

    // Force trigger validation to clear any error states
    setTimeout(() => {
      words.forEach((_, index) => {
        const fieldName = `word_${index}`;
        const input = document.querySelector(`input[name="${fieldName}"]`);
        if (input) {
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      });
    }, 100);
  };

  const handleWordChange = async (index, value, setFieldValue) => {
    const fieldName = `word_${index}`;
    setFieldValue(fieldName, value);

    // Check if the word is valid and update styling
    const isValidWord = BIP39_WORDS.includes(value.trim().toLowerCase());
    setValidWords(prev => ({ ...prev, [index]: isValidWord }));

    // Save individual word to onboarding storage
    const currentSeedWords = onboardingState?.importFormData.seedWords || {};
    await onboardingStorage.updateImportFormData({
      seedWords: {
        ...currentSeedWords,
        [fieldName]: value,
      },
    });

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
    if (!validateStep2(values)) {
      setSubmitting(false);
      return;
    }

    // Navigate to wallet details step
    navigate('/import-wallet/details');
    setSubmitting(false);
  };

  const handleBack = () => {
    navigate('/import-wallet');
  };

  const handleCancel = async () => {
    // Rollback to select-method step
    await onboardingStorage.goToStep('select-method');
    navigate('/add-wallet');
  };

  const handleClearWords = async setFieldValue => {
    // Clear all word fields
    for (let i = 0; i < wordCount; i++) {
      const fieldName = `word_${i}`;
      setFieldValue(fieldName, '');
    }

    // Clear validation states
    setValidWords({});
    setSuggestions({});
    setActiveSuggestionIndex({});
    setScrollStates({});

    // Clear from onboarding storage
    await onboardingStorage.updateImportFormData({
      seedWords: {},
    });
  };

  // Check if any words are filled
  const hasFilledWords = values => {
    for (let i = 0; i < wordCount; i++) {
      if (values[`word_${i}`] && values[`word_${i}`].trim()) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="flex h-full flex-col items-center">
      <h2 className="mb-1 text-xl font-medium">Import Wallet</h2>
      <p className="mb-6 text-sm">Step 2/3 — Enter Seed Phrase</p>

      <Formik
        initialValues={createInitialValues(wordCount)}
        validationSchema={createValidationSchema(wordCount)}
        onSubmit={handleNext}
        enableReinitialize={true}>
        {({ values, errors, touched, setFieldValue, isSubmitting }) => (
          <Form className="flex size-full max-w-sm flex-col">
            <div className="w-full">
              <p className="mb-2 text-center">Enter your {wordCount}-word seed phrase</p>
              <p className="mb-4 text-center text-xs text-gray-500">
                Tip: You can paste your entire seed phrase into any field to auto-fill all words
              </p>
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
                        onPaste={e => handlePaste(e, setFieldValue)}
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

              {/* Clear button - only show if any words are filled */}
              {hasFilledWords(values) && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleClearWords(setFieldValue)}
                    className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                    Clear All Words
                  </button>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-auto flex justify-center space-x-4">
              <CancelButton type="button" onClick={handleCancel}>
                Cancel
              </CancelButton>
              <SecondaryButton type="button" onClick={handleBack}>
                Back
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={isSubmitting}>
                Next
              </PrimaryButton>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ImportEnterPhrase;
