import { JSX, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./features/auth/components/RequireAuth/RequireAuth";
import { AuthProvider } from "./features/auth/contexts/AuthContext";
import { LoadingSpinner } from "./shared/components/LoadingSpinner/LoadingSpinner";

// Lazy load pages
const AuthLayout = lazy(() => import("./features/auth/pages/AuthLayout"));
const HomePage = lazy(() => import("./features/auth/pages/HomePage"));
const SignUpPage = lazy(() => import("./features/auth/pages/SignUpPage"));
const ConfirmEmailPage = lazy(
  () => import("./features/auth/pages/ConfirmEmailPage")
);
const ForgotPasswordPage = lazy(
  () => import("./features/auth/pages/ForgotPasswordPage")
);
const ResetPasswordPage = lazy(
  () => import("./features/auth/pages/ResetPasswordPage")
);
const TripsLayout = lazy(() => import("./features/trips/pages/TripsLayout"));
const TripsListPage = lazy(
  () => import("./features/trips/pages/TripsListPage")
);
const CreateTripPage = lazy(
  () => import("./features/trips/pages/CreateTripPage")
);
const TripDetailPage = lazy(
  () => import("./features/trips/pages/TripDetailPage")
);
const ProfilePage = lazy(() => import("./features/profile/pages/ProfilePage"));
const BillingSuccessPage = lazy(() => import("./features/billing/pages/BillingSuccessPage"));

function App(): JSX.Element {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Auth pages with shared layout */}
          <Route element={<AuthLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/confirm" element={<ConfirmEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Protected routes */}
          <Route element={<RequireAuth />}>
            <Route element={<TripsLayout />}>
              <Route path="/trips" element={<TripsListPage />} />
              <Route path="/trips/new" element={<CreateTripPage />} />
              <Route path="/trips/:tripId" element={<TripDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="/account/billing" element={<Navigate to="/profile" replace />} />
            <Route path="/billing/success" element={<BillingSuccessPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
