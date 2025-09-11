import React from 'react';
import './style.css';

interface NetworkToggleProps {
  value: 'Mainnet' | 'Preprod';
  onChange: (network: 'Mainnet' | 'Preprod') => void;
  className?: string;
}

const NetworkToggle: React.FC<NetworkToggleProps> = ({ value, onChange, className = '' }) => {
  const isMainnet = value === 'Mainnet';

  const handleToggle = () => {
    onChange(isMainnet ? 'Preprod' : 'Mainnet');
  };

  return (
    <div className={`network-toggle-container ${className}`}>
      <label className="network-switch" htmlFor="network-toggle">
        <input type="checkbox" id="network-toggle" checked={isMainnet} onChange={handleToggle} className="sr-only" />
        <span className="network-slider round flex items-center justify-between px-2">
          <span className={`network-label z-10 text-xs font-medium ${!isMainnet ? 'label-active' : 'label-inactive'}`}>
            Preprod
          </span>
          <span className={`network-label z-10 text-xs font-medium ${isMainnet ? 'label-active' : 'label-inactive'}`}>
            Mainnet
          </span>
        </span>
      </label>
    </div>
  );
};

export default NetworkToggle;
