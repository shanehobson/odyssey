import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useBillingStatus, useUpgradeToPro, useManageSubscription } from "@/features/billing/data/useBillingStatus";
import { CurrentPlanCard } from "@/features/billing/components/CurrentPlanCard";
import { UsageCard } from "@/features/billing/components/UsageCard";
import { PlanFeaturesCard } from "@/features/billing/components/PlanFeaturesCard";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner/LoadingSpinner";
import { ErrorMessage } from "@/shared/components/ErrorMessage/ErrorMessage";
import { JSX, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function ProfilePage(): JSX.Element {
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [showCancelMessage, setShowCancelMessage] = useState(false);

  const { data: billingStatus, isLoading, error, refetch } = useBillingStatus();
  const upgradeMutation = useUpgradeToPro();
  const manageSubscriptionMutation = useManageSubscription();

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      setShowCancelMessage(true);
      const timer = setTimeout(() => setShowCancelMessage(false), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [searchParams]);

  const handleSignOut = async (): Promise<void> => {
    try {
      await logout();
    } catch (error) {}
  };

  return (
    <div className="p-4">
      <header className="pt-2">
        <h1 className="text-2xl lg:text-3xl font-bold text-inverse text-center mb-6">
          Profile
        </h1>
      </header>

      {showCancelMessage && (
        <div className="mx-4 mb-4 bg-warning/20 border border-warning/30 rounded-lg p-3">
          <p className="text-warning text-sm text-center">
            Checkout was canceled. You can upgrade anytime!
          </p>
        </div>
      )}

      <div className="pb-24 max-w-[600px] mx-auto w-full">
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="space-y-4">
              <ErrorMessage error="Failed to load billing information" />
              <button
                onClick={() => refetch()}
                className="btn btn-secondary w-full"
              >
                Retry
              </button>
            </div>
          ) : billingStatus ? (
            <>
              <CurrentPlanCard billingStatus={billingStatus} />
              <UsageCard billingStatus={billingStatus} />
              <PlanFeaturesCard
                billingStatus={billingStatus}
                onUpgrade={() => upgradeMutation.mutate()}
                onManageSubscription={() => manageSubscriptionMutation.mutate()}
                isUpgradePending={upgradeMutation.isPending}
                isManagePending={manageSubscriptionMutation.isPending}
              />
            </>
          ) : null}

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-border-inverse-subtle">
            <button
              onClick={handleSignOut}
              className="btn btn-secondary w-full"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
