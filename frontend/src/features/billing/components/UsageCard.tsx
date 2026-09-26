import type { BillingStatus } from "../api/billing";
import { JSX } from "react";

interface UsageCardProps {
  billingStatus: BillingStatus;
}

function formatUsage(used: number, limit: number): string {
  return `${used} / ${limit} this week`;
}

function formatResetDate(resetAt: number): string {
  return new Date(resetAt).toLocaleDateString();
}

function getProgressBarColor(used: number, limit: number): string {
  if (used >= limit) return "bg-danger";
  if (used / limit > 0.8) return "bg-warning";
  return "bg-success";
}

export function UsageCard({ billingStatus }: UsageCardProps): JSX.Element {
  const { used, limit, resetAt } = billingStatus.usage;
  const percentage = Math.round((used / limit) * 100);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-border-inverse-subtle">
      <h2 className="text-lg font-semibold text-inverse mb-4">AI Request Usage</h2>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-inverse mb-2">
            <span>{formatUsage(used, limit)}</span>
            <span className="text-inverse-muted">{percentage}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressBarColor(used, limit)}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
        <p className="text-inverse-muted text-sm">Resets on {formatResetDate(resetAt)}</p>
      </div>
    </div>
  );
}
