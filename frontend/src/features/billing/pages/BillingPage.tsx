import { JSX, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBillingStatus, useUpgradeToPro, useManageSubscription } from "../data/useBillingStatus";
import { CurrentPlanCard } from "../components/CurrentPlanCard";
import { UsageCard } from "../components/UsageCard";
import { PlanFeaturesCard } from "../components/PlanFeaturesCard";
import { BottomNavigation } from "@/features/trips/components/BottomNavigation/BottomNavigation";
import { useBackgroundImage } from "@/features/trips/hooks/useBackgroundImage";
import { AppHeader } from "@/shared/components/AppHeader/AppHeader";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner/LoadingSpinner";
import { ErrorMessage } from "@/shared/components/ErrorMessage/ErrorMessage";

export default function BillingPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [showCancelMessage, setShowCancelMessage] = useState(false);
  
  const { data: billingStatus, isLoading, error, refetch } = useBillingStatus();
  const upgradeMutation = useUpgradeToPro();
  const manageSubscriptionMutation = useManageSubscription();
  
  const backgroundConfig = useBackgroundImage();

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      setShowCancelMessage(true);
      const timer = setTimeout(() => setShowCancelMessage(false), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [searchParams]);

  return (
    <div
      className="flex h-screen flex-col relative"
      style={{
        backgroundImage: `url(${backgroundConfig.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {backgroundConfig.overlay && (
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{ backgroundColor: backgroundConfig.overlay }}
        />
      )}

      <div className="relative z-10 flex h-screen flex-col">
        <AppHeader />

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0 flex h-full flex-col lg:hidden">
          <header className="pt-2">
            <h1 className="text-2xl font-bold text-inverse text-center mb-6">
              Billing & Usage
            </h1>
          </header>

          {showCancelMessage && (
            <div className="mx-4 mb-4 bg-warning/20 border border-warning/30 rounded-lg p-3">
              <p className="text-warning text-sm text-center">
                Checkout was canceled. You can upgrade anytime!
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
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
              <div className="space-y-6">
                <CurrentPlanCard billingStatus={billingStatus} />
                <UsageCard billingStatus={billingStatus} />
                <PlanFeaturesCard
                  billingStatus={billingStatus}
                  onUpgrade={() => upgradeMutation.mutate()}
                  onManageSubscription={() => manageSubscriptionMutation.mutate()}
                  isUpgradePending={upgradeMutation.isPending}
                  isManagePending={manageSubscriptionMutation.isPending}
                />
              </div>
            ) : null}
          </div>
        </main>

        <BottomNavigation />
      </div>
    </div>
  );
}
