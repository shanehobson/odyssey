import type { Day, TripPlan } from "@/shared/types/trip";
import { JSX, useState } from "react";
import { DayHeader } from "./DayHeader";
import { DayItemCard } from "./DayItemCard";
import { shortenLocationName } from "./dateTimeUtils";

interface TripDayProps {
  day: Day;
  tripPlan: TripPlan;
  isExpanded?: boolean;
  onToggle?: (isExpanded: boolean) => void;
  dayNumber?: number;
}

export function TripDay({
  day,
  tripPlan,
  isExpanded: externalIsExpanded,
  onToggle,
  dayNumber,
}: TripDayProps): JSX.Element {
  const [internalIsExpanded, setInternalIsExpanded] = useState(true);

  const isExpanded =
    externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;

  const getPlaceName = (placeId?: string): string => {
    if (!placeId || !tripPlan.places[placeId]) return "";
    return tripPlan.places[placeId].name;
  };

  const getPrimaryLocation = (): string => {
    const primaryItem = day.items.find(
      (item) =>
        (item.kind === "activity" || item.kind === "lodging") && item.placeId
    );

    if (primaryItem && primaryItem.placeId) {
      return shortenLocationName(getPlaceName(primaryItem.placeId));
    }

    const anyItemWithPlace = day.items.find((item) => item.placeId);
    if (anyItemWithPlace && anyItemWithPlace.placeId) {
      return shortenLocationName(getPlaceName(anyItemWithPlace.placeId));
    }

    return "";
  };

  const handleToggle = () => {
    const newExpandedState = !isExpanded;
    if (onToggle) {
      onToggle(newExpandedState);
    } else {
      setInternalIsExpanded(newExpandedState);
    }
  };

  return (
    <div className="rounded-xl shadow-md mb-6 overflow-hidden">
      <DayHeader
        date={day.date}
        dayNumber={dayNumber || 1}
        primaryLocation={getPrimaryLocation()}
        isExpanded={isExpanded}
        onToggle={handleToggle}
      />

      {isExpanded && (
        <div className="bg-white p-6">
          {day.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📅</div>
              <p>No activities planned for this day</p>
            </div>
          ) : (
            <div className="space-y-4">
              {day.items.map((item, index) => (
                <DayItemCard
                  key={`${day.date}-${item.id}-${index}`}
                  item={item}
                  placeName={getPlaceName(item.placeId)}
                  isLast={index === day.items.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
