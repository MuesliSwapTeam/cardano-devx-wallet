import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton } from '@src/components/buttons';

const NoWallets = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center text-center p-6">
      <div className="mb-8">
        <div className="mb-4 flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <svg
              className="size-8 text-orange-600 dark:text-orange-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>
        <h2 className="mb-4 text-2xl font-bold">No Wallets Found</h2>
        <p className="text-gray-600 dark:text-gray-300">
          You completed the onboarding but there are no wallets in your account.
        </p>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Please add a wallet to get started.</p>
      </div>
      <PrimaryButton onClick={() => navigate('/add-wallet')} className="w-full max-w-xs">
        Add Wallet
      </PrimaryButton>
    </div>
  );
};

export default NoWallets;
