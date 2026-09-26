import { useBillingStatus } from "@/features/billing/data/useBillingStatus";
import { JSX } from "react";
import { Link } from "react-router-dom";
import logo1 from "../../../assets/images/logo1.svg";

export function AppHeader(): JSX.Element {
  const { data: billingStatus } = useBillingStatus();

  const formatUsageDisplay = (): JSX.Element | null => {
    if (!billingStatus || !billingStatus.usage) return null;

    const { plan, usage } = billingStatus;
    const planDisplay = plan === "pro" ? "Pro" : "Free";
    const usageDisplay = `${usage.used}/${usage.limit}`;

    return (
      <Link
        to="/profile"
        className="flex items-center space-x-2 text-inverse-muted hover:text-inverse transition-colors duration-200"
      >
        <span className="text-sm">
          {planDisplay} <span className="text-inverse-subtle">({usageDisplay})</span>
        </span>
        {usage.used >= usage.limit && (
          <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded">
            Limit reached
          </span>
        )}
      </Link>
    );
  };

  return (
    <header className="bg-transparent border-b border-border-muted">
      <div className="px-4 sm:px-6 lg:px-12">
        <div className="flex items-center pt-2 lg:pb-2">
          {/* Mobile layout */}
          <div className="flex w-full justify-between items-center lg:hidden">
            {/* Left - Logo on mobile too */}
            <img src={logo1} alt="Odyssey" className="h-16 w-auto" />
            {/* Right - Billing info on mobile */}
            <div className="flex items-center">{formatUsageDisplay()}</div>
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:flex w-full justify-between items-center">
            {/* Left - Logo */}
            <img src={logo1} alt="Odyssey" className="h-16 w-auto" />
            {/* Right - Billing info and profile on desktop */}
            <div className="flex items-center gap-4 pr-4">
              {formatUsageDisplay()}
              <Link
                to="/profile"
                className="text-inverse-muted hover:text-inverse transition-colors duration-200"
                title="Profile"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M8 7a4 4 0 1 1 8 0a4 4 0 0 1-8 0m0 6a5 5 0 0 0-5 5a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3a5 5 0 0 0-5-5z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
