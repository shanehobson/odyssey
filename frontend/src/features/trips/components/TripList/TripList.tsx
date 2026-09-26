import { ErrorMessage } from "@/shared/components/ErrorMessage/ErrorMessage";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner/LoadingSpinner";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { JSX, useEffect, useRef } from "react";
import { useAllTrips } from "../../data/useInfiniteTrips";
import { TripListItem } from "../TripListItem/TripListItem";

interface TripListProps {
  onTripSelect: (id: string) => void;
  onCreateTrip?: () => void;
}

export function TripList({ onTripSelect }: TripListProps): JSX.Element {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const {
    items,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useAllTrips();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage || !ref.current) return;
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && fetchNextPage()
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [hasNextPage, fetchNextPage]);

  // Show loading while auth is still checking or trips are loading
  if (authLoading || (status === "pending" && isAuthenticated))
    return (
      <div className="flex justify-center pt-32">
        <LoadingSpinner />
      </div>
    );
  
  // If not authenticated and auth finished loading, RequireAuth will handle redirect
  // Just show loading to avoid flash during redirect
  if (!authLoading && !isAuthenticated)
    return (
      <div className="flex justify-center pt-32">
        <LoadingSpinner />
      </div>
    );
  
  // Only show error if we're authenticated and it's not an auth-related error
  if (status === "error" && isAuthenticated && 
      (error as Error).message !== "UNAUTHENTICATED")
    return (
      <ErrorMessage
        error={(error as Error).message}
        className="text-inverse bg-white/20 border border-border-inverse-subtle px-4 py-3 rounded-md"
      />
    );

  return (
    <div className="grid gap-5">
      {items.filter(Boolean).map((t) => (
        <TripListItem key={t.tripId} trip={t} onSelect={onTripSelect} />
      ))}
      <div ref={ref} />
      {isFetchingNextPage && (
        <div className="py-3 flex justify-center">
          <LoadingSpinner size="small" />
        </div>
      )}
    </div>
  );
}
