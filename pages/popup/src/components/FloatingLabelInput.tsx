import React, { useState } from 'react';
import { Field } from 'formik';

interface FloatingLabelInputProps {
  name: string;
  label: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | boolean; // Can be boolean for error state without message
  // --- ADDED: Make value/onChange optional for dual use ---
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  name,
  label,
  type = 'text',
  disabled = false,
  required = false,
  error,
  value,
  onChange,
  onBlur,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  // --- START OF NEW LOGIC ---
  // Determine if this is being used as a standard controlled input or a Formik Field.
  // If `value` is passed, we treat it as a controlled input.
  const isControlled = typeof value !== 'undefined';

  const sharedProps = {
    id: name,
    name: name,
    disabled: disabled,
    type: isPassword ? (showPassword ? 'text' : 'password') : type,
    placeholder: ' ', // This space is crucial
    className: `
      block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border
      appearance-none dark:text-white 
      focus:outline-none focus:ring-0 peer
      ${isPassword ? 'pr-10' : ''}
      ${error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-600 dark:focus:border-blue-500'}
      disabled:cursor-not-allowed
      disabled:border-gray-200 dark:disabled:border-gray-700
      disabled:bg-gray-100 dark:disabled:bg-gray-700
    `,
    onBlur: onBlur,
  };
  // --- END OF NEW LOGIC ---

  return (
    <div className="relative">
      {/* --- RENDER a standard <input> for Display Mode, or a <Field> for Input Mode --- */}
      {isControlled ? <input {...sharedProps} value={value} onChange={onChange} /> : <Field {...sharedProps} />}

      <label
        htmlFor={name}
        className={`
          peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:-translate-y-4 absolute start-2.5 top-2 z-10 origin-[0] -translate-y-4 scale-75 
          cursor-text bg-white px-2 text-sm transition-[color,transform]
          duration-300 ease-in-out
          peer-placeholder-shown:translate-y-1.5 peer-placeholder-shown:scale-100
          dark:bg-gray-800
          ${error ? 'text-red-500 dark:text-red-500' : 'text-gray-500 peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500'}
          peer-focus:-translate-y-4 peer-focus:scale-75
          peer-disabled:cursor-not-allowed peer-disabled:bg-gray-100 peer-disabled:text-gray-400
          dark:peer-disabled:bg-gray-700 dark:peer-disabled:text-gray-500
        `}>
        {label}
        {required && <span className="ms-1 text-inherit">*</span>}
      </label>

      {/* --- Eye Icon Button Logic (unchanged) --- */}
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label={showPassword ? 'Hide password' : 'Show password'}>
          {showPassword ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-4.478 0-8.268-2.943-9.542-7a10.052 10.052 0 0 1 3.51-5.111m9.225 1.037a3 3 0 1 1-4.242 4.242M4.5 4.5l15 15"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

export default FloatingLabelInput;
