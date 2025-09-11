import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Wallet } from '@extension/shared';
import { TruncateWithCopy } from '@extension/shared';
import type { TransactionRecord } from '@extension/storage';

interface TransactionDetailProps {
  tx: TransactionRecord;
  wallet: Wallet;
  formatAda: (lovelace: string) => string;
  formatDate: (timestamp: number) => string;
}

const TransactionDetail: React.FC<TransactionDetailProps> = ({ tx, wallet, formatAda, formatDate }) => {
  const [expandFromUTXOs, setExpandFromUTXOs] = useState(false);
  const [expandToUTXOs, setExpandToUTXOs] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [showCollaterals, setShowCollaterals] = useState(false);

  // Helper function to determine if an address is external
  const isExternalAddress = (address: string): boolean => {
    return address !== wallet.address;
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      {/* General Info Section */}
      <div className="border-b border-gray-200 p-3 dark:border-gray-700">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Transaction Details</h4>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="flex items-center justify-between">
            <strong>Hash:</strong>
            <TruncateWithCopy text={tx.hash} maxChars={16} />
          </div>
          <div className="flex justify-between">
            <strong>Time:</strong>
            <span>{formatDate(tx.block_time)}</span>
          </div>
          <div className="flex justify-between">
            <strong>Block:</strong>
            <span>#{tx.block_height}</span>
          </div>
          <div className="flex justify-between">
            <strong>Fee:</strong>
            <span className="text-red-600 dark:text-red-400">{formatAda(tx.fees)}</span>
          </div>
          <div className="flex justify-between">
            <strong>Size:</strong>
            <span>{tx.size} bytes</span>
          </div>
          {tx.deposit && tx.deposit !== '0' && (
            <div className="flex justify-between">
              <strong>Deposit:</strong>
              <span>{formatAda(tx.deposit)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <strong>Slot:</strong>
            <span>{tx.slot || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-1">
              <strong>Index:</strong>
              <div className="group relative">
                <span className="inline-block size-3 cursor-help select-none rounded-full bg-gray-200 text-center text-xs leading-3 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  ?
                </span>
                <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                  Position of this transaction within its block (0-based)
                  <div className="absolute bottom-full left-2 size-0 border-x-2 border-b-2 border-transparent border-b-gray-800"></div>
                </div>
              </div>
            </div>
            <span>{tx.index || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <strong>UTXO Count:</strong>
            <span>{tx.utxo_count || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <strong>Valid Contract:</strong>
            <span>{tx.valid_contract ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <strong>Confirmations:</strong>
            <span className="text-green-600 dark:text-green-400">High</span>
          </div>
        </div>
      </div>

      {/* Filter Toggles */}
      <div className="border-b border-gray-200 p-3 dark:border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={() => setShowReferences(!showReferences)}
            className={`rounded px-3 py-1 text-xs transition ${
              showReferences
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}>
            {showReferences ? 'Hide' : 'Show'} References
          </button>
          <button
            onClick={() => setShowCollaterals(!showCollaterals)}
            className={`rounded px-3 py-1 text-xs transition ${
              showCollaterals
                ? 'bg-orange-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}>
            {showCollaterals ? 'Hide' : 'Show'} Collaterals
          </button>
        </div>
      </div>

      {/* From UTXOs Section */}
      {tx.inputs && tx.inputs.length > 0 && (
        <div className="border-b border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <h5 className="text-sm font-medium text-red-700 dark:text-red-300">Input UTXOs: {tx.inputs.length}</h5>
            <button
              onClick={() => setExpandFromUTXOs(!expandFromUTXOs)}
              className={`rounded px-2 py-1 text-xs transition ${
                expandFromUTXOs
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}>
              {expandFromUTXOs ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {!expandFromUTXOs ? (
            // Collapsed view - just links with tags
            <div className="space-y-1">
              {tx.inputs
                .filter(input => {
                  const hasCollateral = (input as any).collateral;
                  const hasReference = (input as any).reference;

                  // Show UTXO if:
                  // - It's not collateral AND not reference (normal UTXO)
                  // - It's collateral AND showCollaterals is true
                  // - It's reference AND showReferences is true
                  if (!hasCollateral && !hasReference) return true;
                  if (hasCollateral && !showCollaterals) return false;
                  if (hasReference && !showReferences) return false;
                  return true;
                })
                .map((input, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">#{idx + 1}:</span>
                      <Link
                        to={`/wallet/${wallet.id}/utxo/${input.tx_hash}/${input.output_index}`}
                        className="font-mono text-blue-600 hover:underline dark:text-blue-400">
                        {input.tx_hash.slice(0, 8)}...:{input.output_index}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1">
                      {isExternalAddress(input.address) && (
                        <span className="rounded bg-yellow-100 px-1 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          External
                        </span>
                      )}
                      {showCollaterals && (input as any).collateral && (
                        <span className="rounded bg-orange-100 px-1 py-0.5 text-xs text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          Collateral
                        </span>
                      )}
                      {showReferences && (input as any).reference && (
                        <span className="rounded bg-purple-100 px-1 py-0.5 text-xs text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          Reference
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Expanded view - simple list
            <div className="space-y-3">
              {tx.inputs
                .filter(input => {
                  const hasCollateral = (input as any).collateral;
                  const hasReference = (input as any).reference;

                  // Show UTXO if:
                  // - It's not collateral AND not reference (normal UTXO)
                  // - It's collateral AND showCollaterals is true
                  // - It's reference AND showReferences is true
                  if (!hasCollateral && !hasReference) return true;
                  if (hasCollateral && !showCollaterals) return false;
                  if (hasReference && !showReferences) return false;
                  return true;
                })
                .map((input, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                    {/* Address and tags */}
                    <div className="mb-2 flex items-center justify-between">
                      <TruncateWithCopy text={input.address} maxChars={16} />
                      <div className="flex items-center gap-1">
                        {isExternalAddress(input.address) && (
                          <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            External
                          </span>
                        )}
                        {showCollaterals && (input as any).collateral && (
                          <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            Collateral
                          </span>
                        )}
                        {showReferences && (input as any).reference && (
                          <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            Reference
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assets list */}
                    {input.amount && (
                      <div className="space-y-1">
                        {input.amount.map((amt, amtIdx) => (
                          <div key={amtIdx} className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            {amt.unit === 'lovelace' ? (
                              <div>{formatAda(amt.quantity)}</div>
                            ) : (
                              <div>
                                {parseInt(amt.quantity).toLocaleString()} {amt.unit.slice(0, 8)}...
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* To UTXOs Section */}
      {tx.outputs && tx.outputs.length > 0 && (
        <div className="border-b border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <h5 className="text-sm font-medium text-green-700 dark:text-green-300">
              Output UTXOs: {tx.outputs.length}
            </h5>
            <button
              onClick={() => setExpandToUTXOs(!expandToUTXOs)}
              className={`rounded px-2 py-1 text-xs transition ${
                expandToUTXOs
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}>
              {expandToUTXOs ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {!expandToUTXOs ? (
            // Collapsed view - just links with tags
            <div className="space-y-1">
              {tx.outputs
                .filter(output => {
                  const hasCollateral = (output as any).collateral;
                  const hasReference = (output as any).reference;

                  // Show UTXO if:
                  // - It's not collateral AND not reference (normal UTXO)
                  // - It's collateral AND showCollaterals is true
                  // - It's reference AND showReferences is true
                  if (!hasCollateral && !hasReference) return true;
                  if (hasCollateral && !showCollaterals) return false;
                  if (hasReference && !showReferences) return false;
                  return true;
                })
                .map((output, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">#{idx + 1}:</span>
                      <Link
                        to={`/wallet/${wallet.id}/utxo/${tx.hash}/${output.output_index}`}
                        className="font-mono text-blue-600 hover:underline dark:text-blue-400">
                        {tx.hash.slice(0, 8)}...:{output.output_index}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1">
                      {isExternalAddress(output.address) && (
                        <span className="rounded bg-yellow-100 px-1 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          External
                        </span>
                      )}
                      {showCollaterals && (output as any).collateral && (
                        <span className="rounded bg-orange-100 px-1 py-0.5 text-xs text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          Collateral
                        </span>
                      )}
                      {showReferences && (output as any).reference && (
                        <span className="rounded bg-purple-100 px-1 py-0.5 text-xs text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          Reference
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Expanded view - simple list
            <div className="space-y-3">
              {tx.outputs
                .filter(output => {
                  const hasCollateral = (output as any).collateral;
                  const hasReference = (output as any).reference;

                  // Show UTXO if:
                  // - It's not collateral AND not reference (normal UTXO)
                  // - It's collateral AND showCollaterals is true
                  // - It's reference AND showReferences is true
                  if (!hasCollateral && !hasReference) return true;
                  if (hasCollateral && !showCollaterals) return false;
                  if (hasReference && !showReferences) return false;
                  return true;
                })
                .map((output, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                    {/* Address and tags */}
                    <div className="mb-2 flex items-center justify-between">
                      <TruncateWithCopy text={output.address} maxChars={16} />
                      <div className="flex items-center gap-1">
                        {isExternalAddress(output.address) && (
                          <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            External
                          </span>
                        )}
                        {showCollaterals && (output as any).collateral && (
                          <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            Collateral
                          </span>
                        )}
                        {showReferences && (output as any).reference && (
                          <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            Reference
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assets list */}
                    {output.amount && (
                      <div className="space-y-1">
                        {output.amount.map((amt, amtIdx) => (
                          <div key={amtIdx} className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            {amt.unit === 'lovelace' ? (
                              <div>{formatAda(amt.quantity)}</div>
                            ) : (
                              <div>
                                {parseInt(amt.quantity).toLocaleString()} {amt.unit.slice(0, 8)}...
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Smart contract data */}
                    {((output as any).data_hash ||
                      (output as any).inline_datum ||
                      (output as any).reference_script_hash) && (
                      <div className="mt-2 border-t border-gray-300 pt-2 dark:border-gray-600">
                        <div className="mb-1 text-xs text-gray-700 dark:text-gray-300">
                          <strong>Smart Contract Data:</strong>
                        </div>
                        {(output as any).data_hash && (
                          <div className="text-xs">
                            <strong>Data Hash:</strong>{' '}
                            <TruncateWithCopy text={(output as any).data_hash} maxChars={12} className="inline-flex" />
                          </div>
                        )}
                        {(output as any).inline_datum && (
                          <div className="text-xs">
                            <strong>Inline Datum:</strong>{' '}
                            <TruncateWithCopy
                              text={(output as any).inline_datum}
                              maxChars={20}
                              className="inline-flex"
                            />
                          </div>
                        )}
                        {(output as any).reference_script_hash && (
                          <div className="text-xs">
                            <strong>Reference Script:</strong>{' '}
                            <TruncateWithCopy
                              text={(output as any).reference_script_hash}
                              maxChars={12}
                              className="inline-flex"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Withdrawals Section */}
      {tx.withdrawal_count > 0 && (
        <div className="border-b border-gray-200 p-3 dark:border-gray-700">
          <h5 className="mb-2 text-sm font-medium text-orange-700 dark:text-orange-300">
            Withdrawals: {tx.withdrawal_count}
          </h5>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Reward withdrawals detected in this transaction
          </div>
        </div>
      )}

      {/* Metadata Section */}
      <div className="p-3">
        <h5 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Metadata</h5>
        <div className="max-h-32 overflow-y-auto rounded border bg-gray-100 p-2 text-xs dark:bg-gray-900">
          {/* Show actual transaction metadata if available */}
          {(tx as any).metadata ? (
            <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify((tx as any).metadata, null, 2)}</pre>
          ) : (
            <div className="italic text-gray-500 dark:text-gray-400">No metadata found for this transaction</div>
          )}
        </div>

        {/* Smart Contract Activity */}
        {(tx.asset_mint_or_burn_count > 0 || tx.redeemer_count > 0) && (
          <div className="mt-3 rounded border border-purple-200 bg-purple-50 p-2 dark:border-purple-700 dark:bg-purple-900/20">
            <div className="text-xs text-purple-700 dark:text-purple-300">
              <strong>Smart Contract Activity:</strong>
              <div className="mt-1 space-y-1">
                {tx.asset_mint_or_burn_count > 0 && <div>Asset Mint/Burn: {tx.asset_mint_or_burn_count}</div>}
                {tx.redeemer_count > 0 && <div>Script Redeemers: {tx.redeemer_count}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionDetail;
