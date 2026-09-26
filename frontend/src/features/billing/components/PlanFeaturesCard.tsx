import type { BillingStatus } from "../api/billing";
import { JSX } from "react";

interface PlanFeaturesCardProps {
  billingStatus: BillingStatus;
  onUpgrade: () => void;
  onManageSubscription: () => void;
  isUpgradePending: boolean;
  isManagePending: boolean;
}

export function PlanFeaturesCard({
  billingStatus,
  onUpgrade,
  onManageSubscription,
  isUpgradePending,
  isManagePending,
}: PlanFeaturesCardProps): JSX.Element {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-border-inverse-subtle">
      <h2 className="text-lg font-semibold text-inverse mb-4">Plan Features</h2>

      {billingStatus.plan === "free" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-inverse">
              • {billingStatus.usage.limit} AI trip generations per week
            </p>
            <p className="text-inverse">• Basic trip planning features</p>
            <p className="text-inverse-muted">• Limited to short trips</p>
          </div>

          <div className="border-t border-border-inverse-subtle pt-4">
            <h3 className="text-inverse font-medium mb-2">Upgrade to Pro</h3>
            <p className="text-inverse-muted text-sm mb-4">
              Get 100 AI generations per week, advanced features, and priority
              support for just $9.99/month.
            </p>
            <button
              onClick={onUpgrade}
              disabled={isUpgradePending}
              className="btn btn-primary w-full"
            >
              {isUpgradePending ? "Loading..." : "Upgrade to Pro ($9.99/mo)"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-inverse">
              • {billingStatus.usage.limit} AI trip generations per week
            </p>
            <p className="text-inverse">• All advanced planning features</p>
            <p className="text-inverse">• Priority customer support</p>
            <p className="text-inverse">• Unlimited trip length</p>
          </div>

          <div className="border-t border-border-inverse-subtle pt-4">
            <button
              onClick={onManageSubscription}
              disabled={isManagePending}
              className="btn btn-secondary w-full"
            >
              {isManagePending ? "Loading..." : "Manage Subscription"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
