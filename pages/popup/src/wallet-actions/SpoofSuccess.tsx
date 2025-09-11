// popup/src/pages/wallet-actions/SpoofSuccess.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsStorage, onboardingStorage } from '@extension/storage';
import { PrimaryButton, SecondaryButton } from '@src/components/buttons';

function SpoofSuccess() {
  const navigate = useNavigate();

  // Set onboarding progress to 100% when component mounts
  useEffect(() => {
    onboardingStorage.updateProgress(100);
  }, []);

  const handleFinishOnboardingClick = async () => {
    await settingsStorage.markOnboarded();
    await onboardingStorage.completeOnboarding();
    navigate('/', { replace: true });
  };

  const handleExportAccountClick = () => {
    alert('Export Account not implemented yet.');
  };

  return (
    <div className="flex h-full flex-col items-center text-center">
      <div className="flex grow flex-col items-center justify-center">
        <div className="mb-4 flex flex-row items-center font-bold text-green-600">
          <h2 className="mt-2 text-3xl">SUCCESS</h2>
        </div>
        <p className="mb-4">You successfully spoofed the wallet.</p>
        <p className="mb-4 text-center text-sm text-gray-500">
          Export the account at any time in the settings. This does not include a seed phrase.
        </p>
      </div>

      <div className="mt-auto flex w-full flex-col items-center space-y-2">
        <SecondaryButton onClick={handleExportAccountClick} className="w-4/5">
          Export Account
        </SecondaryButton>
        <div className="flex w-full justify-center pt-4">
          <PrimaryButton onClick={handleFinishOnboardingClick} className="w-4/5">
            Finish Onboarding
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default SpoofSuccess;
