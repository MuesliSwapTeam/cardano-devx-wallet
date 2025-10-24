import { useNavigate } from 'react-router-dom';
import { onboardingStorage, useStorage } from '@extension/storage';
import ApiKeySetup from '@src/components/ApiKeySetup';
import { spoofWallet } from '../utils/walletOperations';

const SpoofWalletApiKey = () => {
  const navigate = useNavigate();
  const onboardingState = useStorage(onboardingStorage);

  // Get network from onboarding storage or default to Preprod
  const network = onboardingState?.spoofFormData.network || 'Preprod';

  const handleComplete = async () => {
    // Get form data from onboarding storage and spoof wallet directly
    const formData = onboardingState?.spoofFormData;
    if (formData) {
      await spoofWallet(
        {
          walletName: formData.walletName,
          network: formData.network,
          walletAddress: formData.walletAddress,
        },
        navigate,
      );
    }
  };

  const handleCancel = () => {
    // Go back to the previous step (spoof wallet form)
    navigate('/spoof-wallet');
  };

  return (
    <ApiKeySetup
      network={network}
      onComplete={handleComplete}
      onCancel={handleCancel}
      title="API Key Required for Spoof Wallet"
      subtitle={`Please enter your ${network} API key to continue creating the spoof wallet.`}
    />
  );
};

export default SpoofWalletApiKey;
