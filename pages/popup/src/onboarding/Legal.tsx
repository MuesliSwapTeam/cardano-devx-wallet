import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Import the unified settingsStorage
import { settingsStorage, onboardingStorage } from '@extension/storage';
import { PrimaryButton } from '@src/components/buttons';

/**
 * Legal is the component that shows the legal disclaimers
 * and terms of service links during onboarding.
 */
function Legal() {
  const navigate = useNavigate();
  const warningIconUrl = chrome.runtime.getURL('warning.svg');
  const [countdown, setCountdown] = useState(3);
  const [buttonEnabled, setButtonEnabled] = useState(false);

  // Initialize onboarding state and start countdown on component mount
  useEffect(() => {
    const initOnboarding = async () => {
      await onboardingStorage.goToStep('legal');
    };
    initOnboarding();

    const timer = setInterval(() => {
      setCountdown(prevCount => {
        if (prevCount <= 1) {
          clearInterval(timer);
          setButtonEnabled(true);
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);

    // Clean up timer on unmount
    return () => clearInterval(timer);
  }, []);

  // Handle clicking "I Agree"
  const handleAgreeClick = async () => {
    // Use the convenience method on our new settings storage
    await settingsStorage.markLegalAccepted();
    // Update onboarding progress
    await onboardingStorage.goToStep('select-method');
    // Navigate to the next step in the onboarding flow
    navigate('/add-wallet');
  };

  return (
    <div className="flex min-h-full flex-col items-center">
      {/* Centered Warning and Text */}
      <div className="flex grow flex-col items-center">
        {/* Warning Section */}
        <div className="mb-4 flex flex-col items-center font-bold text-red-600">
          <img src={warningIconUrl} alt="Warning icon" width="40" height="40" />
          <h2 className="mt-2 text-3xl">WARNING</h2>
        </div>

        <p className="mb-4 text-center">
          DevX is a wallet aimed at developers and is not meant to be used for trading!
        </p>

        <p className="mb-6 text-center">
          We assume no liability for damages arising from the use of this product/service.
        </p>
      </div>

      {/* Bottom Section: Legal Text and Button */}
      <div className="mt-auto flex w-full flex-col items-center">
        {/* Legal Text at the very bottom */}
        <p className="my-4 text-center">
          By continuing, you agree to our
          <a href="https://muesliswap.com/terms" className="ml-1 text-blue-600 hover:underline">
            Terms of Service
          </a>{' '}
          and
          <a href="https://muesliswap.com/privacy" className="ml-1 text-blue-600 hover:underline">
            Privacy Policy
          </a>
          .
        </p>

        {/* Button */}
        <div className="flex w-full justify-center">
          <PrimaryButton
            onClick={handleAgreeClick}
            disabled={!buttonEnabled}
            className={!buttonEnabled ? 'cursor-not-allowed opacity-50' : ''}>
            {buttonEnabled ? 'I Agree' : `I Agree (${countdown})`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default Legal;
