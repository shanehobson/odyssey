import type { BillingStatus } from "../api/billing";
import { JSX } from "react";

interface CurrentPlanCardProps {
  billingStatus: BillingStatus;
}

export function CurrentPlanCard({ billingStatus }: CurrentPlanCardProps): JSX.Element {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-border-inverse-subtle">
      <h2 className="text-lg font-semibold text-inverse mb-4">Current Plan</h2>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-inverse capitalize">
          {billingStatus.plan} Plan
        </span>
        {billingStatus.plan === "pro" && (
          <span className="bg-success/20 text-success px-3 py-1 rounded-full text-sm">
            Active
          </span>
        )}
      </div>
      {billingStatus.plan === "pro" && billingStatus.subscriptionStatus && (
        <p className="text-inverse-muted text-sm mt-2 capitalize">
          Status: {billingStatus.subscriptionStatus}
        </p>
      )}
    </div>
  );
}
