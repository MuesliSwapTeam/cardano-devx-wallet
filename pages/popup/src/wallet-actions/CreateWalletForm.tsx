import { ErrorMessage, Field, Form, Formik } from 'formik';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import * as Yup from 'yup';
import { CancelButton, PrimaryButton } from '@src/components/buttons';
import FloatingLabelInput from '@src/components/FloatingLabelInput';
import NetworkToggle from '@src/components/NetworkToggle';
import { onboardingStorage, settingsStorage, useStorage } from '@extension/storage';
import { createWallet } from '../utils/walletOperations';

const CreateWalletForm = () => {
  const navigate = useNavigate();
  const settings = useStorage(settingsStorage);
  const onboardingState = useStorage(onboardingStorage);

  // Helper function to check if we have the required API key for the network
  const hasRequiredApiKey = (network: 'Mainnet' | 'Preprod') => {
    if (!settings) return false;
    return network === 'Mainnet' ? !!settings.mainnetApiKey : !!settings.preprodApiKey;
  };

  const validationSchema = Yup.object({
    walletName: Yup.string().required('Wallet name is required'),
    network: Yup.string()
      .oneOf(['Mainnet', 'Preprod'], 'Please select a valid network')
      .required('Network is required'),
    walletPassword: Yup.string().when('skipPassword', {
      is: false,
      then: schema => schema.required('Password is required'),
    }),
    confirmPassword: Yup.string().when('skipPassword', {
      is: false,
      then: schema =>
        schema
          .required('Please confirm your password')
          .oneOf([Yup.ref('walletPassword')], 'Passwords do not match. Please check and try again.'),
    }),
    skipPassword: Yup.boolean(),
  });

  const initialValues = {
    walletName: onboardingState?.createFormData.walletName || '',
    network: onboardingState?.createFormData.network || ('Preprod' as 'Mainnet' | 'Preprod'),
    walletPassword: onboardingState?.createFormData.password || '',
    confirmPassword: '',
    skipPassword: false,
  };

  // Initialize onboarding state on component mount
  useEffect(() => {
    const initOnboarding = async () => {
      if (!onboardingState?.isActive) {
        await onboardingStorage.startOnboarding('create');
      }
      await onboardingStorage.setCurrentFlow('create');
      await onboardingStorage.goToStep('create-form');
    };
    initOnboarding();
  }, []);

  const handleSubmit = async (values: any) => {
    try {
      // Save form data to onboarding state
      await onboardingStorage.updateCreateFormData({
        walletName: values.walletName,
        network: values.network,
        password: values.skipPassword ? undefined : values.walletPassword,
      });

      // Check if we have the required API key for the selected network
      if (!hasRequiredApiKey(values.network)) {
        // Update to API key setup step
        await onboardingStorage.goToStep('api-key-setup');
        await onboardingStorage.updateApiKeySetupData({
          network: values.network,
          requiredFor: 'create',
        });

        // Navigate to API key setup step
        navigate('/create-new-wallet/api-key');
        return;
      }

      // We have the API key, proceed with wallet creation
      await createWallet(
        {
          walletName: values.walletName,
          network: values.network,
          password: values.skipPassword ? undefined : values.walletPassword,
        },
        navigate,
      );
    } catch (error) {
      console.error('UI: Failed to generate wallet data:', error);
    }
  };

  const handleCancel = async () => {
    // Rollback to select-method step
    await onboardingStorage.goToStep('select-method');
    navigate('/add-wallet');
  };

  // Loading state
  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center">
      <h2 className="text-xl font-medium">New Wallet</h2>
      <p className="mt-2 text-center text-sm">Create a new wallet!</p>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        enableReinitialize
        onSubmit={handleSubmit}>
        {({ values, errors, touched, setFieldValue, setFieldError, setFieldTouched }) => {
          // Save form data whenever values change
          useEffect(() => {
            if (onboardingState?.isActive) {
              onboardingStorage.updateCreateFormData({
                walletName: values.walletName,
                network: values.network,
                password: values.skipPassword ? undefined : values.walletPassword,
              });
            }
          }, [values.walletName, values.network, values.walletPassword, values.skipPassword]);

          return (
            <Form className="mt-4 flex size-full max-w-sm flex-col">
              {/* Wallet Name Field */}
              <div className="mb-4">
                <FloatingLabelInput
                  name="walletName"
                  label="Wallet Name"
                  type="text"
                  required
                  error={touched.walletName && errors.walletName}
                />
                <ErrorMessage name="walletName" component="p" className="mt-1 text-xs text-red-500" />
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
                <ErrorMessage name="walletPassword" component="p" className="mt-1 text-xs text-red-500" />
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
                <ErrorMessage name="confirmPassword" component="p" className="mt-1 text-xs text-red-500" />
              </div>

              {/* Password Skip Option */}
              <div className="mb-4">
                <div className="flex items-start">
                  <Field
                    type="checkbox"
                    id="skipPassword"
                    name="skipPassword"
                    className="mr-2 mt-0.5 size-4"
                    onChange={(e: any) => {
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
                  <label htmlFor="skipPassword" className="block text-left text-xs">
                    Create wallet without a password. I understand the security risks.
                  </label>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="mt-auto flex justify-center space-x-4">
                <CancelButton type="button" onClick={handleCancel}>
                  Cancel
                </CancelButton>
                <PrimaryButton type="submit">Create</PrimaryButton>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default CreateWalletForm;
