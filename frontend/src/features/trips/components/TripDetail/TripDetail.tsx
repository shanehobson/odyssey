import { convertTripPlacesToStops } from "@/maps/tripMapUtils";
import { ErrorMessage } from "@/shared/components/ErrorMessage/ErrorMessage";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner/LoadingSpinner";
import { JSX, useMemo } from "react";
import { useTrip } from "../../data/useTrip";
import { formatDate } from "../../utils/date.utils";
import { TripContent } from "../TripContent/TripContent";
import { TripHeader } from "../TripHeader/TripHeader";

export function TripDetail({ tripId }: { tripId: string }): JSX.Element | null {
  const { data, isLoading, error, refetch } = useTrip(tripId);

  const mapStops = useMemo(() => {
    return data ? convertTripPlacesToStops(data) : [];
  }, [data?.places, data?.legs]);

  if (isLoading) {
    return (
      <div
        className="flex justify-center pt-32"
        data-testid="trip-detail-loading"
      >
        <LoadingSpinner size="large" />
      </div>
    );
  } else if (error) {
    return (
      <div className="p-6">
        <ErrorMessage
          error={`Error loading trip: ${(error as Error).message}`}
          className="text-inverse bg-white/20 border border-border-inverse-subtle px-4 py-3 rounded-md"
        />
      </div>
    );
  } else if (!data) {
    return null;
  }

  // Ensure we have valid date range data
  if (!data.dateRange || !data.dateRange.start || !data.dateRange.end) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const start = new Date(data.dateRange.start);
  const end = new Date(data.dateRange.end);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const tripDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days

  return (
    <div>
      <TripHeader
        title={data.title}
        startDate={data.dateRange.start}
        endDate={data.dateRange.end}
        duration={tripDuration}
        formatDate={formatDate}
      />

      <TripContent
        tripId={tripId}
        data={data}
        mapStops={mapStops}
        onRefetch={async () => {
          await refetch();
        }}
      />
    </div>
  );
}
