import { TripMap, type TripStop } from "@/maps/TripMap";
import type { TripPlan } from "@/shared/types/trip";
import { JSX } from "react";
import { TripForm } from "../TripForm/TripForm";
import { TripItinerary } from "../TripItinerary/TripItinerary";

interface TripContentProps {
  tripId: string;
  data: TripPlan;
  mapStops: TripStop[];
  onRefetch: () => void | Promise<void>;
}

export function TripContent({
  tripId,
  data,
  mapStops,
  onRefetch,
}: TripContentProps): JSX.Element {
  const getTripFormDefaults = () => {
    return {
      tripInput: "",
      dateStart: data.dateRange.start,
      dateEnd: data.dateRange.end,
    };
  };

  return (
    <div className="p-6 pb-24 max-w-[1000px] mx-auto">
      {/* Update Trip Form */}
      <div className="mb-6">
        <TripForm
          defaults={getTripFormDefaults()}
          onSuccess={async () => {
            await onRefetch();
          }}
          tripId={tripId}
          isUpdateMode={true}
        />
      </div>

      {data.places && Object.keys(data.places).length > 0 && (
        <TripMap stops={mapStops} height={400} showWrapper={true} />
      )}

      <TripItinerary
        days={data.days}
        tripPlan={data}
        hasTitle={!!data.title}
        dateRange={data.dateRange}
      />
    </div>
  );
}
