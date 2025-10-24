import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { onboardingStorage, useStorage } from '@extension/storage';
import { SecondaryButton } from '@src/components/buttons';

const ImportSelectWords = () => {
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
    };
    initOnboarding();
  }, []);

  const handleWordCountChange = async (count: number) => {
    // Save word count to onboarding storage
    await onboardingStorage.updateImportFormData({
      wordCount: count,
      seedWords: {}, // Clear existing words when changing count
    });

    // Navigate to enter phrase step with word count
    navigate(`/import-wallet/enter/${count}`);
  };

  return (
    <div className="flex h-full flex-col items-center">
      <h2 className="mb-1 text-xl font-medium">Import Wallet</h2>
      <p className="mb-6 text-sm">Step 1/3 — Choose Wallet Type</p>

      <div className="flex flex-col items-center">
        <p className="mb-4 text-center">How many words does your seed phrase have?</p>
        <div className="flex space-x-4">
          <SecondaryButton onClick={() => handleWordCountChange(15)}>15 Words</SecondaryButton>
          <SecondaryButton onClick={() => handleWordCountChange(24)}>24 Words</SecondaryButton>
        </div>
      </div>
    </div>
  );
};

export default ImportSelectWords;
