import React from 'react';
import clsx from 'clsx';

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const SecondaryButton: React.FC<SecondaryButtonProps> = ({ children = 'Spoof Wallet', className, ...props }) => {
  return (
    <button
      {...props}
      className={clsx(
        'rounded border border-blue-600 bg-transparent px-4 py-2 transition hover:bg-blue-700 hover:text-white',
        className,
      )}>
      {children}
    </button>
  );
};

export default SecondaryButton;
