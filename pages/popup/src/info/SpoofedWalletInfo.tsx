import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SecondaryButton } from '@src/components/buttons';

const SpoofedWalletInfo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full p-6">
      <div className="mb-8">
        <h1 className="mb-4 text-2xl font-bold">About Spoofed Wallets</h1>

        <div className="space-y-4 text-left text-gray-700 dark:text-gray-300">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <h2 className="mb-2 font-semibold text-yellow-800 dark:text-yellow-200">⚠️ Read-Only Access</h2>
            <p className="text-sm">
              Spoofed wallets are read-only wallets that allow you to monitor blockchain activity for any Cardano
              address without having access to the private keys.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-semibold">What you can do:</h2>
            <ul className="ml-6 list-outside list-disc space-y-1 text-sm">
              <li>View current balance and assets</li>
              <li>Monitor transaction history</li>
              <li>Track UTXOs</li>
              <li>Watch for incoming transactions</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-2 font-semibold">What you cannot do:</h2>
            <ul className="ml-6 list-outside list-disc space-y-1 text-sm">
              <li>Send ADA or tokens</li>
              <li>Sign transactions</li>
              <li>Interact with DApps</li>
              <li>Access private keys or seed phrases</li>
            </ul>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <h2 className="mb-2 font-semibold text-blue-800 dark:text-blue-200">💡 Perfect for:</h2>
            <ul className="ml-6 list-outside list-disc space-y-1 text-sm">
              <li>Monitoring cold storage wallets</li>
              <li>Tracking public treasury addresses</li>
              <li>Following other wallets' activity</li>
              <li>Testing and development purposes</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <SecondaryButton onClick={() => navigate(-1)} className="w-full">
          Got it
        </SecondaryButton>
      </div>
    </div>
  );
};

export default SpoofedWalletInfo;
