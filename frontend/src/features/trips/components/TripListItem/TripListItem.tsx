import { JSX } from "react";
import type { TripListItem as TripData } from "../../data/types";

interface TripListItemProps {
  trip: TripData;
  onSelect: (tripId: string) => void;
}

export function TripListItem({
  trip,
  onSelect,
}: TripListItemProps): JSX.Element {
  return (
    <button
      onClick={() => onSelect(trip.tripId)}
      className="text-left p-3 rounded-[5px] border border-border-muted lg:bg-white/10 lg:backdrop-blur-sm hover:bg-white/20 transition-colors w-full cursor-pointer"
    >
      <div className="font-bold text-gray-300 font-body !text-[15px] lg:!text-[14px] line-clamp-2">
        {trip.title ?? "Trip"}
      </div>
      <div className="text-brand-green font-body mt-1 text-[length:var(--trip-details-font-size)] lg:!text-[12px]">
        {trip.dateRange
          ? `${trip.dateRange.start} → ${trip.dateRange.end}`
          : ""}
      </div>
    </button>
  );
}
