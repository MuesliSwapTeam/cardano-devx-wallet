import React, { useState } from 'react';

/**
 * Combined function that truncates text and provides copy functionality
 * Shows first N characters followed by "..." and a copy button
 */
interface TruncateWithCopyProps {
  text: string;
  maxChars?: number;
  className?: string;
}

export const TruncateWithCopy: React.FC<TruncateWithCopyProps> = ({ text, maxChars = 16, className = '' }) => {
  const [showCopied, setShowCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const truncatedText = text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      <span className="font-mono text-xs">{truncatedText}</span>
      <button
        onClick={copyToClipboard}
        className="text-xs text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        title="Copy full text"
        aria-label="Copy to clipboard">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </button>
      {showCopied && (
        <div className="absolute left-0 top-full z-10 mt-1 animate-pulse rounded border border-gray-200 bg-white px-2 py-1 text-xs text-green-600 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-green-400">
          Copied!
        </div>
      )}
    </div>
  );
};
