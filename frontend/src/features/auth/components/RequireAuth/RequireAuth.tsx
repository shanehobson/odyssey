import { useAuth } from "@/features/auth/contexts/AuthContext";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner/LoadingSpinner";
import { JSX } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export function RequireAuth(): JSX.Element {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    // Redirect to login page but save the location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
