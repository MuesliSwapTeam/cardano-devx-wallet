import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStorage, walletsStorage } from '@extension/storage';
import type { Wallet } from '@extension/shared';
import type { UTXORecord, TransactionRecord } from '@extension/storage';
import { TruncateWithCopy } from '@extension/shared';

const UTXODetail: React.FC = () => {
  const { walletId, txHash, outputIndex } = useParams<{ walletId: string; txHash: string; outputIndex: string }>();
  const navigate = useNavigate();
  const walletsData = useStorage(walletsStorage);
  const wallets = walletsData?.wallets || [];
  const wallet = wallets.find((w: Wallet) => w.id === walletId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [utxo, setUtxo] = useState<UTXORecord | null>(null);
  const [creatingTransaction, setCreatingTransaction] = useState<TransactionRecord | null>(null);
  const [spendingTransaction, setSpendingTransaction] = useState<TransactionRecord | null>(null);
  const [assetDetails, setAssetDetails] = useState<{ [unit: string]: any }>({});

  const BLOCKFROST_PROJECT_ID = 'preprodUCRP6WTpWi0DXWZF4eduE2VZPod9CjAJ'; // Preprod Blockfrost project ID

  const decodeAssetName = (hex: string): string => {
    if (!hex) return null; // Return null if empty, so we skip display
    try {
      const bytes: number[] = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const decoded = decoder.decode(new Uint8Array(bytes));
      const trimmed = decoded.trim();
      return trimmed ? trimmed : null; // Skip if empty after trim
    } catch (e) {
      return null; // Fail silently for binary/non-text
    }
  };

  const getUnitDetails = async (unit: string) => {
    if (unit === 'lovelace' || !unit || assetDetails[unit]) {
      return assetDetails[unit];
    }

    try {
      const response = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/assets/${unit}`, {
        method: 'GET',
        headers: {
          project_id: BLOCKFROST_PROJECT_ID,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAssetDetails(prev => ({ ...prev, [unit]: data }));
      return data;
    } catch (err) {
      console.error('Failed to fetch asset details:', err);
      setAssetDetails(prev => ({ ...prev, [unit]: { asset_name: '', metadata: { decimals: 0 } } }));
      return { asset_name: '', metadata: { decimals: 0 } };
    }
  };

  useEffect(() => {
    if (!txHash || !outputIndex || !wallet) {
      setError(!wallet ? 'Wallet not found' : 'Invalid UTXO reference');
      setLoading(false);
      return;
    }

    const fetchUTXODetails = () => {
      setLoading(true);
      setError(null);

      chrome.runtime.sendMessage(
        {
          type: 'GET_UTXO_DETAILS',
          payload: { txHash, outputIndex: parseInt(outputIndex), walletId: wallet.id },
        },
        response => {
          if (response?.success) {
            setUtxo(response.utxo);

            // Fetch creating transaction details
            chrome.runtime.sendMessage(
              {
                type: 'GET_TRANSACTIONS',
                payload: { walletId: wallet.id },
              },
              txResponse => {
                if (txResponse?.success) {
                  const transactions = txResponse.transactions as TransactionRecord[];

                  // Find creating transaction
                  const creating = transactions.find(tx => tx.hash === txHash);
                  if (creating) {
                    setCreatingTransaction(creating);
                  }

                  // Find spending transaction if UTXO is spent
                  if (response.utxo.isSpent && response.utxo.spentInTx) {
                    const spending = transactions.find(tx => tx.hash === response.utxo.spentInTx);
                    if (spending) {
                      setSpendingTransaction(spending);
                    }
                  }
                }
                setLoading(false);
              },
            );
          } else {
            console.error('Failed to fetch UTXO details:', response?.error);
            setError(response?.error || 'Failed to fetch UTXO details');
            setLoading(false);
          }
        },
      );
    };

    fetchUTXODetails();
  }, [txHash, outputIndex, wallet?.id]);

  useEffect(() => {
    const fetchAssetDetails = async () => {
      if (!utxo) return;

      const otherAssets = utxo.amount.filter(a => a.unit !== 'lovelace');

      for (const asset of otherAssets) {
        await getUnitDetails(asset.unit);
      }
    };

    fetchAssetDetails();
  }, [utxo]);

  const formatAda = (lovelace: string) => {
    return (parseInt(lovelace) / 1000000).toFixed(6) + ' ADA';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Back
          </button>
          <h2 className="text-lg font-semibold">UTXO Details</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="size-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
            <span>Loading UTXO details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !utxo || !wallet) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Back
          </button>
          <h2 className="text-lg font-semibold">UTXO Details</h2>
        </div>
        <div className="text-sm text-red-500">{error || (!wallet ? 'Wallet not found' : 'UTXO not found')}</div>
      </div>
    );
  }

  const adaAmount = utxo.amount.find(a => a.unit === 'lovelace');
  const otherAssets = utxo.amount.filter(a => a.unit !== 'lovelace');

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back
        </button>
        <h2 className="text-lg font-semibold">UTXO Details</h2>
        <div className="ml-auto flex items-center gap-2">
          {utxo.isExternal && (
            <div className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              External
            </div>
          )}
          <div
            className={`rounded-full px-3 py-1 text-sm ${
              utxo.isSpent
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
            {utxo.isSpent ? 'Spent' : 'Unspent'}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <h3 className="mb-3 text-base font-bold text-gray-900 dark:text-white">Basic Information</h3>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <strong className="text-gray-600 dark:text-gray-400">Transaction Hash:</strong>
              <TruncateWithCopy text={utxo.tx_hash} maxChars={10} />
            </div>
            <div className="flex items-center justify-between">
              <strong className="text-gray-600 dark:text-gray-400">Output Index:</strong>
              <div>{utxo.output_index}</div>
            </div>
            <div className="flex items-center justify-between">
              <strong className="text-gray-600 dark:text-gray-400">Address:</strong>
              <TruncateWithCopy text={utxo.address} maxChars={10} />
            </div>
            <div className="flex items-center justify-between">
              <strong className="text-gray-600 dark:text-gray-400">Block:</strong>
              <TruncateWithCopy text={utxo.block} maxChars={10} />
            </div>
          </div>
        </div>

        {/* External UTXO Information */}
        {utxo.isExternal && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-900/30">
            <h3 className="text-md mb-3 flex items-center gap-2 font-semibold text-orange-900 dark:text-orange-100">
              ⚠️ External UTXO
            </h3>
            <div className="space-y-3 text-sm">
              <div className="text-orange-800 dark:text-orange-200">
                This UTXO belongs to an external address, not your wallet. It appears in your transaction history
                because it was either an input to a transaction that involved your wallet, or an output that went to an
                external address.
              </div>
              <div className="text-xs italic text-orange-700 dark:text-orange-400">
                External UTXOs are tracked for transaction completeness but do not belong to your wallet.
              </div>
            </div>
          </div>
        )}

        {/* Value Information */}
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <h3 className="mb-3 text-base font-bold text-gray-900 dark:text-white">Value</h3>
          <div className="space-y-3">
            {/* ADA Amount */}
            {adaAmount && (
              <div className="rounded bg-blue-50 p-3 dark:bg-blue-900/30">
                <div className="flex flex-col items-center">
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {formatAda(adaAmount.quantity)}
                  </div>
                  <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                    {parseInt(adaAmount.quantity).toLocaleString()} Lovelace
                  </div>
                </div>
              </div>
            )}

            {/* Other Assets */}
            {otherAssets.length > 0 && (
              <div>
                <h4 className="mb-2 text-base font-bold text-gray-900 dark:text-white">
                  Native Tokens ({otherAssets.length})
                </h4>
                <div className="space-y-2">
                  {otherAssets.map((asset, idx) => {
                    const details = assetDetails[asset.unit] || {};
                    const assetNameHex = details.asset_name || '';
                    const decodedName = decodeAssetName(assetNameHex);
                    const metadata = details.metadata || {};
                    const decimals = metadata.decimals || 0;
                    const rawQuantity = parseInt(asset.quantity);
                    let formattedQuantity: string;
                    if (decimals > 0) {
                      formattedQuantity = (rawQuantity / Math.pow(10, decimals)).toFixed(decimals);
                    } else {
                      formattedQuantity = rawQuantity.toLocaleString();
                    }
                    const hexStringToShow = assetNameHex || asset.unit.slice(56); // Use asset_name if available, else full unit's name part

                    return (
                      <div key={idx} className="rounded bg-purple-50 p-3 dark:bg-purple-900/30">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Asset Name:</span>
                            <TruncateWithCopy text={hexStringToShow} maxChars={10} />
                          </div>
                          {decodedName && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Asset Name Decoded:</span>
                              <span className="font-medium text-purple-900 dark:text-purple-100">{decodedName}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                            <span className="font-medium text-purple-900 dark:text-purple-100">
                              {formattedQuantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Technical Details */}
        {(utxo.data_hash || utxo.inline_datum || utxo.reference_script_hash) && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <h3 className="mb-3 text-base font-bold text-gray-900 dark:text-white">Technical Details</h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              {utxo.data_hash && (
                <div className="flex items-center justify-between">
                  <strong className="text-gray-600 dark:text-gray-400">Data Hash:</strong>
                  <TruncateWithCopy text={utxo.data_hash} maxChars={10} />
                </div>
              )}
              {utxo.inline_datum && (
                <div className="flex items-center justify-between">
                  <strong className="text-gray-600 dark:text-gray-400">Inline Datum:</strong>
                  <TruncateWithCopy text={utxo.inline_datum} maxChars={10} />
                </div>
              )}
              {utxo.reference_script_hash && (
                <div className="flex items-center justify-between">
                  <strong className="text-gray-600 dark:text-gray-400">Reference Script Hash:</strong>
                  <TruncateWithCopy text={utxo.reference_script_hash} maxChars={10} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction Information */}
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <h3 className="mb-3 text-base font-bold text-gray-900 dark:text-white">Transactions</h3>
          <div className="grid grid-cols-1 gap-3 text-sm">
            {/* Creating Transaction */}
            <div className="border-l-4 border-green-500 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-green-700 dark:text-green-300">Created by Transaction:</strong>
                  {creatingTransaction && (
                    <div className="mt-1 text-xs text-gray-500">
                      {formatDate(creatingTransaction.block_time)} • Block #{creatingTransaction.block_height}
                    </div>
                  )}
                </div>
                <TruncateWithCopy text={utxo.tx_hash} maxChars={10} />
              </div>
            </div>

            {/* Spending Transaction */}
            {utxo.isSpent && utxo.spentInTx && (
              <div className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-red-700 dark:text-red-300">Spent by Transaction:</strong>
                    {spendingTransaction && (
                      <div className="mt-1 text-xs text-gray-500">
                        {formatDate(spendingTransaction.block_time)} • Block #{spendingTransaction.block_height}
                      </div>
                    )}
                  </div>
                  <TruncateWithCopy text={utxo.spentInTx} maxChars={10} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UTXODetail;
