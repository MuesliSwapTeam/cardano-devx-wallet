import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '@src/components/buttons';
import { onboardingStorage } from '@extension/storage';

const AddWallet = () => {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);

  // Set onboarding state when this screen loads
  useEffect(() => {
    const updateOnboardingState = async () => {
      await onboardingStorage.goToStep('select-method');
    };
    updateOnboardingState();
  }, []);

  return (
    <div className="flex h-full flex-col items-center">
      {/* Title & Subtitle */}
      <h2 className="text-xl font-medium">Add Wallet</h2>
      <p className="mt-2">Create/spoof a new wallet or import an existing account!</p>

      {/* New Wallet Section */}
      <div className="mt-10 w-full items-center">
        <div className="mt-2 flex justify-center">
          <PrimaryButton onClick={() => navigate('/create-new-wallet')} className="w-3/5">
            Create New Wallet
          </PrimaryButton>
        </div>
      </div>

      <h3 className="text-white-500 mt-10 text-center text-base">or</h3>

      {/* Existing Wallet Section */}
      <div className="mt-10 flex w-full flex-col items-center space-y-4">
        <SecondaryButton onClick={() => navigate('/import-wallet')} className="w-3/5">
          Import from Seed Phrase
        </SecondaryButton>

        <SecondaryButton onClick={() => alert('not implemented')} className="w-3/5">
          Import from DevX File
        </SecondaryButton>

        <div className="relative flex w-3/5 items-center">
          <SecondaryButton onClick={() => navigate('/spoof-wallet')} className="w-full">
            Spoof Wallet
          </SecondaryButton>

          {/* Help Icon positioned absolute to the right */}
          <div
            className="absolute right-[-24px] flex size-4 cursor-help items-center justify-center rounded-full border border-black bg-transparent text-black dark:border-white dark:text-white"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}>
            ?
          </div>

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute right-[-42px] top-[-77px] z-10 w-64 rounded bg-gray-800 p-2 text-white shadow-lg dark:border dark:border-white">
              <p className="text-sm">
                Spoof an existing wallet, giving you read-only access to its funds and transactions.
              </p>
              <div className="absolute bottom-[-6px] right-[20px] size-3 rotate-45 bg-gray-800 dark:border-b dark:border-r dark:border-b-white dark:border-r-white"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddWallet;
