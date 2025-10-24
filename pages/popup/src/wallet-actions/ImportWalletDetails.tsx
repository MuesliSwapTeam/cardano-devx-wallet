import { useNavigate } from 'react-router-dom';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { CancelButton, PrimaryButton, SecondaryButton } from '@src/components/buttons';
import FloatingLabelInput from '@src/components/FloatingLabelInput';
import NetworkToggle from '@src/components/NetworkToggle';
import { onboardingStorage, settingsStorage, useStorage } from '@extension/storage';
import { importWallet } from '../utils/walletOperations';

const ImportWalletDetails = () => {
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
        schema.required('Please confirm your password').oneOf([Yup.ref('walletPassword')], 'Passwords do not match'),
    }),
    skipPassword: Yup.boolean(),
  });

  const initialValues = {
    walletName: onboardingState?.importFormData.walletName || '',
    network: onboardingState?.importFormData.network || 'Preprod',
    walletPassword: onboardingState?.importFormData.password || '',
    confirmPassword: '',
    skipPassword: false,
  };

  const handleImport = async (values: any, { setSubmitting }: any) => {
    try {
      // Get saved seed phrase from storage
      const savedSeedWords = onboardingState?.importFormData.seedWords || {};
      const wordCount = onboardingState?.importFormData.wordCount || 15;

      const seedPhraseWords = Array.from({ length: wordCount }, (_, i) => savedSeedWords[`word_${i}`] || '');
      const seedPhrase = seedPhraseWords.join(' ');

      // Save form data to onboarding state
      await onboardingStorage.updateImportFormData({
        walletName: values.walletName,
        seedPhrase: seedPhrase,
        network: values.network,
        password: values.skipPassword ? undefined : values.walletPassword,
      });

      // Check if we have the required API key for the selected network
      if (!hasRequiredApiKey(values.network)) {
        setSubmitting(false);

        // Update to API key setup step
        await onboardingStorage.goToStep('api-key-setup');
        await onboardingStorage.updateApiKeySetupData({
          network: values.network,
          requiredFor: 'import',
        });

        // Navigate to API key setup step
        navigate('/import-wallet/api-key');
        return;
      }

      // We have the API key, proceed with import
      await importWallet(
        {
          walletName: values.walletName,
          network: values.network,
          password: values.skipPassword ? undefined : values.walletPassword,
          seedPhrase: seedPhrase,
        },
        navigate,
      );
      setSubmitting(false);
    } catch (error) {
      console.error('UI: Failed to generate rootKey:', error);
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    const wordCount = onboardingState?.importFormData.wordCount || 15;
    navigate(`/import-wallet/enter/${wordCount}`);
  };

  const handleCancel = async () => {
    // Rollback to select-method step
    await onboardingStorage.goToStep('select-method');
    navigate('/add-wallet');
  };

  return (
    <div className="flex h-full flex-col items-center">
      <h2 className="mb-1 text-xl font-medium">Import Wallet</h2>
      <p className="mb-6 text-sm">Step 3/3 — Enter Wallet Details</p>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleImport}
        enableReinitialize={true}>
        {({ values, errors, touched, setFieldValue, setFieldError, setFieldTouched, isSubmitting }) => (
          <Form className="flex size-full max-w-sm flex-col">
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
                  <span className="text-sm">I understand the security risks — create wallet without a password</span>
                </label>
              </div>
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
                Import
              </PrimaryButton>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ImportWalletDetails;
