// CBOR converter for UTXOs using Cardano WASM
import { CardanoLoader } from '../../popup/src/utils/cardano_loader';

// Helper functions for hex conversion (browser-compatible)
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export class CBORConverter {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load WASM using CardanoLoader pattern (same as popup)
      await CardanoLoader.load();
      this.initialized = true;
      console.log('CBOR Converter: WASM loaded successfully');
    } catch (error) {
      console.error('CBOR Converter: Failed to initialize WASM:', error);
      throw new Error(`Failed to initialize WASM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert UTXORecord to TransactionUnspentOutput CBOR
   * TransactionUnspentOutput = [input, output]
   * where input = [transaction_id, index] and output = full transaction output
   */
  convertUtxosToCbor(utxos: any[]): string[] {
    if (!this.initialized) {
      throw new Error('CBOR Converter not initialized');
    }

    const wasm = CardanoLoader.Cardano;

    return utxos.map(utxo => {
      try {
        // Create transaction input [tx_hash, output_index]
        const txHash = wasm.TransactionHash.from_hex(utxo.tx_hash);
        const input = wasm.TransactionInput.new(txHash, utxo.output_index);

        // Create transaction output
        const address = wasm.Address.from_bech32(utxo.address);

        // Build the value (ADA + assets)
        const adaAmount = utxo.amount.find((a: any) => a.unit === 'lovelace');
        const lovelaceValue = wasm.BigNum.from_str(adaAmount?.quantity || '0');
        const value = wasm.Value.new(lovelaceValue);

        // Add multi-assets if any
        const nonAdaAssets = utxo.amount.filter((a: any) => a.unit !== 'lovelace');
        if (nonAdaAssets.length > 0) {
          const multiAsset = wasm.MultiAsset.new();

          // Group assets by policy ID
          const assetsByPolicy = new Map<string, Array<{ name: string; quantity: string }>>();

          nonAdaAssets.forEach((asset: any) => {
            if (asset.unit.length >= 56) {
              // Valid policy ID + asset name
              const policyId = asset.unit.slice(0, 56);
              const assetName = asset.unit.slice(56);

              if (!assetsByPolicy.has(policyId)) {
                assetsByPolicy.set(policyId, []);
              }
              assetsByPolicy.get(policyId)!.push({
                name: assetName,
                quantity: asset.quantity,
              });
            }
          });

          // Add each policy and its assets
          assetsByPolicy.forEach((assets, policyId) => {
            const scriptHash = wasm.ScriptHash.from_hex(policyId);
            const assetsMap = wasm.Assets.new();

            assets.forEach(asset => {
              const assetName = wasm.AssetName.new(hexToBytes(asset.name));
              const assetValue = wasm.BigNum.from_str(asset.quantity);
              assetsMap.insert(assetName, assetValue);
            });

            multiAsset.insert(scriptHash, assetsMap);
          });

          value.set_multiasset(multiAsset);
        }

        // Create the transaction output
        const output = wasm.TransactionOutput.new(address, value);

        // Handle datum if present
        if (utxo.inline_datum) {
          const datum = wasm.PlutusData.from_hex(utxo.inline_datum);
          output.set_plutus_data(datum);
        } else if (utxo.data_hash) {
          const dataHash = wasm.DataHash.from_hex(utxo.data_hash);
          output.set_data_hash(dataHash);
        }

        // Handle reference script if present
        if (utxo.reference_script_hash) {
          // Note: We would need the full script, not just the hash
          // For now, we'll skip this as Blockfrost doesn't provide the full script
          console.warn('Reference script present but cannot be included without full script data');
        }

        // Create TransactionUnspentOutput [input, output]
        const unspentOutput = wasm.TransactionUnspentOutput.new(input, output);

        // Convert to CBOR hex
        const cborHex = bytesToHex(unspentOutput.to_bytes());

        console.log('CBOR Converter: Converted UTXO to CBOR:', {
          utxoId: `${utxo.tx_hash}:${utxo.output_index}`,
          cborLength: cborHex.length,
          cbor: cborHex.slice(0, 100) + '...', // Log first 100 chars
        });

        return cborHex;
      } catch (error) {
        console.error('CBOR Converter: Failed to convert UTXO:', utxo, error);
        throw new Error(`Failed to convert UTXO: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }
}

export const cborConverter = new CBORConverter();
