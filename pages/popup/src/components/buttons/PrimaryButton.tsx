import React from 'react';
import clsx from 'clsx';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ children = 'Create New Wallet', className, ...props }) => {
  return (
    <button
      {...props}
      className={clsx('rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700', className)}>
      {children}
    </button>
  );
};

export default PrimaryButton;
