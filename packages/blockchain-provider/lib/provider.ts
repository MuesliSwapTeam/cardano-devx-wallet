import type { Asset, Wallet } from '@extension/shared';
import { settingsStorage } from '@extension/storage';

// --- Type Definitions ---

// Transaction-related types
export interface TransactionInput {
  address: string;
  amount: BlockfrostAmount[];
  tx_hash: string;
  output_index: number;
}

export interface TransactionOutput {
  address: string;
  amount: BlockfrostAmount[];
  output_index: number;
  data_hash?: string | null;
  inline_datum?: string | null;
  reference_script_hash?: string | null;
}

export interface Transaction {
  hash: string;
  block: string;
  block_height: number;
  block_time: number;
  slot: number;
  index: number;
  output_amount: BlockfrostAmount[];
  fees: string;
  deposit: string;
  size: number;
  invalid_before: string | null;
  invalid_hereafter: string | null;
  utxo_count: number;
  withdrawal_count: number;
  mir_cert_count: number;
  delegation_count: number;
  stake_cert_count: number;
  pool_update_count: number;
  pool_retire_count: number;
  asset_mint_or_burn_count: number;
  redeemer_count: number;
  valid_contract: boolean;
}

export interface TransactionDetails extends Transaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}

// UTXO-related types for developer wallet
export interface UTXO {
  address: string;
  tx_hash: string;
  output_index: number;
  amount: BlockfrostAmount[];
  block: string;
  data_hash?: string | null;
  inline_datum?: string | null;
  reference_script_hash?: string | null;
  isSpent: boolean;
  spentInTx?: string | null;
  isExternal?: boolean;
}

// The final state of the entire wallet
export interface WalletState {
  status: 'found' | 'not_found' | 'invalid_address';
  address: string;
  stakeAddress: string | null;
  balance: string; // Lovelace
  assets: Asset[];
}

// Blockfrost API response types
type BlockfrostAmount = {
  unit: string;
  quantity: string;
};

type AddressInfoResponse = {
  address: string;
  amount: BlockfrostAmount[];
  stake_address: string | null;
  type: 'shelley';
  script: boolean;
};

type AccountInfoResponse = {
  stake_address: string;
  controlled_amount: string; // This is the total lovelace balance
};

type BlockfrostUTXO = {
  address: string;
  tx_hash: string;
  output_index: number;
  amount: BlockfrostAmount[];
  block: string;
  data_hash?: string | null;
  inline_datum?: string | null;
  reference_script_hash?: string | null;
};

type AddressTransactionResponse = {
  tx_hash: string;
  tx_index: number;
  block_height: number;
  block_time: number;
};

const BLOCKFROST_API_URLS = {
  Mainnet: 'https://cardano-mainnet.blockfrost.io/api/v0',
  Preprod: 'https://cardano-preprod.blockfrost.io/api/v0',
};

// --- Helper Functions ---

/**
 * Gets the API URL and API key for a specific wallet's network.
 */
async function getApiConfigForWallet(wallet: Wallet): Promise<{ apiUrl: string; apiKey: string }> {
  const settings = await settingsStorage.get();
  const apiUrl = BLOCKFROST_API_URLS[wallet.network];

  if (!apiUrl) {
    throw new Error(`Unsupported network: ${wallet.network}`);
  }

  // Get the API key for the wallet's network
  const apiKey = wallet.network === 'Mainnet' ? settings.mainnetApiKey : settings.preprodApiKey;

  if (!apiKey) {
    throw new Error(`No API key configured for ${wallet.network} network`);
  }

  return { apiUrl, apiKey };
}

/**
 * A simple client-side check for address format.
 */
function isValidAddressFormat(address: string): boolean {
  return address.startsWith('addr1') || address.startsWith('addr_test1');
}

/**
 * Fetches the stake address associated with a given payment address.
 * Handles the case where the address is valid but has no on-chain history (404).
 */
async function getStakeAddress(
  apiUrl: string,
  apiKey: string,
  paymentAddress: string,
): Promise<{ stakeAddress: string | null; status: 'found' | 'not_found' }> {
  const endpoint = `${apiUrl}/addresses/${paymentAddress}`;
  const response = await fetch(endpoint, {
    headers: { project_id: apiKey },
  });

  if (response.status === 404) {
    return { stakeAddress: null, status: 'not_found' };
  }
  if (!response.ok) {
    throw new Error(`Blockfrost API request failed: ${response.statusText}`);
  }

  const data: AddressInfoResponse = await response.json();
  return { stakeAddress: data.stake_address, status: 'found' };
}

/**
 * Fetches the total ADA balance for an entire account via its stake address.
 */
async function getAccountBalance(apiUrl: string, apiKey: string, stakeAddress: string): Promise<string> {
  const endpoint = `${apiUrl}/accounts/${stakeAddress}`;
  const response = await fetch(endpoint, {
    headers: { project_id: apiKey },
  });
  if (!response.ok) throw new Error(`Failed to fetch account balance: ${response.statusText}`);
  const data: AccountInfoResponse = await response.json();
  return data.controlled_amount;
}

/**
 * Fetches all unique native assets for an entire account via its stake address.
 */
async function getAccountAssets(apiUrl: string, apiKey: string, stakeAddress: string): Promise<Asset[]> {
  const endpoint = `${apiUrl}/accounts/${stakeAddress}/addresses/assets`;
  const response = await fetch(endpoint, {
    headers: { project_id: apiKey },
  });
  if (!response.ok) throw new Error(`Failed to fetch account assets: ${response.statusText}`);
  const data: Asset[] = await response.json();
  // Blockfrost returns ADA as an asset here, so we filter it out.
  return data.filter(asset => asset.unit !== 'lovelace');
}

/**
 * Fetches metadata for a specific asset from Blockfrost
 */
async function getAssetMetadata(apiUrl: string, apiKey: string, unit: string): Promise<Partial<Asset>> {
  try {
    const endpoint = `${apiUrl}/assets/${unit}`;
    const response = await fetch(endpoint, {
      headers: { project_id: apiKey },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch metadata for asset ${unit}: ${response.statusText}`);
      return {};
    }
    const data = await response.json();

    // Extract metadata from Blockfrost response
    const metadata: Partial<Asset> = {};

    // Helper function to try extracting logo/image from all possible sources
    const extractLogo = (): string | undefined => {
      const checkAndReturn = (value: unknown): string | undefined => {
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
      };

      // 1. Try onchain_metadata.image (IPFS URLs)
      const onchainImage = checkAndReturn(data.onchain_metadata?.image);
      if (onchainImage) return onchainImage;

      // 2. Try onchain_metadata.logo
      const onchainLogo = checkAndReturn(data.onchain_metadata?.logo);
      if (onchainLogo) return onchainLogo;

      // 3. Try CIP-25 721 structure image
      if (data.onchain_metadata?.['721']) {
        const policyData = data.onchain_metadata['721'][unit.slice(0, 56)];
        if (policyData) {
          const assetData = policyData[unit.slice(56)] || Object.values(policyData)[0];
          if (assetData) {
            const cip25Image = checkAndReturn(assetData.image);
            if (cip25Image) return cip25Image;
            const cip25Logo = checkAndReturn(assetData.logo);
            if (cip25Logo) return cip25Logo;
          }
        }
      }

      // 4. Try off-chain metadata.logo (base64 encoded)
      const metadataLogo = checkAndReturn(data.metadata?.logo);
      if (metadataLogo) {
        // Base64 encoded logos start with data:image or just the base64 string
        if (metadataLogo.startsWith('data:image')) return metadataLogo;
        if (metadataLogo.startsWith('iVBOR') || metadataLogo.startsWith('/9j/') || metadataLogo.startsWith('UklGR')) {
          // Common base64 prefixes for PNG, JPG, WEBP
          return `data:image/png;base64,${metadataLogo}`;
        }
        return metadataLogo; // Return as-is, might be URL
      }

      // 5. Try metadata.image
      const metadataImage = checkAndReturn(data.metadata?.image);
      if (metadataImage) return metadataImage;

      return undefined;
    };

    if (data.onchain_metadata) {
      const onchainMeta = data.onchain_metadata;

      // Check for direct metadata first (CIP-68 or simple format)
      if (onchainMeta.name) metadata.name = onchainMeta.name;
      if (onchainMeta.description) metadata.description = onchainMeta.description;
      if (onchainMeta.mediaType) metadata.mediaType = onchainMeta.mediaType;
      if (onchainMeta.attributes) metadata.attributes = onchainMeta.attributes;

      // Also check CIP-25 721 structure
      if (onchainMeta['721']) {
        const policyData = onchainMeta['721'][unit.slice(0, 56)];
        if (policyData) {
          const assetData = policyData[unit.slice(56)] || Object.values(policyData)[0];
          if (assetData) {
            metadata.name = assetData.name || metadata.name;
            metadata.description = assetData.description || metadata.description;
            metadata.mediaType = assetData.mediaType || metadata.mediaType;
            metadata.attributes = assetData.attributes || metadata.attributes;
          }
        }
      }
    }

    // Extract logo/image from any available source
    const extractedLogo = extractLogo();
    if (extractedLogo) {
      metadata.image = extractedLogo;
      metadata.logo = extractedLogo; // Store in both fields for compatibility
    }

    // Add other Blockfrost data
    if (data.asset_name) {
      metadata.ticker = hexToString(data.asset_name);
    }
    if (data.fingerprint) {
      metadata.fingerprint = data.fingerprint;
    }
    if (data.initial_mint_tx_hash) {
      metadata.firstMintTx = data.initial_mint_tx_hash;
    }
    if (data.mint_or_burn_count) {
      metadata.mintCount = data.mint_or_burn_count.toString();
    }

    return metadata;
  } catch (error) {
    console.warn(`Error fetching metadata for asset ${unit}:`, error);
    return {};
  }
}

/**
 * Converts a hex string to a UTF-8 readable string.
 */
function hexToString(hex: string): string {
  // NOTE: Not sure if that's a good idea...
  if (!hex || hex.length % 2 !== 0) {
    return hex; // Return original hex if it's invalid or empty
  }
  try {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return hex; // Fallback to returning the hex on error
  }
}

/**
 * Fetches all payment addresses associated with a stake address.
 */
export async function getPaymentAddresses(apiUrl: string, apiKey: string, stakeAddress: string): Promise<string[]> {
  const endpoint = `${apiUrl}/accounts/${stakeAddress}/addresses`;

  console.log('Fetching payment addresses:', {
    endpoint,
    stakeAddress,
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'none',
  });

  const response = await fetch(endpoint, {
    headers: { project_id: apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Blockfrost API Error:', {
      status: response.status,
      statusText: response.statusText,
      errorBody: errorText,
      endpoint,
      apiKey: apiKey ? `${apiKey.slice(0, 8)}...` : 'MISSING',
      stakeAddress,
    });

    if (response.status === 400) {
      throw new Error(`Invalid stake address: ${stakeAddress}. Check if the wallet stake address is correct.`);
    } else if (response.status === 403) {
      throw new Error(`Blockfrost API key invalid or missing. Please configure your API key in Settings.`);
    } else if (response.status === 404) {
      throw new Error(`Stake address not found: ${stakeAddress}. This might be a new wallet with no transactions.`);
    } else {
      throw new Error(`Failed to fetch payment addresses: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  const data: { address: string }[] = await response.json();
  return data.map(item => item.address);
}

/**
 * Fetches transaction hashes for a specific address.
 */
async function getAddressTransactions(apiUrl: string, apiKey: string, address: string): Promise<string[]> {
  const allTxHashes: string[] = [];
  let page = 1;
  const count = 100;

  while (true) {
    const endpoint = `${apiUrl}/addresses/${address}/transactions?page=${page}&count=${count}&order=desc`;
    const response = await fetch(endpoint, {
      headers: { project_id: apiKey },
    });

    if (!response.ok) {
      if (response.status === 404) break; // No more transactions
      throw new Error(`Failed to fetch transactions for address ${address}: ${response.statusText}`);
    }

    const data: { tx_hash: string }[] = await response.json();

    if (data.length === 0) break;

    allTxHashes.push(...data.map(tx => tx.tx_hash));

    if (data.length < count) break; // Last page
    page++;
  }

  return allTxHashes;
}

/**
 * Fetches current UTXOs for a specific address.
 */
async function getAddressUTXOs(apiUrl: string, apiKey: string, address: string): Promise<BlockfrostUTXO[]> {
  const allUtxos: BlockfrostUTXO[] = [];
  let page = 1;
  const count = 100;

  while (true) {
    const endpoint = `${apiUrl}/addresses/${address}/utxos?page=${page}&count=${count}`;
    const response = await fetch(endpoint, {
      headers: { project_id: apiKey },
    });

    if (!response.ok) {
      if (response.status === 404) break; // No UTXOs found
      throw new Error(`Failed to fetch UTXOs for address ${address}: ${response.statusText}`);
    }

    const data: BlockfrostUTXO[] = await response.json();

    // Log the amount data from Blockfrost
    console.log(
      'BLOCKFROST UTXO AMOUNT DATA:',
      data.map(utxo => ({
        tx_hash: utxo.tx_hash,
        output_index: utxo.output_index,
        amount: utxo.amount,
      })),
    );

    if (data.length === 0) break;

    allUtxos.push(...data);

    if (data.length < count) break; // Last page
    page++;
  }

  return allUtxos;
}

/**
 * Fetches all UTXOs for an account via stake address.
 */
async function getAccountUTXOs(apiUrl: string, apiKey: string, stakeAddress: string): Promise<BlockfrostUTXO[]> {
  const endpoint = `${apiUrl}/accounts/${stakeAddress}/utxos`;
  const response = await fetch(endpoint, {
    headers: { project_id: apiKey },
  });

  if (!response.ok) {
    if (response.status === 404) return []; // No UTXOs found
    throw new Error(`Failed to fetch account UTXOs: ${response.statusText}`);
  }

  const data: BlockfrostUTXO[] = await response.json();
  return data;
}

/**
 * Fetches detailed transaction information.
 */
async function getTransactionDetails(apiUrl: string, apiKey: string, txHash: string): Promise<TransactionDetails> {
  // Fetch basic transaction info
  const txResponse = await fetch(`${apiUrl}/txs/${txHash}`, {
    headers: { project_id: apiKey },
  });
  if (!txResponse.ok) throw new Error(`Failed to fetch transaction ${txHash}: ${txResponse.statusText}`);
  const txData: Transaction = await txResponse.json();

  // Fetch transaction inputs and outputs
  const utxosResponse = await fetch(`${apiUrl}/txs/${txHash}/utxos`, {
    headers: { project_id: apiKey },
  });

  if (!utxosResponse.ok) {
    throw new Error(`Failed to fetch UTXOs for transaction ${txHash}`);
  }

  const utxoData = await utxosResponse.json();

  return {
    ...txData,
    inputs: utxoData.inputs || [],
    outputs: utxoData.outputs || [],
  };
}

/**
 * Determines UTXO spent status by checking if they appear as inputs in subsequent transactions.
 */
async function determineUTXOSpentStatus(
  apiUrl: string,
  apiKey: string,
  utxos: BlockfrostUTXO[],
  transactions: AddressTransactionResponse[],
): Promise<UTXO[]> {
  const processedUtxos: UTXO[] = utxos.map(utxo => ({
    ...utxo,
    isSpent: false,
    spentInTx: null,
  }));

  // For each transaction, check if any of our UTXOs are consumed as inputs
  for (const tx of transactions) {
    try {
      const txUtxos = await fetch(`${apiUrl}/txs/${tx.tx_hash}/utxos`, {
        headers: { project_id: apiKey },
      });

      if (!txUtxos.ok) continue;

      const txData = await txUtxos.json();
      const inputs = txData.inputs || [];

      // Mark UTXOs as spent if they appear as inputs
      for (const input of inputs) {
        const utxoIndex = processedUtxos.findIndex(
          utxo => utxo.tx_hash === input.tx_hash && utxo.output_index === input.output_index,
        );

        if (utxoIndex !== -1) {
          processedUtxos[utxoIndex].isSpent = true;
          processedUtxos[utxoIndex].spentInTx = tx.tx_hash;
        }
      }
    } catch (error) {
      console.warn(`Failed to process transaction ${tx.tx_hash} for UTXO analysis:`, error);
    }
  }

  return processedUtxos;
}

// --- Main Exported Function ---

/**
 * Fetches the complete state of a wallet (total balance and all assets)
 * by looking up the stake key associated with a given payment address.
 * @param wallet The wallet object containing the address and network information.
 * @returns A promise that resolves to a WalletState object.
 */
export const getWalletState = async (wallet: Wallet): Promise<WalletState> => {
  const address = wallet.address;

  // For spoofed wallets, we might need to determine the stake address from the input
  let stakeAddress: string | null = wallet.stakeAddress;
  let status: 'found' | 'not_found' = 'found';

  if (!stakeAddress) {
    // Fallback: try to get stake address from the wallet address (for legacy compatibility)
    if (!isValidAddressFormat(address)) {
      return {
        status: 'invalid_address',
        address,
        stakeAddress: null,
        balance: '0',
        assets: [],
      };
    }

    const { apiUrl, apiKey } = await getApiConfigForWallet(wallet);
    const result = await getStakeAddress(apiUrl, apiKey, address);
    stakeAddress = result.stakeAddress;
    status = result.status;

    if (status === 'not_found') {
      return {
        status: 'not_found',
        address,
        stakeAddress: null,
        balance: '0',
        assets: [],
      };
    }
  }

  if (!stakeAddress) {
    // This can happen if the address is valid but has no associated stake key (e.g., some scripts)
    // For our purpose, we treat it as having no account-wide data to fetch.
    return {
      status: 'found',
      address,
      stakeAddress: null,
      balance: '0',
      assets: [],
    };
  }

  try {
    const { apiUrl, apiKey } = await getApiConfigForWallet(wallet);

    // Fetch balance and assets in parallel for efficiency
    const [balance, rawAssets] = await Promise.all([
      getAccountBalance(apiUrl, apiKey, stakeAddress),
      getAccountAssets(apiUrl, apiKey, stakeAddress),
    ]);

    // Enrich asset data with readable names, policy IDs, and metadata
    const enrichedAssets: Asset[] = await Promise.all(
      rawAssets.map(async asset => {
        const policyId = asset.unit.slice(0, 56);
        const hexName = asset.unit.slice(56);

        // Fetch metadata for this asset
        const metadata = await getAssetMetadata(apiUrl, apiKey, asset.unit);

        return {
          ...asset,
          policyId,
          assetName: hexName,
          name: metadata.name || hexToString(hexName),
          // Merge in all metadata fields
          ...metadata,
          // Set lastUpdated timestamp
          lastUpdated: Date.now(),
        };
      }),
    );

    return {
      status: 'found',
      address,
      stakeAddress,
      balance,
      assets: enrichedAssets,
    };
  } catch (error) {
    // Check if this is a 404 error (wallet not found) - this is expected for new wallets
    const is404Error =
      error instanceof Error &&
      (error.message.includes('404') ||
        error.message.includes('not found') ||
        error.message.includes('Failed to fetch account'));

    if (is404Error) {
      console.log('Wallet not found on blockchain (expected for new wallets):', address);
    } else {
      console.error('Failed to fetch full wallet state:', error);
    }

    // Return a default error state
    return {
      status: 'not_found',
      address,
      stakeAddress,
      balance: '0',
      assets: [],
    };
  }
};

/**
 * Fetches all transactions for a wallet by getting all payment addresses
 * associated with the wallet's stake address and then fetching transactions
 * for each address.
 * @param wallet The wallet object containing the address and network information.
 * @returns A promise that resolves to an array of transaction details.
 */
export const getTransactions = async (wallet: Wallet): Promise<TransactionDetails[]> => {
  const { apiUrl, apiKey } = await getApiConfigForWallet(wallet);

  // Use the wallet's stake address directly - it's always available now
  const stakeAddress = wallet.stakeAddress;

  if (!stakeAddress) {
    console.log('No stake address found for wallet, returning empty transactions');
    return [];
  }

  console.log('Fetching transactions for wallet:', {
    walletId: wallet.id,
    stakeAddress,
    hasApiKey: !!apiKey,
    network: wallet.network,
  });

  try {
    // Get all payment addresses for this stake address
    const paymentAddresses = await getPaymentAddresses(apiUrl, apiKey, stakeAddress);

    // Get all transaction hashes from all addresses
    const allTxHashesPromises = paymentAddresses.map(address => getAddressTransactions(apiUrl, apiKey, address));

    const allTxHashesArrays = await Promise.all(allTxHashesPromises);
    const allTxHashes = [...new Set(allTxHashesArrays.flat())]; // Remove duplicates

    // Fetch detailed information for each transaction (no limit - get all transactions)
    const transactionDetailsPromises = allTxHashes.map(txHash =>
      getTransactionDetails(apiUrl, apiKey, txHash).catch(error => {
        console.warn(`Failed to fetch details for transaction ${txHash}:`, error);
        return null;
      }),
    );

    const transactionDetails = await Promise.all(transactionDetailsPromises);

    // Filter out failed requests and sort by block time (newest first)
    return transactionDetails
      .filter((tx): tx is TransactionDetails => tx !== null)
      .sort((a, b) => b.block_time - a.block_time);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
};

/**
 * Fetches all UTXOs for a wallet with spent/unspent status determination.
 * This is the core function for the developer wallet's UTXO management.
 */
export const getWalletUTXOs = async (wallet: Wallet): Promise<UTXO[]> => {
  const { apiUrl, apiKey } = await getApiConfigForWallet(wallet);
  const stakeAddress = wallet.stakeAddress;

  if (!stakeAddress) {
    console.log('No stake address found for wallet, returning empty UTXOs');
    return [];
  }

  console.log('Fetching UTXOs for wallet:', {
    walletId: wallet.id,
    stakeAddress,
    hasApiKey: !!apiKey,
    network: wallet.network,
  });

  try {
    // Get current unspent UTXOs for the account
    const currentUtxos = await getAccountUTXOs(apiUrl, apiKey, stakeAddress);

    // Get all payment addresses to fetch transaction history
    const paymentAddresses = await getPaymentAddresses(apiUrl, apiKey, stakeAddress);

    // Get comprehensive transaction history for UTXO analysis
    const allTransactionsPromises = paymentAddresses.map(async address => {
      const endpoint = `${apiUrl}/addresses/${address}/transactions?order=desc&count=100`;
      const response = await fetch(endpoint, {
        headers: { project_id: apiKey },
      });

      if (!response.ok) return [];

      const data: AddressTransactionResponse[] = await response.json();
      return data;
    });

    const allTransactionsArrays = await Promise.all(allTransactionsPromises);
    const allTransactions = allTransactionsArrays.flat();

    // Build comprehensive UTXO set by analyzing transaction outputs
    const allUtxosMap = new Map<string, UTXO>();
    const walletTransactionDetails = new Map<string, TransactionDetails>();

    // First, collect all UTXOs created by transaction outputs AND cache transaction details
    for (const tx of allTransactions) {
      try {
        const txDetails = await getTransactionDetails(apiUrl, apiKey, tx.tx_hash);
        // Cache the transaction details for later use
        walletTransactionDetails.set(tx.tx_hash, txDetails);

        console.log(`\n=== Transaction: ${tx.tx_hash.slice(0, 5)}... ===`);
        console.log('  Inputs:');
        txDetails.inputs.forEach((input, idx) => {
          const belongsToWallet = paymentAddresses.includes(input.address);
          const assetList = input.amount
            .map(a => `${a.quantity} ${a.unit === 'lovelace' ? 'ADA' : a.unit.slice(0, 8)}`)
            .join(', ');
          console.log(
            `    - Input ${idx}: ${input.tx_hash.slice(0, 8)}:${input.output_index} (${assetList}) [${belongsToWallet ? 'WALLET' : 'EXTERNAL'}]`,
          );
        });

        console.log('  Outputs:');
        txDetails.outputs.forEach((output, idx) => {
          const belongsToWallet = paymentAddresses.includes(output.address);
          const assetList = output.amount
            .map(a => `${a.quantity} ${a.unit === 'lovelace' ? 'ADA' : a.unit.slice(0, 8)}`)
            .join(', ');
          console.log(
            `    - Output ${idx}: ${output.address.slice(0, 12)}... (${assetList}) [${belongsToWallet ? 'WALLET' : 'EXTERNAL'}]`,
          );
        });

        // Process outputs to create UTXOs
        txDetails.outputs.forEach((output, index) => {
          // Include ALL outputs, marking external ones appropriately
          const utxoKey = `${tx.tx_hash}:${index}`;
          const belongsToWallet = paymentAddresses.includes(output.address);

          allUtxosMap.set(utxoKey, {
            address: output.address,
            tx_hash: tx.tx_hash,
            output_index: index,
            amount: output.amount,
            block: txDetails.block,
            data_hash: output.data_hash,
            inline_datum: output.inline_datum,
            reference_script_hash: output.reference_script_hash,
            isSpent: false, // Initially mark as unspent
            spentInTx: null,
          });
          console.log(`    --> Stored UTXO: ${utxoKey} [${belongsToWallet ? 'WALLET' : 'EXTERNAL'}]`);
        });

        // Also store external UTXOs from transaction inputs
        txDetails.inputs.forEach((input, idx) => {
          const utxoKey = `${input.tx_hash}:${input.output_index}`;
          const belongsToWallet = paymentAddresses.includes(input.address);

          // Only store if it's not already in our map and is external
          if (!allUtxosMap.has(utxoKey) && !belongsToWallet) {
            allUtxosMap.set(utxoKey, {
              address: input.address,
              tx_hash: input.tx_hash,
              output_index: input.output_index,
              amount: input.amount,
              block: txDetails.block, // We don't have the original block, use current tx block
              data_hash: null,
              inline_datum: null,
              reference_script_hash: null,
              isSpent: true, // External UTXOs are spent (they're inputs)
              spentInTx: tx.tx_hash,
            });
            console.log(`    --> Stored external input UTXO: ${utxoKey} [EXTERNAL]`);
          }
        });
      } catch (error) {
        console.warn(`Failed to fetch details for transaction ${tx.tx_hash}:`, error);
      }
    }

    // Now determine which UTXOs are spent by checking transaction inputs using cached data
    console.log('\n=== UTXO SPENDING ANALYSIS ===');
    for (const [txHash, txDetails] of walletTransactionDetails.entries()) {
      try {
        console.log(`\nAnalyzing inputs for transaction: ${txHash.slice(0, 5)}...`);

        // Process inputs to mark UTXOs as spent
        txDetails.inputs.forEach((input, idx) => {
          const utxoKey = `${input.tx_hash}:${input.output_index}`;
          const utxo = allUtxosMap.get(utxoKey);
          const belongsToWallet = paymentAddresses.includes(input.address);

          console.log(
            `  - Input ${idx}: Looking for UTXO ${input.tx_hash.slice(0, 8)}:${input.output_index} [${belongsToWallet ? 'WALLET' : 'EXTERNAL'}]`,
          );

          if (utxo && belongsToWallet) {
            utxo.isSpent = true;
            utxo.spentInTx = txHash;
            console.log(`    --> FOUND wallet UTXO and marked as spent in ${txHash.slice(0, 8)}...`);
          } else if (belongsToWallet && !utxo) {
            console.log(`    --> MISSING: This UTXO belongs to wallet but not found in our database!`);
          } else if (utxo && !belongsToWallet) {
            // External UTXO found and already marked as spent
            console.log(`    --> FOUND external UTXO (already marked as spent)`);
          } else {
            console.log(`    --> External UTXO not in our database (should have been stored earlier)`);
          }
        });
      } catch (error) {
        console.warn(`Failed to analyze inputs for transaction ${txHash}:`, error);
      }
    }

    // Fetch external transactions for complete UTXO data
    console.log('\n=== FETCHING EXTERNAL TRANSACTIONS ===');
    const externalTxHashes = new Set<string>();
    const inputReferences = new Map<string, { txHash: string; outputIndex: number }[]>();

    // Collect all unique external transaction hashes using cached transaction details
    for (const [txHash, txDetails] of walletTransactionDetails.entries()) {
      for (const input of txDetails.inputs) {
        // Check if we already have this transaction in our wallet transactions
        const haveTransaction = walletTransactionDetails.has(input.tx_hash);

        if (!haveTransaction) {
          externalTxHashes.add(input.tx_hash);

          // Track which specific UTXOs from this external tx we need
          if (!inputReferences.has(input.tx_hash)) {
            inputReferences.set(input.tx_hash, []);
          }
          inputReferences.get(input.tx_hash)!.push({
            txHash: txHash,
            outputIndex: input.output_index,
          });
        }
      }
    }

    console.log(`Found ${externalTxHashes.size} external transactions to fetch for complete UTXO data`);

    // Fetch external transactions and store complete UTXO data
    for (const externalTxHash of externalTxHashes) {
      try {
        console.log(`  Fetching external transaction: ${externalTxHash.slice(0, 8)}...`);
        const txDetails = await getTransactionDetails(apiUrl, apiKey, externalTxHash);

        // Get the UTXOs we need from this external transaction
        const neededUtxos = inputReferences.get(externalTxHash) || [];

        for (const ref of neededUtxos) {
          const output = txDetails.outputs[ref.outputIndex];
          if (output) {
            const utxoKey = `${externalTxHash}:${ref.outputIndex}`;
            const belongsToWallet = paymentAddresses.includes(output.address);

            // Replace incomplete data with complete data from the creating transaction
            allUtxosMap.set(utxoKey, {
              tx_hash: externalTxHash,
              output_index: ref.outputIndex,
              address: output.address,
              amount: output.amount,
              block: txDetails.block, // Now we have the CORRECT block!
              data_hash: output.data_hash,
              inline_datum: output.inline_datum,
              reference_script_hash: output.reference_script_hash,
              isSpent: true, // We know it's spent because it's an input
              spentInTx: ref.txHash,
            });

            console.log(
              `    --> Updated UTXO with complete data: ${utxoKey} [${belongsToWallet ? 'WALLET' : 'EXTERNAL'}] - spent in ${ref.txHash.slice(0, 8)}`,
            );
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch external transaction ${externalTxHash}:`, error);
      }
    }

    // Convert map to array and sort
    const allUtxos = Array.from(allUtxosMap.values());

    console.log('\n=== FINAL UTXO SUMMARY ===');
    console.log(`Total UTXOs stored: ${allUtxos.length}`);
    console.log(`Unspent UTXOs: ${allUtxos.filter(u => !u.isSpent).length}`);
    console.log(`Spent UTXOs: ${allUtxos.filter(u => u.isSpent).length}`);
    console.log(`Current unspent from Blockfrost API: ${currentUtxos.length}`);

    console.log('\nDetailed UTXO list:');
    allUtxos.forEach((utxo, idx) => {
      const assetList = utxo.amount
        .map(a => `${a.quantity} ${a.unit === 'lovelace' ? 'ADA' : a.unit.slice(0, 8)}`)
        .join(', ');
      console.log(
        `  ${idx + 1}. ${utxo.tx_hash.slice(0, 8)}:${utxo.output_index} (${assetList}) [${utxo.isSpent ? `SPENT in ${utxo.spentInTx?.slice(0, 8)}` : 'UNSPENT'}]`,
      );
    });

    return allUtxos.sort((a, b) => b.tx_hash.localeCompare(a.tx_hash));
  } catch (error) {
    console.error('Failed to fetch wallet UTXOs:', error);
    return [];
  }
};

/**
 * Gets payment addresses for a wallet.
 */
export const getWalletPaymentAddresses = async (wallet: Wallet): Promise<string[]> => {
  const { apiUrl, apiKey } = await getApiConfigForWallet(wallet);
  const stakeAddress = wallet.stakeAddress;

  if (!stakeAddress) {
    console.log('No stake address found for wallet');
    return [];
  }

  try {
    return await getPaymentAddresses(apiUrl, apiKey, stakeAddress);
  } catch (error) {
    console.error('Failed to fetch wallet payment addresses:', error);
    return [];
  }
};
