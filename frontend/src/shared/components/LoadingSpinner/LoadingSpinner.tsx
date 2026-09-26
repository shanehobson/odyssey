import { JSX } from "react";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  className?: string;
}

const sizeClasses = {
  small: "sk-circle-small",
  medium: "sk-circle",
  large: "sk-circle-large",
} as const;

export function LoadingSpinner({
  size = "medium",
  className = "",
}: LoadingSpinnerProps): JSX.Element {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={sizeClasses[size]} role="status" aria-label="Loading">
        <div className="sk-circle1 sk-child"></div>
        <div className="sk-circle2 sk-child"></div>
        <div className="sk-circle3 sk-child"></div>
        <div className="sk-circle4 sk-child"></div>
        <div className="sk-circle5 sk-child"></div>
        <div className="sk-circle6 sk-child"></div>
        <div className="sk-circle7 sk-child"></div>
        <div className="sk-circle8 sk-child"></div>
        <div className="sk-circle9 sk-child"></div>
        <div className="sk-circle10 sk-child"></div>
        <div className="sk-circle11 sk-child"></div>
        <div className="sk-circle12 sk-child"></div>
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
