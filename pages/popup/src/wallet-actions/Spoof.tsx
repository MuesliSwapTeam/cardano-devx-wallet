import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, ErrorMessage, Field } from 'formik';
import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { PrimaryButton, CancelButton } from '@src/components/buttons';
import FloatingLabelInput from '@src/components/FloatingLabelInput';
import NetworkToggle from '@src/components/NetworkToggle';
import ApiKeySetup from '@src/components/ApiKeySetup';
import { settingsStorage, useStorage, onboardingStorage } from '@extension/storage';

interface IFormValues {
  walletName: string;
  walletAddress: string;
  network: 'Mainnet' | 'Preprod';
}

const SpoofWallet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useStorage(settingsStorage);
  const onboardingState = useStorage(onboardingStorage);
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<IFormValues | null>(null);

  // Check if we should show API key setup based on route query
  const urlParams = new URLSearchParams(location.search);
  const shouldShowApiKeySetup = urlParams.get('step') === 'api-key-setup';

  const validationSchema = Yup.object({
    walletName: Yup.string().required('Wallet name is required.'),
    network: Yup.string()
      .oneOf(['Mainnet', 'Preprod'], 'Please select a valid network')
      .required('Network is required'),
    walletAddress: Yup.string()
      .required('Wallet address is required.')
      .min(20, 'Address is too short')
      .max(150, 'Address is too long')
      .test('address-format', 'Invalid address format for selected network', function (value) {
        if (!value) return false;
        const { network } = this.parent as IFormValues;

        if (network === 'Mainnet') {
          return value.startsWith('addr1');
        } else {
          // Preprod addresses can start with either 'addr_test1' or 'preprod'
          return value.startsWith('addr_test1') || value.startsWith('preprod');
        }
      }),
  });

  // Load initial values from onboarding state or use defaults
  const initialValues: IFormValues = {
    walletName: onboardingState?.spoofFormData.walletName || '',
    walletAddress: onboardingState?.spoofFormData.walletAddress || '',
    network: onboardingState?.spoofFormData.network || 'Preprod',
  };

  // Initialize onboarding state and update progress on component mount
  useEffect(() => {
    const initOnboarding = async () => {
      if (!onboardingState?.isActive) {
        await onboardingStorage.startOnboarding('spoof');
      }
      await onboardingStorage.setCurrentFlow('spoof');

      // Set appropriate step and route based on URL parameter
      if (shouldShowApiKeySetup) {
        await onboardingStorage.goToStep('api-key-setup');
        await onboardingStorage.setCurrentRoute('/spoof-wallet?step=api-key-setup');
        setShowApiKeySetup(true);
        // Restore form values if they exist
        if (onboardingState?.spoofFormData.walletName && onboardingState?.spoofFormData.walletAddress) {
          setPendingFormValues({
            walletName: onboardingState.spoofFormData.walletName,
            walletAddress: onboardingState.spoofFormData.walletAddress,
            network: onboardingState.spoofFormData.network || 'Preprod',
          });
        }
      } else {
        await onboardingStorage.goToStep('spoof-form');
        await onboardingStorage.setCurrentRoute('/spoof-wallet');
      }
    };
    initOnboarding();
  }, [shouldShowApiKeySetup]);

  const handleCancel = async () => {
    // Rollback to select-method step
    await onboardingStorage.goToStep('select-method');
    navigate('/add-wallet');
  };

  const hasRequiredApiKey = (network: 'Mainnet' | 'Preprod') => {
    if (!settings) return false;
    return network === 'Mainnet' ? !!settings.mainnetApiKey : !!settings.preprodApiKey;
  };

  const handleFormSubmit = async (
    values: IFormValues,
    actions: {
      setSubmitting: (isSubmitting: boolean) => void;
      setFieldError: (field: string, message: string) => void;
    },
  ) => {
    // Save form data to onboarding state
    await onboardingStorage.updateSpoofFormData(values);

    // Check if we have the required API key for the selected network
    if (!hasRequiredApiKey(values.network)) {
      // Store form values and show API key setup
      setPendingFormValues(values);
      setShowApiKeySetup(true);
      actions.setSubmitting(false);

      // Update to API key setup step and set a special route for API key within spoof
      await onboardingStorage.goToStep('api-key-setup');
      await onboardingStorage.setCurrentRoute('/spoof-wallet?step=api-key-setup');
      await onboardingStorage.updateApiKeySetupData({
        network: values.network,
        requiredFor: 'spoof',
      });
      return;
    }

    // We have the API key, proceed with spoofing
    submitSpoofWallet(values, actions);
  };

  const submitSpoofWallet = (
    values: IFormValues,
    actions: {
      setSubmitting: (isSubmitting: boolean) => void;
      setFieldError: (field: string, message: string) => void;
    },
  ) => {
    const payload = {
      name: values.walletName,
      address: values.walletAddress,
      network: values.network,
    };

    console.log('Spoofing wallet with payload:', payload);

    chrome.runtime.sendMessage(
      {
        type: 'SPOOF_WALLET',
        payload: payload,
      },
      response => {
        actions.setSubmitting(false);

        if (chrome.runtime.lastError) {
          actions.setFieldError('walletAddress', 'An unexpected error occurred. Please try again.');
          return;
        }

        if (response?.success) {
          // Mark onboarding as complete and clear form data
          onboardingStorage.goToStep('success');
          onboardingStorage.clearFormData('spoof');
          navigate('/spoof-wallet-success');
        } else {
          console.log('Spoof wallet response error:', response?.error);
          actions.setFieldError('walletAddress', response?.error || 'Failed to spoof wallet.');
        }
      },
    );
  };

  const handleApiKeySetupComplete = async () => {
    setShowApiKeySetup(false);

    // Go back to spoof form step and update route
    await onboardingStorage.goToStep('spoof-form');
    await onboardingStorage.setCurrentRoute('/spoof-wallet');

    // Navigate back to clean spoof route
    navigate('/spoof-wallet', { replace: true });

    // If we have pending form values, submit the spoof wallet now
    if (pendingFormValues) {
      const mockActions = {
        setSubmitting: (_isSubmitting: boolean) => {},
        setFieldError: (field: string, error: string) => {
          console.error(`Field error on ${field}: ${error}`);
        },
      };
      submitSpoofWallet(pendingFormValues, mockActions);
      setPendingFormValues(null);
    }
  };

  const handleApiKeySetupCancel = async () => {
    setShowApiKeySetup(false);
    setPendingFormValues(null);

    // Go back to spoof form step and update route
    await onboardingStorage.goToStep('spoof-form');
    await onboardingStorage.setCurrentRoute('/spoof-wallet');

    // Navigate back to clean spoof route
    navigate('/spoof-wallet', { replace: true });
  };

  // Loading state
  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Show API key setup screen if needed
  if ((showApiKeySetup || shouldShowApiKeySetup) && (pendingFormValues || shouldShowApiKeySetup)) {
    const networkForApiKey = pendingFormValues?.network || onboardingState?.spoofFormData.network || 'Preprod';
    return (
      <ApiKeySetup
        network={networkForApiKey}
        onComplete={handleApiKeySetupComplete}
        onCancel={handleApiKeySetupCancel}
        title="API Key Required for Spoof Wallet"
        subtitle={`Please enter your ${networkForApiKey} API key to continue creating the spoof wallet.`}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center">
      <h2 className="text-xl font-medium">Spoof Wallet</h2>
      <p className="mt-2 text-center text-sm">Create a wallet with a custom address for testing!</p>

      <Formik<IFormValues>
        initialValues={initialValues}
        validationSchema={validationSchema}
        enableReinitialize
        onSubmit={handleFormSubmit}>
        {({ values, errors, touched, isSubmitting, setFieldValue }) => {
          // Save form data whenever values change
          useEffect(() => {
            if (onboardingState?.isActive) {
              onboardingStorage.updateSpoofFormData(values);
            }
          }, [values]);

          return (
            <Form className="mt-4 flex size-full max-w-sm flex-col">
              <div className="mb-4">
                <Field
                  name="walletName"
                  as={FloatingLabelInput}
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

                {/* API Key Status Indicator */}
                <div className="mt-2 text-xs">
                  {hasRequiredApiKey(values.network) ? (
                    <span className="text-green-600 dark:text-green-400">✓ {values.network} API key configured</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      ⚠ {values.network} API key required (will be requested)
                    </span>
                  )}
                </div>

                <ErrorMessage name="network" component="p" className="mt-1 text-xs text-red-500" />
              </div>

              <div className="mb-4">
                <Field
                  name="walletAddress"
                  as={FloatingLabelInput}
                  label="Wallet Address"
                  type="text"
                  required
                  error={touched.walletAddress && errors.walletAddress}
                />
                <ErrorMessage name="walletAddress" component="p" className="mt-1 text-sm text-red-500" />
              </div>

              <div className="mt-auto flex justify-center space-x-4">
                <CancelButton type="button" onClick={handleCancel}>
                  Cancel
                </CancelButton>
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Spoofing...' : 'Spoof Wallet'}
                </PrimaryButton>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default SpoofWallet;
