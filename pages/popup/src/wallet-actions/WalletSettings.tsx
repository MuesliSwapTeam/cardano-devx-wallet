import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStorage, walletsStorage, transactionsStorage, settingsStorage } from '@extension/storage';
import { Formik, Form, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import FloatingLabelInput from '../components/FloatingLabelInput';
import { PrimaryButton, SecondaryButton, CancelButton } from '@src/components/buttons';
import type { Wallet } from '@extension/shared';
import { TruncateWithCopy } from '@extension/shared';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// Define the possible views for this component
type View = 'menu' | 'rename' | 'change-password' | 'add-password' | 'reveal-seed' | 'wallet-deleted';

const WalletSettings = () => {
  const { walletId } = useParams<{ walletId: string }>();
  const navigate = useNavigate();
  const walletsData = useStorage(walletsStorage);

  const [currentView, setCurrentView] = useState<View>('menu');
  const [revealedSeed, setRevealedSeed] = useState<string | null>(null);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [deletedWalletName, setDeletedWalletName] = useState<string>('');

  const wallets = walletsData?.wallets || [];
  const currentWallet = wallets.find((w: Wallet) => w.id === walletId);

  // Guard clause in case the wallet isn't found - but allow wallet-deleted view to show
  if (!currentWallet && currentView !== 'wallet-deleted') {
    return <div className="p-4 text-center">Wallet not found.</div>;
  }

  // --- Handlers for Form Submissions ---

  const handleDeleteWallet = async () => {
    if (!walletId) return;

    const confirmDelete = confirm(
      `Are you sure you want to delete "${currentWallet.name}"? This will permanently remove the wallet and all its transaction data. This action cannot be undone.`,
    );
    if (confirmDelete) {
      try {
        // 1. Clear all transaction and UTXO data for this wallet
        await transactionsStorage.clearWalletData(walletId);

        // 2. Remove the wallet from the wallets list
        const walletsData = await walletsStorage.get();
        const updatedWallets = walletsData.wallets.filter((w: Wallet) => w.id !== walletId);
        await walletsStorage.set({ wallets: updatedWallets });

        // 3. If this was the active wallet, set a new active wallet or clear it
        const settings = await settingsStorage.get();
        if (settings?.activeWalletId === walletId) {
          const newActiveWalletId = updatedWallets.length > 0 ? updatedWallets[0].id : null;
          await settingsStorage.setActiveWalletId(newActiveWalletId);

          // If no wallets left, mark as not onboarded
          if (updatedWallets.length === 0) {
            await settingsStorage.set({ ...settings, onboarded: false });
          }
        }

        // Store the deleted wallet name and show success page
        setDeletedWalletName(currentWallet.name);
        setCurrentView('wallet-deleted');
      } catch (error) {
        console.error('Failed to delete wallet:', error);
        alert('Failed to delete wallet. Check console for details.');
      }
    }
  };

  const handleRenameSubmit = (values: { walletName: string }, { setSubmitting }) => {
    const payload = { id: walletId, name: values.walletName };
    chrome.runtime.sendMessage({ type: 'WALLET_RENAME', payload }, response => {
      setSubmitting(false);
      if (response?.success) {
        setCurrentView('menu'); // Return to the menu on success
      } else {
        console.error('Failed to update wallet name:', response?.error);
      }
    });
  };

  const handleAddPasswordSubmit = (values: { newPassword: string }, { setSubmitting }) => {
    const payload = { id: walletId, newPassword: values.newPassword };
    chrome.runtime.sendMessage({ type: 'ADD_PASSWORD', payload }, response => {
      setSubmitting(false);
      if (response?.success) {
        alert('Password added successfully!');
        setCurrentView('menu');
      } else {
        alert(`Error: ${response?.error}`);
      }
    });
  };

  const handleChangePasswordSubmit = (values: any, { setSubmitting, setFieldError }) => {
    const changePayload = {
      id: walletId,
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    };
    chrome.runtime.sendMessage({ type: 'CHANGE_PASSWORD', payload: changePayload }, response => {
      setSubmitting(false);
      if (response?.success) {
        alert('Password changed successfully!');
        setCurrentView('menu');
      } else {
        setFieldError('currentPassword', response?.error || 'Incorrect password');
      }
    });
  };

  const handleRevealSeedSubmit = (values: { password?: string }, { setSubmitting, setFieldError }) => {
    const payload = {
      id: walletId,
      password: currentWallet.hasPassword ? values.password : undefined,
    };

    chrome.runtime.sendMessage({ type: 'GET_DECRYPTED_SECRET', payload }, response => {
      setSubmitting(false);
      if (response?.success) {
        setRevealedSeed(response.secret);
      } else {
        setFieldError('password', response?.error || 'Failed to decrypt seed.');
      }
    });
  };

  // --- Function to Render the Correct View ---

  const renderContent = () => {
    switch (currentView) {
      case 'rename':
        return (
          <Formik
            initialValues={{ walletName: currentWallet.name }}
            validationSchema={Yup.object({ walletName: Yup.string().required('Wallet name is required.') })}
            onSubmit={handleRenameSubmit}>
            {({ errors, touched, isSubmitting }) => (
              <Form className="flex h-full flex-col">
                <div className="grow">
                  <FloatingLabelInput
                    name="walletName"
                    label="Wallet Name"
                    required
                    error={touched.walletName && !!errors.walletName}
                  />
                  <ErrorMessage name="walletName" component="p" className="mt-1 text-sm text-red-500" />
                </div>
                <div className="mt-auto flex justify-center space-x-4">
                  <SecondaryButton type="button" onClick={() => setCurrentView('menu')}>
                    Back
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={isSubmitting}>
                    Save
                  </PrimaryButton>
                </div>
              </Form>
            )}
          </Formik>
        );
      case 'add-password':
        return (
          <Formik
            initialValues={{ newPassword: '', confirmNewPassword: '' }}
            validationSchema={Yup.object({
              newPassword: Yup.string().required('Password is required.'),
              confirmNewPassword: Yup.string()
                .oneOf([Yup.ref('newPassword')], 'Passwords must match')
                .required('Please confirm your password.'),
            })}
            onSubmit={handleAddPasswordSubmit}>
            {({ errors, touched, isSubmitting }) => (
              <Form className="flex h-full flex-col">
                <div className="grow space-y-4">
                  <div>
                    <FloatingLabelInput
                      name="newPassword"
                      label="New Password"
                      type="password"
                      required
                      error={touched.newPassword && !!errors.newPassword}
                    />
                    <ErrorMessage name="newPassword" component="p" className="mt-1 text-xs text-red-500" />
                  </div>
                  <div>
                    <FloatingLabelInput
                      name="confirmNewPassword"
                      label="Confirm Password"
                      type="password"
                      required
                      error={touched.confirmNewPassword && !!errors.confirmNewPassword}
                    />
                    <ErrorMessage name="confirmNewPassword" component="p" className="mt-1 text-xs text-red-500" />
                  </div>
                </div>
                <div className="mt-auto flex justify-center space-x-4">
                  <SecondaryButton type="button" onClick={() => setCurrentView('menu')}>
                    Back
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={isSubmitting}>
                    Set Password
                  </PrimaryButton>
                </div>
              </Form>
            )}
          </Formik>
        );
      case 'change-password':
        return (
          <Formik
            initialValues={{ currentPassword: '', newPassword: '', confirmNewPassword: '' }}
            validationSchema={Yup.object({
              currentPassword: Yup.string().required('Current password is required.'),
              newPassword: Yup.string().required('New password is required.'),
              confirmNewPassword: Yup.string()
                .oneOf([Yup.ref('newPassword')], 'Passwords must match')
                .required('Please confirm your new password.'),
            })}
            onSubmit={handleChangePasswordSubmit}>
            {({ errors, touched, isSubmitting }) => (
              <Form className="flex h-full flex-col">
                <div className="grow space-y-4">
                  <div>
                    <FloatingLabelInput
                      name="currentPassword"
                      label="Current Password"
                      type="password"
                      required
                      error={touched.currentPassword && !!errors.currentPassword}
                    />
                    <ErrorMessage name="currentPassword" component="p" className="mt-1 text-xs text-red-500" />
                  </div>
                  <div>
                    <FloatingLabelInput
                      name="newPassword"
                      label="New Password"
                      type="password"
                      required
                      error={touched.newPassword && !!errors.newPassword}
                    />
                    <ErrorMessage name="newPassword" component="p" className="mt-1 text-xs text-red-500" />
                  </div>
                  <div>
                    <FloatingLabelInput
                      name="confirmNewPassword"
                      label="Confirm New Password"
                      type="password"
                      required
                      error={touched.confirmNewPassword && !!errors.confirmNewPassword}
                    />
                    <ErrorMessage name="confirmNewPassword" component="p" className="mt-1 text-xs text-red-500" />
                  </div>
                </div>
                <div className="mt-auto flex justify-center space-x-4">
                  <SecondaryButton type="button" onClick={() => setCurrentView('menu')}>
                    Back
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={isSubmitting}>
                    Change Password
                  </PrimaryButton>
                </div>
              </Form>
            )}
          </Formik>
        );
      case 'reveal-seed':
        if (revealedSeed) {
          return (
            <div className="flex h-full flex-col">
              <div className="grow">
                <p className="text-sm text-gray-600 dark:text-gray-300">Your secret seed phrase is:</p>
                <div className="mt-2 break-words rounded-md bg-gray-100 p-4 text-center font-mono dark:bg-gray-700">
                  {revealedSeed}
                </div>
                <p className="mt-4 text-xs text-red-500">Do not share this phrase with anyone. Store it securely.</p>
              </div>
              <div className="mt-auto flex justify-center">
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    setRevealedSeed(null);
                    setCurrentView('menu');
                  }}>
                  Back to Settings
                </SecondaryButton>
              </div>
            </div>
          );
        }
        return (
          <Formik
            initialValues={{ password: '' }}
            validationSchema={Yup.object({ password: Yup.string().required('Password is required.') })}
            onSubmit={handleRevealSeedSubmit}>
            {({ errors, touched, isSubmitting }) => (
              <Form className="flex h-full flex-col">
                <p className="mb-4 text-center">Enter your password to reveal the seed phrase.</p>
                <div className="grow">
                  <FloatingLabelInput
                    name="password"
                    label="Password"
                    type="password"
                    required
                    error={touched.password && !!errors.password}
                  />
                  <ErrorMessage name="password" component="p" className="mt-1 text-sm text-red-500" />
                </div>
                <div className="mt-auto flex justify-center space-x-4">
                  <SecondaryButton type="button" onClick={() => setCurrentView('menu')}>
                    Back
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={isSubmitting}>
                    Reveal
                  </PrimaryButton>
                </div>
              </Form>
            )}
          </Formik>
        );

      case 'wallet-deleted':
        const remainingWallets = walletsData?.wallets || [];
        const hasWallets = remainingWallets.length > 0;

        return (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-6">
              <div className="mb-4 flex justify-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                  <svg
                    className="size-8 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="mb-2 text-xl font-bold">Wallet Deleted Successfully</h2>
              <p className="mb-2 text-gray-600 dark:text-gray-300">
                "{deletedWalletName}" has been permanently removed.
              </p>
              {!hasWallets && (
                <p className="text-orange-600 dark:text-orange-400">
                  You now have 0 wallets anymore, please add a wallet.
                </p>
              )}
            </div>
            <div className="flex flex-col space-y-3">
              {hasWallets ? (
                <PrimaryButton
                  onClick={() => {
                    navigate(`/wallet/${remainingWallets[0].id}/assets`);
                  }}>
                  Go Back
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  onClick={() => {
                    navigate('/add-wallet');
                  }}>
                  Add New Wallet
                </PrimaryButton>
              )}
            </div>
          </div>
        );

      case 'menu':
      default:
        return (
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-2">
              <SecondaryButton className="w-full" onClick={() => setCurrentView('rename')}>
                Rename Wallet
              </SecondaryButton>
              {currentWallet.hasPassword ? (
                <SecondaryButton className="w-full" onClick={() => setCurrentView('change-password')}>
                  Change Password
                </SecondaryButton>
              ) : (
                <SecondaryButton className="w-full" onClick={() => setCurrentView('add-password')}>
                  Add Password
                </SecondaryButton>
              )}
              {currentWallet.type === 'SPOOFED' ? (
                <div className="w-full rounded bg-gray-100 p-2 text-center text-xs text-gray-500 dark:bg-gray-700">
                  Spoofed wallets do not have a seed phrase.
                </div>
              ) : (
                <SecondaryButton className="w-full" onClick={() => setCurrentView('reveal-seed')}>
                  Export Seed Phrase
                </SecondaryButton>
              )}
            </div>

            {/* Danger Zone */}
            <div>
              <div className="rounded-lg bg-white shadow dark:bg-gray-700">
                <button
                  onClick={() => setIsDangerZoneOpen(!isDangerZoneOpen)}
                  className="flex w-full items-center justify-between p-4 font-medium text-red-500">
                  <span>Danger Zone</span>
                  {isDangerZoneOpen ? <ChevronUpIcon className="size-5" /> : <ChevronDownIcon className="size-5" />}
                </button>
                {isDangerZoneOpen && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Deleting will permanently remove this wallet and all its transaction data.
                    </p>
                    <div className="pt-4">
                      <CancelButton onClick={handleDeleteWallet}>Delete Wallet</CancelButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-full flex-col">
      {currentWallet && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span>Address:</span>
            <TruncateWithCopy text={currentWallet.address} maxChars={16} />
          </div>
          <div className="mb-4 flex items-center gap-2">
            <span>Stake:</span>
            <TruncateWithCopy text={currentWallet.stakeAddress} maxChars={16} />
          </div>
        </>
      )}
      {renderContent()}
    </div>
  );
};

export default WalletSettings;
