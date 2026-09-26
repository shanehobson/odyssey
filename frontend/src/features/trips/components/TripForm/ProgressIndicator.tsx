import { JSX } from "react";

interface ProgressIndicatorProps {
  message: string;
}

export function ProgressIndicator({ message }: ProgressIndicatorProps): JSX.Element {
  return (
    <div className="text-sm text-inverse bg-info/20 border border-info/30 px-3 py-2 rounded-md animate-pulse">
      <div className="flex items-center">
        <div className="w-4 h-4 border-2 border-inverse border-t-transparent rounded-full animate-spin mr-2"></div>
        {message}
      </div>
    </div>
  );
}
