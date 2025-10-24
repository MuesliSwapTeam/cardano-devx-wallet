import { onboardingStorage } from '@extension/storage';
import { generateMnemonic, deriveAddressFromMnemonic, generateRootKeyFromMnemonic } from './crypto';

export interface CreateWalletData {
  walletName: string;
  network: 'Mainnet' | 'Preprod';
  password?: string;
}

export interface ImportWalletData {
  walletName: string;
  network: 'Mainnet' | 'Preprod';
  password?: string;
  seedPhrase: string;
  seedWords?: Record<string, string>;
  wordCount?: number;
}

export interface SpoofWalletData {
  walletName: string;
  network: 'Mainnet' | 'Preprod';
  walletAddress: string;
}

export const createWallet = async (formData: CreateWalletData, navigate: (path: string) => void) => {
  try {
    console.log('UI: Generating mnemonic and deriving address...');

    // Generate mnemonic and derive address in frontend (popup context)
    const seedPhrase = await generateMnemonic();
    const { address, stakeAddress } = await deriveAddressFromMnemonic(seedPhrase, formData.network);
    const rootKey = await generateRootKeyFromMnemonic(seedPhrase);

    console.log('UI: Generated seedPhrase, address, stakeAddress, and rootKey successfully');

    // Update onboarding state with generated data
    await onboardingStorage.updateCreateFormData({
      ...formData,
      seedPhrase: seedPhrase,
    });

    // Prepare the data payload with crypto operations completed
    const payload = {
      name: formData.walletName,
      network: formData.network,
      password: formData.password,
      seedPhrase: seedPhrase,
      address: address,
      stakeAddress: stakeAddress,
      rootKey: rootKey,
    };

    console.log('UI: Sending CREATE_WALLET message with payload:', payload);

    // Send the complete data to the background script for storage
    chrome.runtime.sendMessage(
      {
        type: 'CREATE_WALLET',
        payload: payload,
      },
      // Handle the response from the background script
      response => {
        // Check for errors during message sending itself
        if (chrome.runtime.lastError) {
          console.error('Message sending failed:', chrome.runtime.lastError.message);
          // TODO: Display an error message to the user
          return;
        }

        // Handle the response from our background logic
        if (response?.success) {
          console.log('UI: Wallet created successfully!', response.wallet);
          // Mark onboarding as complete and clear form data
          onboardingStorage.goToStep('success');
          onboardingStorage.clearFormData('create');
          navigate('/create-new-wallet/success');
        } else {
          console.error('UI: Failed to create wallet:', response?.error);
          // TODO: Display a meaningful error message to the user
        }
      },
    );
  } catch (error) {
    console.error('UI: Failed to generate wallet data:', error);
    // TODO: Display error message to user
  }
};

export const importWallet = async (formData: ImportWalletData, navigate: (path: string) => void) => {
  try {
    // Use the seed phrase from form data
    const seedPhrase = formData.seedPhrase;

    // Derive addresses and generate rootKey from seedPhrase in frontend
    const { address, stakeAddress } = await deriveAddressFromMnemonic(seedPhrase, formData.network);
    const rootKey = await generateRootKeyFromMnemonic(seedPhrase);

    const payload = {
      name: formData.walletName,
      network: formData.network,
      seedPhrase: seedPhrase,
      address: address,
      stakeAddress: stakeAddress,
      password: formData.password,
      rootKey: rootKey,
    };

    chrome.runtime.sendMessage({ type: 'IMPORT_WALLET', payload }, response => {
      if (chrome.runtime.lastError) {
        console.error('Message sending failed:', chrome.runtime.lastError.message);
      } else if (response?.success) {
        // Mark onboarding as complete and clear form data
        onboardingStorage.goToStep('success');
        onboardingStorage.clearFormData('import');
        navigate('/import-wallet/success');
      } else {
        console.error('UI: Failed to import wallet:', response?.error);
      }
    });
  } catch (error) {
    console.error('UI: Failed to generate rootKey:', error);
  }
};

export const spoofWallet = async (formData: SpoofWalletData, navigate: (path: string) => void) => {
  const payload = {
    name: formData.walletName,
    address: formData.walletAddress,
    network: formData.network,
  };

  console.log('Spoofing wallet with payload:', payload);

  chrome.runtime.sendMessage(
    {
      type: 'SPOOF_WALLET',
      payload: payload,
    },
    response => {
      if (chrome.runtime.lastError) {
        console.error('Message sending failed:', chrome.runtime.lastError.message);
        return;
      }

      if (response?.success) {
        // Mark onboarding as complete and clear form data
        onboardingStorage.goToStep('success');
        onboardingStorage.clearFormData('spoof');
        navigate('/spoof-wallet/success');
      } else {
        console.log('Spoof wallet response error:', response?.error);
        console.error('UI: Failed to spoof wallet:', response?.error);
      }
    },
  );
};
