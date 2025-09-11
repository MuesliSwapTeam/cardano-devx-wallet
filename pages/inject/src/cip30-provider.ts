// CIP-30 Provider Implementation for DevX Wallet

type Paginate = {} | undefined;

interface CIP30API {
  enable(): Promise<WalletAPI>;
  isEnabled(): Promise<boolean>;
  name: string;
  icon: string;
  apiVersion: string;
}

interface WalletAPI {
  getNetworkId(): Promise<number>;
  getUtxos(amount?: string, paginate?: Paginate): Promise<string[] | null>;
  getBalance(): Promise<string>;
  getName(): Promise<string>;
  getUsedAddresses(paginate?: Paginate): Promise<string[]>;
  getUnusedAddresses(paginate?: Paginate): Promise<string[]>;
  getRewardAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
}

interface APIError {
  code: number;
  info: string;
}

class DevXCIP30Provider implements CIP30API {
  public readonly name = 'DevX';
  public readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzM5OTZGRiIvPgo8cGF0aCBkPSJNOCAxNkMxMSAxMyAxNSAxMyAxOCAxNkMyMSAxOSAyMSAyMyAxOCAyNkMxNSAyOSAxMSAyOSA4IDI2QzUgMjMgNSAxOSA4IDE2WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+'; // DevX logo
  public readonly apiVersion = '0.1.0';

  private walletAPI: WalletAPI | null = null;

  async enable(): Promise<WalletAPI> {
    try {
      // Send message to background script to show permission popup
      const response = await this.sendMessage({
        type: 'CIP30_ENABLE_REQUEST',
        payload: {
          origin: window.location.origin,
          walletName: this.name,
        },
      });

      if (response.success) {
        // Create and return the wallet API instance
        this.walletAPI = new DevXWalletAPI();
        return this.walletAPI;
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: Enable failed:', error);
      throw {
        code: -1,
        info: 'Failed to enable wallet connection',
      } as APIError;
    }
  }

  async isEnabled(): Promise<boolean> {
    try {
      const response = await this.sendMessage({
        type: 'CIP30_IS_ENABLED_REQUEST',
        payload: {
          origin: window.location.origin,
        },
      });

      return response.success && response.enabled;
    } catch (error) {
      console.error('DevX CIP-30: isEnabled check failed:', error);
      return false;
    }
  }
  // dont expose
  private async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Generate unique ID for this message
      const messageId = `devx_${Date.now()}_${Math.random()}`;

      // Listen for response from content script
      const handleResponse = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data.type === 'DEVX_CIP30_RESPONSE' && event.data.messageId === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(event.data.response);
        }
      };

      window.addEventListener('message', handleResponse);

      // Send message to content script via postMessage
      window.postMessage(
        {
          type: 'DEVX_CIP30_REQUEST',
          messageId: messageId,
          message: message,
        },
        '*',
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error('CIP-30 request timeout'));
      }, 30000);
    });
  }
}

class DevXWalletAPI implements WalletAPI {
  async getNetworkId(): Promise<number> {
    try {
      const response = await this.sendMessage({
        type: 'CIP30_GET_NETWORK_ID',
      });

      if (response.success) {
        // Convert network string to CIP-30 network ID
        // Mainnet = 1, Preprod/Preview = 0
        return response.network === 'Mainnet' ? 1 : 0;
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getNetworkId failed:', error);
      throw {
        code: -2,
        info: 'Failed to get network ID',
      } as APIError;
    }
  }

  async getUtxos(amount?: string, paginate?: Paginate): Promise<string[] | null> {
    try {
      // Decode CBOR amount if provided
      let decodedAmount: string | undefined;
      if (amount) {
        // Simple CBOR decoding for integer values (reverse of our encoding in getBalance)
        // This is a simplified decoder - in a real implementation you'd use a proper CBOR library
        decodedAmount = this.decodeCborAmount(amount);
      }

      const response = await this.sendMessage({
        type: 'CIP30_GET_UTXOS',
        payload: {
          amount: decodedAmount,
          paginate,
        },
      });

      if (response.success) {
        // Handle null response when coin selection fails
        if (response.utxos === null) {
          return null;
        }

        // UTXOs are already converted to CBOR by the content script
        return response.utxos || [];
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getUtxos failed:', error);
      console.error('DevX CIP-30: getUtxos error details:', error instanceof Error ? error.message : error);
      throw {
        code: -3,
        info: 'Failed to get UTXOs',
      } as APIError;
    }
  }

  // Simple CBOR amount decoder (reverse of encoding in getBalance)
  private decodeCborAmount(cborHex: string): string {
    // This is a simplified decoder for demonstration
    // In practice, you'd use a proper CBOR library
    if (cborHex === '00') return '0';

    const firstByte = parseInt(cborHex.slice(0, 2), 16);

    if (firstByte <= 23) {
      return firstByte.toString();
    } else if (firstByte === 0x18) {
      return parseInt(cborHex.slice(2, 4), 16).toString();
    } else if (firstByte === 0x19) {
      return parseInt(cborHex.slice(2, 6), 16).toString();
    } else if (firstByte === 0x1a) {
      return parseInt(cborHex.slice(2, 10), 16).toString();
    } else if (firstByte === 0x1b) {
      return BigInt('0x' + cborHex.slice(2, 18)).toString();
    }

    throw new Error('Unsupported CBOR encoding');
  }

  async getBalance(): Promise<string> {
    try {
      const response = await this.sendMessage({
        type: 'CIP30_GET_BALANCE',
      });

      if (response.success) {
        // Convert balance from lovelace string to CBOR
        const balanceLovelace = response.balance; // This is a string of lovelaces

        // Simple CBOR encoding for integer without WASM
        // CBOR major type 0 (unsigned integer)
        const balance = BigInt(balanceLovelace);

        if (balance === BigInt(0)) {
          return '00'; // CBOR encoding of 0
        } else if (balance <= BigInt(23)) {
          return balance.toString(16).padStart(2, '0'); // Direct encoding
        } else if (balance <= BigInt(255)) {
          return '18' + balance.toString(16).padStart(2, '0'); // 1-byte integer
        } else if (balance <= BigInt(65535)) {
          const hex = balance.toString(16).padStart(4, '0');
          return '19' + hex; // 2-byte integer
        } else if (balance <= BigInt(4294967295)) {
          const hex = balance.toString(16).padStart(8, '0');
          return '1a' + hex; // 4-byte integer
        } else {
          const hex = balance.toString(16).padStart(16, '0');
          return '1b' + hex; // 8-byte integer
        }
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getBalance failed:', error);
      throw {
        code: -4,
        info: 'Failed to get balance',
      } as APIError;
    }
  }

  async getName(): Promise<string> {
    try {
      const response = await this.sendMessage({
        type: 'CIP30_GET_WALLET_NAME',
      });

      if (response.success) {
        return response.name || 'DevX Wallet';
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getName failed:', error);
      throw {
        code: -5,
        info: 'Failed to get wallet name',
      } as APIError;
    }
  }

  // api.getUsedAddresses(paginate: Paginate = undefined): Promise<Address[]>
  // ignore Paginate
  async getUsedAddresses(paginate: Paginate = undefined): Promise<string[]> {
    // handle Paginate not undefined
    if (paginate) {
      console.warn('DevX CIP-30: getUsedAddresses called without pagination, returning all addresses');
    }

    try {
      const response = await this.sendMessage({
        type: 'CIP30_GET_USED_ADDRESSES',
      });

      if (response.success) {
        return response.addresses || [];
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getUsedAddresses failed:', error);
      throw {
        code: -7,
        info: 'Failed to get used addresses',
      } as APIError;
    }
  }

  // api.getUnusedAddresses(paginate: Paginate = undefined): Promise<Address[]>
  // ignore Paginate
  async getUnusedAddresses(paginate: Paginate = undefined): Promise<string[]> {
    // handle Paginate not undefined
    if (paginate) {
      console.warn('DevX CIP-30: getUnusedAddresses called with pagination, returning all addresses');
    }

    try {
      const response = await this.sendMessage({
        type: 'CIP30_GET_UNUSED_ADDRESSES',
      });

      if (response.success) {
        return response.addresses || [];
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getUnusedAddresses failed:', error);
      throw {
        code: -7,
        info: 'Failed to get unused addresses',
      } as APIError;
    }
  }

  async getRewardAddresses(): Promise<string[]> {
    try {
      const response = await this.sendMessage({
        type: 'CIP30_GET_REWARD_ADDRESSES',
      });

      if (response.success) {
        return response.rewardAddresses || [];
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getRewardAddresses failed:', error);
      throw {
        code: -6,
        info: 'Failed to get reward addresses',
      } as APIError;
    }
  }

  async getChangeAddress(): Promise<string> {
    try {
      const response = await this.sendMessage({
        type: 'CIP30_GET_CHANGE_ADDRESS',
      });

      if (response.success) {
        return response.address;
      } else {
        throw new APIError(response.error.code, response.error.info);
      }
    } catch (error) {
      console.error('DevX CIP-30: getChangeAddress failed:', error);
      throw {
        code: -8,
        info: 'Failed to get change address',
      } as APIError;
    }
  }

  private async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Generate unique ID for this message
      const messageId = `devx_${Date.now()}_${Math.random()}`;

      // Listen for response from content script
      const handleResponse = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data.type === 'DEVX_CIP30_RESPONSE' && event.data.messageId === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(event.data.response);
        }
      };

      window.addEventListener('message', handleResponse);

      // Send message to content script via postMessage
      window.postMessage(
        {
          type: 'DEVX_CIP30_REQUEST',
          messageId: messageId,
          message: message,
        },
        '*',
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error('CIP-30 request timeout'));
      }, 30000);
    });
  }
}

export function createDevXCIP30Provider(): CIP30API {
  return new DevXCIP30Provider();
}

// Type definitions for error handling
class APIError extends Error {
  constructor(
    public code: number,
    public info: string,
  ) {
    super(info);
    this.name = 'APIError';
  }
}
