import { walletsStorage, transactionsStorage } from '@extension/storage';

// CIP-30 Permission Storage (in-memory for now)
const dappPermissions = new Map<string, { origin: string; approved: boolean; timestamp: number }>();
const pendingPermissions = new Map<string, { resolve: Function; reject: Function }>();

export const handleCip30Messages = async (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): Promise<boolean> => {
  try {
    switch (message.type) {
      case 'CIP30_ENABLE_REQUEST': {
        const { origin } = message.payload;
        const tabId = sender.tab?.id;

        // Check if already approved
        const existingPermission = dappPermissions.get(origin);
        if (existingPermission?.approved) {
          sendResponse({ success: true, approved: true });
          return true;
        }

        // Open extension popup and navigate to permission page
        try {
          // Store pending request
          const permissionKey = `${origin}_${tabId}`;
          pendingPermissions.set(permissionKey, {
            resolve: (approved: boolean) => {
              if (approved) {
                dappPermissions.set(origin, {
                  origin,
                  approved: true,
                  timestamp: Date.now(),
                });
              }
              sendResponse({ success: true, approved });
            },
            reject: (error: any) => {
              sendResponse({ success: false, error });
            },
          });

          // Open extension popup with permission page
          await chrome.action.openPopup();

          // Send navigation message to popup
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'NAVIGATE_TO_PERMISSION',
              payload: {
                origin,
                tabId,
              },
            });
          }, 100); // Small delay to ensure popup is open
        } catch (error) {
          console.error('Failed to open extension popup:', error);
          sendResponse({ success: false, error: 'Failed to show permission dialog' });
        }
        return true;
      }

      case 'CIP30_PERMISSION_RESPONSE': {
        const { origin, approved, tabId } = message.payload;
        const permissionKey = `${origin}_${tabId}`;

        const pending = pendingPermissions.get(permissionKey);
        if (pending) {
          pending.resolve(approved);
          pendingPermissions.delete(permissionKey);
        }

        sendResponse({ success: true });
        return true;
      }

      case 'CIP30_IS_ENABLED_REQUEST': {
        const { origin } = message.payload;
        const permission = dappPermissions.get(origin);

        sendResponse({
          success: true,
          enabled: permission?.approved || false,
        });
        return true;
      }

      case 'CIP30_GET_NETWORK_ID': {
        // Get active wallet's network
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -1, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_NETWORK_ID: Using wallet:', currentWallet.name, 'Network:', currentWallet.network);

        sendResponse({
          success: true,
          network: currentWallet.network,
        });
        return true;
      }

      case 'CIP30_GET_UTXOS': {
        // Get active wallet's UTXOs
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -2, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_UTXOS: Using wallet:', currentWallet.name);

        try {
          console.log('CIP30_GET_UTXOS: Getting UTXOs for wallet:', currentWallet.id);
          const unspentUTXOs = await transactionsStorage.getWalletUnspentUTXOs(currentWallet.id);
          console.log('CIP30_GET_UTXOS: UTXOs retrieved successfully');

          console.log('CIP30_GET_UTXOS: Found UTXOs:', unspentUTXOs.length);
          console.log('CIP30_GET_UTXOS: First UTXO sample:', unspentUTXOs[0]);

          const { amount, paginate } = message.payload || {};
          console.log('CIP30_GET_UTXOS: Request params:', { amount, paginate });

          // If amount is specified, implement coin selection
          if (amount) {
            const targetAmount = BigInt(amount); // CBOR-decoded amount in lovelace

            // Filter out UTXOs containing NFTs (assets with quantity < 10)
            const candidateUTXOs = unspentUTXOs.filter(utxo => {
              // Check if any non-ADA assets have quantity < 10 (likely NFTs)
              const hasNFTs = utxo.amount.some(asset => {
                if (asset.unit === 'lovelace') return false; // Skip ADA
                return BigInt(asset.quantity) < BigInt(10); // < 10 = likely NFT
              });

              return !hasNFTs; // Only include UTXOs without NFTs
            });

            console.log('CIP30_GET_UTXOS: After NFT filtering:', candidateUTXOs.length);

            // Sort by ADA value ascending (smallest first)
            candidateUTXOs.sort((a, b) => {
              const aAmount = BigInt(a.amount.find(amt => amt.unit === 'lovelace')?.quantity || '0');
              const bAmount = BigInt(b.amount.find(amt => amt.unit === 'lovelace')?.quantity || '0');
              return aAmount < bAmount ? -1 : aAmount > bAmount ? 1 : 0;
            });

            // Simple greedy coin selection algorithm
            const selectedUTXOs = [];
            let totalSelected = BigInt(0);

            for (const utxo of candidateUTXOs) {
              const adaAmount = BigInt(utxo.amount.find(amt => amt.unit === 'lovelace')?.quantity || '0');
              selectedUTXOs.push(utxo);
              totalSelected += adaAmount;

              if (totalSelected >= targetAmount) {
                break;
              }
            }

            console.log('CIP30_GET_UTXOS: Selected UTXOs:', selectedUTXOs.length, 'Total:', totalSelected.toString());

            // If we couldn't reach the target amount, return null
            if (totalSelected < targetAmount) {
              sendResponse({
                success: true,
                utxos: null,
              });
              return true;
            }

            // Return selected UTXOs (need to convert to CBOR format)
            sendResponse({
              success: true,
              utxos: selectedUTXOs,
            });
          } else {
            // Return all unspent UTXOs (need to convert to CBOR format)
            console.log('CIP30_GET_UTXOS: Returning all UTXOs:', unspentUTXOs.length);
            sendResponse({
              success: true,
              utxos: unspentUTXOs,
            });
          }
        } catch (error) {
          console.error('CIP30_GET_UTXOS: Error retrieving UTXOs:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error('CIP30_GET_UTXOS: Error stack:', error instanceof Error ? error.stack : 'No stack');
          console.error('CIP30_GET_UTXOS: Error message:', errorMsg);
          sendResponse({
            success: false,
            error: { code: -2, info: `Failed to retrieve UTXOs: ${errorMsg}` },
          });
        }
        return true;
      }

      case 'CIP30_GET_BALANCE': {
        // Get active wallet's balance
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -3, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_BALANCE: Using wallet:', currentWallet.name);

        try {
          // SIMPLIFIED: Use the wallet's stored balance directly instead of calling getWalletState
          // This ensures we get the balance that was fetched when the wallet was spoofed/created
          const storedBalance = currentWallet.balance;

          console.log('CIP30_GET_BALANCE: Wallet stored balance:', storedBalance);

          // The stored balance is already in lovelaces from Blockfrost
          // No need to multiply by 1,000,000 since it's not in ADA format
          const balanceLovelace = parseInt(storedBalance);

          if (isNaN(balanceLovelace)) {
            console.error('Could not parse balance as lovelaces:', storedBalance);
            sendResponse({
              success: false,
              error: { code: -4, info: 'Invalid balance format' },
            });
            return true;
          }

          console.log('Balance conversion:', {
            original: storedBalance,
            lovelace: balanceLovelace,
          });

          sendResponse({
            success: true,
            balance: balanceLovelace.toString(),
          });
        } catch (error) {
          console.error('Error getting balance:', error);
          sendResponse({
            success: false,
            error: { code: -4, info: 'Failed to get balance' },
          });
        }
        return true;
      }

      case 'CIP30_GET_WALLET_NAME': {
        // Get active wallet's name
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -5, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_WALLET_NAME: Using wallet:', currentWallet.name);

        sendResponse({
          success: true,
          name: currentWallet.name,
        });
        return true;
      }

      case 'CIP30_GET_REWARD_ADDRESSES': {
        // Get active wallet's reward addresses (stake address)
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -6, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_REWARD_ADDRESSES: Using wallet:', currentWallet.name);
        console.log('CIP30_GET_REWARD_ADDRESSES: Wallet stakeAddress:', currentWallet.stakeAddress);
        console.log('CIP30_GET_REWARD_ADDRESSES: Full wallet object keys:', Object.keys(currentWallet));

        // Return array containing the wallet's stake address
        sendResponse({
          success: true,
          rewardAddresses: [currentWallet.stakeAddress],
        });
        return true;
      }

      case 'CIP30_GET_USED_ADDRESSES': {
        // Get active wallet's used addresses (wallet address)
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -7, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_USED_ADDRESSES: Using wallet:', currentWallet.name);

        // Return array containing the wallet's address
        sendResponse({
          success: true,
          addresses: [currentWallet.address],
        });
        return true;
      }

      case 'CIP30_GET_UNUSED_ADDRESSES': {
        // Get active wallet's unused addresses
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -7, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_UNUSED_ADDRESSES: Using wallet:', currentWallet.name);

        // Simple implementation based on wallet type:
        // - If spoofed wallet: return empty list
        // - If imported/created wallet: return wallet address
        let unusedAddresses: string[] = [];

        if (currentWallet.type === 'SPOOFED') {
          // Spoofed wallets return empty list
          unusedAddresses = [];
        } else {
          // For imported/created wallets, return the wallet's address
          unusedAddresses = [currentWallet.address];
        }

        sendResponse({
          success: true,
          addresses: unusedAddresses,
        });
        return true;
      }

      case 'CIP30_GET_CHANGE_ADDRESS': {
        // Get active wallet's change address (just return the wallet address)
        const currentWallet = await walletsStorage.getActiveWallet();

        if (!currentWallet) {
          sendResponse({
            success: false,
            error: { code: -8, info: 'No wallet available' },
          });
          return true;
        }

        console.log('CIP30_GET_CHANGE_ADDRESS: Using wallet:', currentWallet.name);

        // Simple implementation: return wallet's address as change address
        sendResponse({
          success: true,
          address: currentWallet.address,
        });
        return true;
      }

      default:
        // Not a CIP-30 message, let other handlers deal with it
        return false;
    }
  } catch (error) {
    console.error(`Error handling CIP-30 message type ${message.type}:`, error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'An unknown error occurred.' });
    return true;
  }
};
