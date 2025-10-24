import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Wallet } from '@extension/shared';
import type { UTXORecord, TransactionRecord } from '@extension/storage';
import { TruncateWithCopy } from '@extension/shared';

interface UTXOsViewProps {
  wallet: Wallet;
  utxos: UTXORecord[];
  transactions: TransactionRecord[];
}

const UTXOsView: React.FC<UTXOsViewProps> = ({ wallet, utxos, transactions }) => {
  const [filter, setFilter] = useState<'all' | 'unspent' | 'spent' | 'external'>('unspent');
  const [expandedUtxo, setExpandedUtxo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsToShow, setItemsToShow] = useState(50);
  const itemsPerLoad = 50;

  const formatAda = (lovelace: string) => {
    return (parseInt(lovelace) / 1000000).toFixed(6) + ' ADA';
  };

  const formatDateToDay = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Otherwise, return formatted date
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUTXODate = (utxo: UTXORecord): number | null => {
    // Find creating transaction
    const creatingTx = transactions.find(tx => tx.hash === utxo.tx_hash);
    const createdDate = creatingTx?.block_time;

    // Find spending transaction if UTXO is spent
    const spendingTx = utxo.isSpent && utxo.spentInTx ? transactions.find(tx => tx.hash === utxo.spentInTx) : null;
    const spentDate = spendingTx?.block_time;

    // Choose date based on filter
    switch (filter) {
      case 'unspent':
        return createdDate || null;
      case 'spent':
        return spentDate || createdDate || null;
      case 'external':
        return createdDate || null;
      case 'all':
        return spentDate || createdDate || null;
      default:
        return createdDate || null;
    }
  };

  const groupUTXOsByDay = (utxos: UTXORecord[]) => {
    const groups: { [key: string]: UTXORecord[] } = {};

    utxos.forEach(utxo => {
      const timestamp = getUTXODate(utxo);
      if (timestamp) {
        const dayKey = formatDateToDay(timestamp);
        if (!groups[dayKey]) {
          groups[dayKey] = [];
        }
        groups[dayKey].push(utxo);
      }
    });

    return groups;
  };

  const toggleExpanded = (utxoKey: string) => {
    setExpandedUtxo(expandedUtxo === utxoKey ? null : utxoKey);
  };

  const filteredUtxos = utxos.filter(utxo => {
    // First apply the spent/unspent/external filter
    let passesSpentFilter = true;
    switch (filter) {
      case 'unspent':
        passesSpentFilter = !utxo.isSpent && !utxo.isExternal;
        break;
      case 'spent':
        passesSpentFilter = utxo.isSpent && !utxo.isExternal;
        break;
      case 'external':
        passesSpentFilter = utxo.isExternal === true;
        break;
      case 'all':
      default:
        passesSpentFilter = true;
        break;
    }

    if (!passesSpentFilter) return false;

    // Then apply the search filter
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    // Search in transaction hash
    if (utxo.tx_hash.toLowerCase().includes(query)) return true;

    // Search in output index
    if (utxo.output_index.toString().includes(query)) return true;

    // Search in address
    if (utxo.address.toLowerCase().includes(query)) return true;

    // Search in asset units/policy IDs
    if (utxo.amount.some(asset => asset.unit.toLowerCase().includes(query) || asset.quantity.includes(query)))
      return true;

    // Search in spent transaction hash if available
    if (utxo.spentInTx && utxo.spentInTx.toLowerCase().includes(query)) return true;

    return false;
  });

  // Group filtered UTXOs by day
  const groupedUtxos = groupUTXOsByDay(filteredUtxos);

  // Get visible UTXOs with proper grouping
  let totalShown = 0;
  const visibleGroups: { [key: string]: UTXORecord[] } = {};

  for (const [dayKey, dayUtxos] of Object.entries(groupedUtxos)) {
    const remainingToShow = itemsToShow - totalShown;
    if (remainingToShow <= 0) break;

    const utxosToShow = dayUtxos.slice(0, remainingToShow);
    if (utxosToShow.length > 0) {
      visibleGroups[dayKey] = utxosToShow;
      totalShown += utxosToShow.length;
    }
  }

  // Reset items when search or filter changes
  useEffect(() => {
    setItemsToShow(50);
  }, [searchQuery, filter]);

  // Handle scroll to load more
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const element = e.target as HTMLElement;
      // Check if scrolled near bottom (within 100px)
      if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
        if (itemsToShow < filteredUtxos.length) {
          setItemsToShow(prev => Math.min(prev + itemsPerLoad, filteredUtxos.length));
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
  }, [itemsToShow, filteredUtxos.length]);

  const stats = {
    total: utxos.length,
    unspent: utxos.filter(u => !u.isSpent && !u.isExternal).length,
    spent: utxos.filter(u => u.isSpent && !u.isExternal).length,
    external: utxos.filter(u => u.isExternal === true).length,
    totalValue: utxos
      .filter(u => !u.isSpent && !u.isExternal)
      .reduce((sum, utxo) => {
        const adaAmount = utxo.amount.find(a => a.unit === 'lovelace');
        return sum + (adaAmount ? parseInt(adaAmount.quantity) : 0);
      }, 0),
  };

  return (
    <div>
      <div className="mb-2 mt-4 pb-2">
        <input
          type="text"
          placeholder="Search UTXOs (hash, address, asset, etc.)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
        />
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 grid grid-cols-4 gap-1 rounded bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setFilter('unspent')}
          className={`rounded px-2 py-1 text-xs transition ${
            filter === 'unspent' ? 'bg-green-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}>
          Unspent ({stats.unspent})
        </button>
        <button
          onClick={() => setFilter('spent')}
          className={`rounded px-2 py-1 text-xs transition ${
            filter === 'spent' ? 'bg-red-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}>
          Spent ({stats.spent})
        </button>
        <button
          onClick={() => setFilter('external')}
          className={`rounded px-2 py-1 text-xs transition ${
            filter === 'external' ? 'bg-orange-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}>
          External ({stats.external})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded px-2 py-1 text-xs transition ${
            filter === 'all' ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}>
          All ({stats.total})
        </button>
      </div>

      {filteredUtxos.length === 0 ? (
        <div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery.trim()
              ? `No UTXOs match your search for \"${searchQuery}\"`
              : `No ${filter === 'all' ? '' : filter + ' '}UTXOs found for this wallet.`}
          </p>
          {searchQuery.trim() && (
            <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-blue-500 hover:text-blue-600">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(visibleGroups).map(([dayKey, dayUtxos]) => (
            <div key={dayKey} className="space-y-2">
              {/* Day Header */}
              <div className="sticky top-0 z-10 bg-slate-50 pb-2 dark:bg-gray-800">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{dayKey}</h4>
              </div>

              {/* UTXOs for this day */}
              <div className="space-y-2">
                {dayUtxos.map(utxo => {
                  const utxoKey = `${utxo.tx_hash}:${utxo.output_index}`;
                  const adaAmount = utxo.amount.find(a => a.unit === 'lovelace');
                  const otherAssets = utxo.amount.filter(a => a.unit !== 'lovelace');
                  const adaFormatted = adaAmount ? formatAda(adaAmount.quantity) : '0 ADA';

                  return (
                    <div key={utxoKey} className="rounded-lg border border-gray-200 dark:border-gray-700">
                      <div
                        className="cursor-pointer p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => toggleExpanded(utxoKey)}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div
                                className={`rounded px-2 py-0.5 text-xs ${
                                  utxo.isSpent
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                }`}>
                                {utxo.isSpent ? 'Spent' : 'Unspent'}
                              </div>
                              {utxo.isExternal && (
                                <div className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                  External
                                </div>
                              )}
                              {otherAssets.length > 0 && (
                                <div className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  +{otherAssets.length} asset{otherAssets.length > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm font-medium text-gray-900 dark:text-gray-100">
                              <span>+{adaFormatted}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {expandedUtxo === utxoKey && (
                        <div className="border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                          <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between">
                              <strong>Full Hash:</strong>
                              <span className="font-mono">
                                <TruncateWithCopy text={utxo.tx_hash} maxChars={10} />
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <strong>Output Index:</strong>
                              <span>{utxo.output_index}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <strong>Full Address:</strong>
                              <span className="font-mono">
                                <TruncateWithCopy text={utxo.address} maxChars={10} />
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <strong>Block:</strong>
                              <span className="font-mono">
                                <TruncateWithCopy text={utxo.block || ''} maxChars={10} />
                              </span>
                            </div>
                            {utxo.isExternal && (
                              <div className="rounded border border-orange-200 bg-orange-50 p-2 dark:border-orange-700 dark:bg-orange-900/30">
                                <div className="text-xs font-medium text-orange-900 dark:text-orange-100">
                                  ⚠️ External UTXO
                                </div>
                                <div className="mt-1 text-xs text-orange-700 dark:text-orange-300">
                                  This UTXO belongs to an external address, not your wallet.
                                </div>
                              </div>
                            )}

                            {/* Asset Details */}
                            <div>
                              <strong>Assets ({utxo.amount.length}):</strong>
                              <div className="ml-2 mt-1 space-y-1">
                                {utxo.amount.map((asset, idx) => (
                                  <div
                                    key={idx}
                                    className={`rounded p-2 ${
                                      asset.unit === 'lovelace'
                                        ? 'border border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30'
                                        : 'border border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30'
                                    }`}>
                                    {asset.unit === 'lovelace' ? (
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <strong className="text-blue-900 dark:text-blue-100">Cardano (ADA)</strong>
                                          <span className="font-bold text-blue-900 dark:text-blue-100">
                                            {formatAda(asset.quantity)}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                                          {parseInt(asset.quantity).toLocaleString()} Lovelace
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="mb-1 flex items-start justify-between">
                                          <strong className="text-xs text-purple-900 dark:text-purple-100">
                                            Native Asset
                                          </strong>
                                          <span className="font-bold text-purple-900 dark:text-purple-100">
                                            {parseInt(asset.quantity).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300">
                                          <strong>Policy ID:</strong>
                                          <span className="font-mono">
                                            <TruncateWithCopy text={asset.unit.slice(0, 56)} maxChars={10} />
                                          </span>
                                        </div>
                                        {asset.unit.length > 56 && (
                                          <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300">
                                            <strong>Asset Name:</strong>
                                            <span className="font-mono">
                                              <TruncateWithCopy text={asset.unit.slice(56)} maxChars={10} />
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400">
                                          <strong>Full Unit:</strong>
                                          <span className="font-mono">
                                            <TruncateWithCopy text={asset.unit} maxChars={10} />
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Technical Details */}
                            {(utxo.data_hash || utxo.inline_datum || utxo.reference_script_hash) && (
                              <div className="border-t border-gray-300 pt-2 dark:border-gray-500">
                                <strong>Technical Details:</strong>
                                {utxo.data_hash && (
                                  <div className="ml-2 mt-1 flex items-center justify-between">
                                    <strong>Data Hash:</strong>
                                    <span className="font-mono">
                                      <TruncateWithCopy text={utxo.data_hash} maxChars={10} />
                                    </span>
                                  </div>
                                )}
                                {utxo.inline_datum && (
                                  <div className="ml-2 mt-1 flex items-center justify-between">
                                    <strong>Inline Datum:</strong>
                                    <span className="font-mono">
                                      <TruncateWithCopy text={utxo.inline_datum} maxChars={10} />
                                    </span>
                                  </div>
                                )}
                                {utxo.reference_script_hash && (
                                  <div className="ml-2 mt-1 flex items-center justify-between">
                                    <strong>Reference Script:</strong>
                                    <span className="font-mono">
                                      <TruncateWithCopy text={utxo.reference_script_hash} maxChars={10} />
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Navigation Links */}
                            <div className="flex flex-wrap justify-center gap-2 border-t border-gray-300 pt-2 dark:border-gray-500">
                              <Link
                                to={`/wallet/${wallet.id}/utxo/${utxo.tx_hash}/${utxo.output_index}`}
                                className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                                View Details
                              </Link>
                              {utxo.isSpent && utxo.spentInTx && (
                                <span className="text-xs text-gray-500">💸 Spent in TX</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show loading indicator or count */}
      {filteredUtxos.length > 0 && (
        <div className="mt-4 pb-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {totalShown < filteredUtxos.length ? (
            <div>
              Showing {totalShown} of {filteredUtxos.length} UTXOs
              <div className="mt-2 text-xs">Scroll down to load more</div>
            </div>
          ) : (
            `All ${filteredUtxos.length} UTXOs loaded`
          )}
        </div>
      )}
    </div>
  );
};

export default UTXOsView;
