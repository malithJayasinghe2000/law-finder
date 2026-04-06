import React from 'react';

interface FieldErrorProps {
  message?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="text-[12px] font-medium text-red-500 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
      {message}
    </p>
  );
};

export default FieldError;
