import React from 'react';
import clsx from 'clsx';

interface CancelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const CancelButton: React.FC<CancelButtonProps> = ({ children = 'Cancel', className, ...props }) => {
  return (
    <button
      {...props}
      className={clsx('rounded bg-red-600 px-4 py-2 text-white transition hover:bg-red-700', className)}>
      {children}
    </button>
  );
};

export default CancelButton;
