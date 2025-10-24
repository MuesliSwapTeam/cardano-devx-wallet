import { useNavigate } from 'react-router-dom';
import { onboardingStorage, useStorage } from '@extension/storage';
import ApiKeySetup from '@src/components/ApiKeySetup';
import { importWallet } from '../utils/walletOperations';

const ImportWalletApiKey = () => {
  const navigate = useNavigate();
  const onboardingState = useStorage(onboardingStorage);

  // Get network from onboarding storage or default to Preprod
  const network = onboardingState?.importFormData.network || 'Preprod';

  const handleComplete = async () => {
    // Get form data from onboarding storage and import wallet directly
    const formData = onboardingState?.importFormData;
    if (formData) {
      await importWallet(
        {
          walletName: formData.walletName,
          network: formData.network,
          password: formData.password,
          seedPhrase: formData.seedPhrase,
        },
        navigate,
      );
    }
  };

  const handleCancel = () => {
    // Go back to the previous step (wallet details)
    navigate('/import-wallet/details');
  };

  return (
    <ApiKeySetup
      network={network}
      onComplete={handleComplete}
      onCancel={handleCancel}
      title="API Key Required for Import Wallet"
      subtitle={`Please enter your ${network} API key to continue importing the wallet.`}
    />
  );
};

export default ImportWalletApiKey;
