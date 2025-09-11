// Direct crypto operations using @scure/bip39 + Cardano WASM library
import {
  generateMnemonic as generateScureMnemonic,
  validateMnemonic as validateScureMnemonic,
  mnemonicToSeed,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { CardanoLoader } from './cardano_loader';

/**
 * Generates a new 24-word mnemonic seed phrase using @scure/bip39
 */
export async function generateMnemonic(): Promise<string> {
  // Generate 256-bit entropy for 24 words (default is 128-bit for 12 words)
  const mnemonic = generateScureMnemonic(wordlist, 256);
  return mnemonic;
}

/**
 * Validates a mnemonic seed phrase using @scure/bip39
 */
export async function validateMnemonic(mnemonic: string): Promise<boolean> {
  return validateScureMnemonic(mnemonic, wordlist);
}

/**
 * Generates a Cardano root key from a mnemonic seed phrase
 */
export async function generateRootKeyFromMnemonic(mnemonic: string): Promise<string> {
  try {
    // Load Cardano WASM library
    await CardanoLoader.load();
    const CardanoWasm = CardanoLoader.Cardano;

    // Convert mnemonic to seed using @scure/bip39 (returns Uint8Array directly)
    const seed = await mnemonicToSeed(mnemonic);

    // Create root key from seed using Cardano WASM library
    const rootKey = CardanoWasm.Bip32PrivateKey.from_bip39_entropy(
      seed.slice(0, 32), // First 32 bytes as entropy
      new Uint8Array(), // Empty passphrase
    );

    // Return root key as hex string
    const keyBytes = rootKey.to_raw_key().as_bytes();
    return Array.from(keyBytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    throw new Error(`Failed to generate root key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Derives a Cardano address from a mnemonic seed phrase using Cardano WASM library
 */
export async function deriveAddressFromMnemonic(
  mnemonic: string,
  network: 'Mainnet' | 'Preprod',
  accountIndex: number = 0,
  addressIndex: number = 0,
): Promise<{ address: string; stakeAddress: string }> {
  try {
    // Load Cardano WASM library
    await CardanoLoader.load();
    const CardanoWasm = CardanoLoader.Cardano;

    // Convert mnemonic to seed using @scure/bip39 (returns Uint8Array directly)
    const seed = await mnemonicToSeed(mnemonic);

    // Create root key from seed using Cardano WASM library
    const rootKey = CardanoWasm.Bip32PrivateKey.from_bip39_entropy(
      seed.slice(0, 32), // First 32 bytes as entropy
      new Uint8Array(), // Empty passphrase
    );

    // Derive account key (m/1852'/1815'/account')
    const accountKey = rootKey
      .derive(harden(1852)) // purpose
      .derive(harden(1815)) // coin type (ADA)
      .derive(harden(accountIndex)); // account

    // Derive payment key (m/1852'/1815'/account'/0/address_index)
    const paymentKey = accountKey
      .derive(0) // external chain
      .derive(addressIndex);

    // Derive stake key (m/1852'/1815'/account'/2/0)
    const stakeKey = accountKey
      .derive(2) // stake chain
      .derive(0);

    // Get public keys
    const paymentPubKey = paymentKey.to_public();
    const stakePubKey = stakeKey.to_public();

    // Create key hashes
    const paymentKeyHash = paymentPubKey.to_raw_key().hash();
    const stakeKeyHash = stakePubKey.to_raw_key().hash();

    // Determine network ID
    const networkId =
      network === 'Mainnet'
        ? CardanoWasm.NetworkInfo.mainnet().network_id()
        : CardanoWasm.NetworkInfo.testnet_preprod().network_id();

    // Create payment address
    const paymentAddress = CardanoWasm.BaseAddress.new(
      networkId,
      CardanoWasm.Credential.from_keyhash(paymentKeyHash),
      CardanoWasm.Credential.from_keyhash(stakeKeyHash),
    );

    // Create stake address
    const stakeAddress = CardanoWasm.RewardAddress.new(networkId, CardanoWasm.Credential.from_keyhash(stakeKeyHash));

    return {
      address: paymentAddress.to_address().to_bech32(),
      stakeAddress: stakeAddress.to_address().to_bech32(),
    };
  } catch (error) {
    throw new Error(`Failed to derive Cardano address: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper function to create hardened derivation index
 */
function harden(index: number): number {
  return index + 0x80000000;
}
