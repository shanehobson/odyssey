import { JSX } from "react";

interface ErrorMessageProps {
  error?: string | { error: string } | null | undefined;
  className?: string;
}

export function ErrorMessage({ error, className = "" }: ErrorMessageProps): JSX.Element | null {
  // Don't render anything if error is falsy (empty string, null, undefined, false)
  if (!error) {
    return null;
  }

  // Extract error string from object if needed, or use generic message for null/undefined
  let errorText: string;
  
  if (error === null || error === undefined) {
    errorText = "Something went wrong. Please try again.";
  } else if (typeof error === "string") {
    errorText = error;
  } else {
    errorText = error.error || "Something went wrong. Please try again.";
  }

  return (
    <div className={`form-error mt-2 text-center ${className}`} role="alert">
      {errorText}
    </div>
  );
}