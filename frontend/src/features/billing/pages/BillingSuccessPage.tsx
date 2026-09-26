import { JSX, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useBillingStatus, BILLING_RETURN_URL_KEY } from "../data/useBillingStatus";
import { billingKeys } from "../data/keys";
import { useBackgroundImage } from "@/features/trips/hooks/useBackgroundImage";
import { AppHeader } from "@/shared/components/AppHeader/AppHeader";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner/LoadingSpinner";

export default function BillingSuccessPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: billingStatus } = useBillingStatus();
  const backgroundConfig = useBackgroundImage();
  
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [isActivated, setIsActivated] = useState(false);
  const [returnUrl] = useState(() => {
    const stored = sessionStorage.getItem(BILLING_RETURN_URL_KEY);
    sessionStorage.removeItem(BILLING_RETURN_URL_KEY);
    return stored || '/profile';
  });

  useEffect(() => {
    const maxAttempts = 15; // 15 seconds
    const pollInterval = 1000; // 1 second

    const pollForActivation = async () => {
      if (pollingAttempts >= maxAttempts) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: billingKeys.status() });
      const status = queryClient.getQueryData<typeof billingStatus>(billingKeys.status());
      
      if (status?.plan === 'pro') {
        setIsActivated(true);
        setTimeout(() => {
          navigate(returnUrl);
        }, 2000);
        return;
      }

      setPollingAttempts(prev => prev + 1);
      setTimeout(pollForActivation, pollInterval);
    };

    const timer = setTimeout(pollForActivation, pollInterval);
    return () => clearTimeout(timer);
  }, [pollingAttempts, queryClient, navigate, returnUrl]);

  const handleContinueAnyway = () => {
    navigate(returnUrl);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

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

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-border-inverse-subtle max-w-md w-full text-center">
            {!isActivated ? (
              pollingAttempts < 15 ? (
                <>
                  <div className="mb-6">
                    <div className="w-16 h-16 mx-auto mb-4">
                      <LoadingSpinner />
                    </div>
                    <h1 className="text-2xl font-bold text-inverse mb-2">
                      Payment Successful!
                    </h1>
                    <p className="text-inverse-muted">
                      Activating your Pro plan... This usually takes a few seconds.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="h-2 bg-success rounded-full transition-all duration-1000"
                        style={{
                          width: `${(pollingAttempts / 15) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-inverse-subtle text-sm">
                      {pollingAttempts}/15 seconds
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-warning/20 rounded-full flex items-center justify-center">
                      <span className="text-warning text-2xl">⚠️</span>
                    </div>
                    <h1 className="text-2xl font-bold text-inverse mb-2">
                      Still Activating...
                    </h1>
                    <p className="text-inverse-muted mb-4">
                      Your payment was successful, but activation is taking longer than usual.
                      This can happen during high traffic periods.
                    </p>
                    <p className="text-inverse-subtle text-sm">
                      Your Pro plan will be active shortly. Try refreshing in a moment, 
                      or continue to your trips and check back later.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <button
                      onClick={handleRefresh}
                      className="btn btn-primary w-full"
                    >
                      Refresh Page
                    </button>
                    <button
                      onClick={handleContinueAnyway}
                      className="btn btn-secondary w-full"
                    >
                      Continue to Profile
                    </button>
                  </div>
                </>
              )
            ) : (
              <>
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-success/20 rounded-full flex items-center justify-center">
                    <span className="text-success text-2xl">✓</span>
                  </div>
                  <h1 className="text-2xl font-bold text-inverse mb-2">
                    Welcome to Pro!
                  </h1>
                  <p className="text-inverse-muted">
                    Your Pro plan is now active. Redirecting...
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="w-full bg-success/20 rounded-full h-2">
                    <div className="h-2 bg-success rounded-full w-full" />
                  </div>
                  <p className="text-success text-sm">
                    Activation complete!
                  </p>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}