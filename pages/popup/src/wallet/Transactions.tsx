import React, { useState, useEffect } from 'react';
import type { Wallet } from '@extension/shared';
import type { UTXORecord } from '@extension/storage';
import type { TransactionRecord } from '@extension/storage';
import { TruncateWithCopy } from '@extension/shared';
import TransactionDetail from './TransactionDetail';

interface TransactionsProps {
  wallet: Wallet;
  transactions: TransactionRecord[];
}

const Transactions: React.FC<TransactionsProps> = ({ wallet, transactions }) => {
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsToShow, setItemsToShow] = useState(50);
  const itemsPerLoad = 50;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAda = (lovelace: string) => {
    return (parseInt(lovelace) / 1000000).toFixed(6) + ' ADA';
  };

  const decodeAssetName = (unit: string): string => {
    if (unit.length <= 56) return '';
    const nameHex = unit.slice(56);
    try {
      const bytes = new Uint8Array(nameHex.length / 2);
      for (let i = 0; i < nameHex.length; i += 2) {
        bytes[i / 2] = parseInt(nameHex.substr(i, 2), 16);
      }
      let name = '';
      for (let byte of bytes) {
        if (byte === 0) break;
        name += String.fromCharCode(byte);
      }
      return name;
    } catch (e) {
      return '';
    }
  };

  const getAssetDisplay = (unit: string, qty: bigint, formatAda: (l: string) => string): string => {
    const absQty = qty < 0n ? -qty : qty;
    const sign = qty < 0n ? '-' : '+';
    let amountStr: string;
    let name: string;
    if (unit === 'lovelace') {
      amountStr = formatAda(absQty.toString());
      return `${sign}${amountStr}`;
    } else {
      const assetName = decodeAssetName(unit);
      amountStr = absQty.toString();
      name = assetName || unit.slice(56, 64) || (absQty === 1n ? 'Asset' : 'Assets');
      if (absQty === 1n && assetName) {
        name = assetName;
      }
      return `${sign}${amountStr} ${name}`;
    }
  };

  const computeNetAssets = (tx: TransactionRecord): Record<string, bigint> => {
    const inputTotals: Record<string, bigint> = {};
    const outputTotals: Record<string, bigint> = {};

    // Sum up inputs from non-external addresses (our wallet)
    (tx.inputs || []).forEach(input => {
      if (input.address === wallet.address) {
        // Only our wallet's inputs
        input.amount.forEach(asset => {
          if (!inputTotals[asset.unit]) inputTotals[asset.unit] = 0n;
          inputTotals[asset.unit] += BigInt(asset.quantity);
        });
      }
    });

    // Sum up outputs to non-external addresses (our wallet)
    (tx.outputs || []).forEach(output => {
      if (output.address === wallet.address) {
        // Only our wallet's outputs
        output.amount.forEach(asset => {
          if (!outputTotals[asset.unit]) outputTotals[asset.unit] = 0n;
          outputTotals[asset.unit] += BigInt(asset.quantity);
        });
      }
    });

    // Calculate net change (output - input) for each asset
    const net: Record<string, bigint> = {};
    const allUnits = new Set([...Object.keys(inputTotals), ...Object.keys(outputTotals)]);

    allUnits.forEach(unit => {
      const inQty = inputTotals[unit] || 0n;
      const outQty = outputTotals[unit] || 0n;
      const netChange = outQty - inQty;

      if (netChange !== 0n) {
        net[unit] = netChange;
      }
    });

    // Subtract fees from the net ADA change
    const feesLovelace = BigInt(tx.fees || '0');
    if (feesLovelace > 0n) {
      if (net['lovelace'] !== undefined) {
        net['lovelace'] -= feesLovelace;
      } else {
        // If no lovelace change but we paid fees, show negative fee amount
        net['lovelace'] = -feesLovelace;
      }
    }

    // Remove zero amounts
    Object.keys(net).forEach(unit => {
      if (net[unit] === 0n) {
        delete net[unit];
      }
    });

    return net;
  };

  const toggleExpanded = (txHash: string) => {
    setExpandedTx(expandedTx === txHash ? null : txHash);
  };

  // Filter transactions based on search query
  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    // Search in transaction hash
    if (tx.hash.toLowerCase().includes(query)) return true;

    // Note: Search in input/output addresses removed since transactions no longer include detailed I/O data

    // Search in fees
    if (tx.fees.includes(query)) return true;

    // Search in block height
    if (tx.block_height.toString().includes(query)) return true;

    return false;
  });

  // Get visible transactions
  const visibleTransactions = filteredTransactions.slice(0, itemsToShow);

  // Reset items when search changes
  useEffect(() => {
    setItemsToShow(50);
  }, [searchQuery]);

  // Handle scroll to load more
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const element = e.target as HTMLElement;
      // Check if scrolled near bottom (within 100px)
      if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
        if (itemsToShow < filteredTransactions.length) {
          setItemsToShow(prev => Math.min(prev + itemsPerLoad, filteredTransactions.length));
        }
      }
    };

    // Find the scrollable parent (main element with overflow-y-auto)
    const scrollableParent = document.querySelector('main.overflow-y-auto');
    if (scrollableParent) {
      scrollableParent.addEventListener('scroll', handleScroll);
      return () => scrollableParent.removeEventListener('scroll', handleScroll);
    }
    return undefined;
  }, [itemsToShow, filteredTransactions.length]);

  return (
    <div>
      <div className="mb-2 border-b border-gray-300 pb-2 dark:border-gray-600">
        <div className="mb-2">
          <h3 className="text-md font-semibold">Transactions</h3>
        </div>
        <input
          type="text"
          placeholder="Search transactions (hash, address, block, etc.)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
        />
      </div>

      <div className="mt-4 space-y-2">
        {filteredTransactions.length === 0 && searchQuery.trim() ? (
          <div className="py-8 text-center">
            <div className="text-sm text-gray-500">No transactions match your search for "{searchQuery}"</div>
            <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-blue-500 hover:text-blue-600">
              Clear search
            </button>
          </div>
        ) : (
          visibleTransactions.map((tx, index) => {
            const netAssets = computeNetAssets(tx);
            const sortedUnits = Object.keys(netAssets).sort((a, b) =>
              a === 'lovelace' ? -1 : b === 'lovelace' ? 1 : 0,
            );
            return (
              <div key={tx.hash || index} className="rounded-lg border border-gray-200 dark:border-gray-700">
                <div
                  className="cursor-pointer p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => toggleExpanded(tx.hash)}>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(tx.block_time)}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">Block #{tx.block_height}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        <TruncateWithCopy text={tx.hash} maxChars={10} />
                      </div>
                    </div>
                  </div>
                  {Object.keys(netAssets).length > 0 && (
                    <div className="mt-1 space-y-1">
                      {sortedUnits.map(unit => (
                        <div key={unit} className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {getAssetDisplay(unit, netAssets[unit], formatAda)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {expandedTx === tx.hash && (
                  <TransactionDetail tx={tx} wallet={wallet} formatAda={formatAda} formatDate={formatDate} />
                )}
              </div>
            );
          })
        )}
      </div>

      {transactions.length === 0 && (
        <p className="mt-4 text-center text-sm text-gray-400">No transactions found for this wallet.</p>
      )}

      {/* Show loading indicator or count */}
      {filteredTransactions.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {itemsToShow < filteredTransactions.length ? (
            <div>
              Showing {itemsToShow} of {filteredTransactions.length} transactions
              <div className="mt-2 text-xs">Scroll down to load more</div>
            </div>
          ) : (
            `All ${filteredTransactions.length} transactions loaded`
          )}
        </div>
      )}
    </div>
  );
};

export default Transactions;
