import { JSX } from "react";
import { useUpgradeToPro } from "../../data/useBillingStatus";
import type { BillingStatus } from "../../api/billing";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  billingStatus?: BillingStatus | null;
}

export function UpgradeModal({ isOpen, onClose, billingStatus }: UpgradeModalProps): JSX.Element | null {
  const upgradeMutation = useUpgradeToPro();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    upgradeMutation.mutate();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-overlay-medium flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-border-inverse-subtle max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-warning/20 rounded-full flex items-center justify-center">
            <span className="text-warning text-2xl">⚡</span>
          </div>
          <h2 className="text-2xl font-bold text-inverse mb-2">
            Weekly Limit Reached
          </h2>
          {billingStatus && billingStatus.usage ? (
            <p className="text-inverse-muted">
              You've used {billingStatus.usage.used} of {billingStatus.usage.limit} AI trip generations this week.
            </p>
          ) : (
            <p className="text-inverse-muted">
              You've hit your weekly AI generation limit.
            </p>
          )}
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <h3 className="text-inverse font-semibold mb-3">Upgrade to Pro for:</h3>
          <ul className="space-y-2 text-inverse-muted">
            <li className="flex items-center">
              <span className="text-success mr-3">✓</span>
              100 AI generations per week
            </li>
            <li className="flex items-center">
              <span className="text-success mr-3">✓</span>
              Advanced trip planning features
            </li>
            <li className="flex items-center">
              <span className="text-success mr-3">✓</span>
              Extended trip planning capabilities
            </li>
            <li className="flex items-center">
              <span className="text-success mr-3">✓</span>
              Priority customer support
            </li>
          </ul>
          
          <div className="mt-4 pt-4 border-t border-border-inverse-subtle">
            <p className="text-2xl font-bold text-inverse">
              $9.99<span className="text-lg text-inverse-muted">/month</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleUpgrade}
            disabled={upgradeMutation.isPending}
            className="btn btn-primary w-full"
          >
            {upgradeMutation.isPending ? "Loading..." : "Upgrade to Pro"}
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary w-full"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}