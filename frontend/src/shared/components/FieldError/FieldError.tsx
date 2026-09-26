import { JSX } from "react";

interface FieldErrorProps {
  error?: string;
  className?: string;
}

export function FieldError({ error, className = "" }: FieldErrorProps): JSX.Element | null {
  if (!error) {
    return null;
  }

  return (
    <p className={`text-danger text-xs mt-1 text-center ${className}`} role="alert">
      {error}
    </p>
  );
}