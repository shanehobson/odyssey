import type { Day as TripDayType, TripPlan } from "@/shared/types/trip";
import { JSX, useState } from "react";
import { IoContractOutline, IoExpandOutline } from "react-icons/io5";
import { EmptyTripState } from "../EmptyTripState/EmptyTripState";
import { TripDay } from "../TripDay/TripDay";

interface TripItineraryProps {
  days: TripDayType[];
  tripPlan: TripPlan;
  hasTitle: boolean;
  dateRange?: { start: string; end: string };
}

export function TripItinerary({
  days,
  tripPlan,
  hasTitle,
  dateRange,
}: TripItineraryProps): JSX.Element {
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);

  const handleExpandAll = () => {
    const newExpandedState = !allExpanded;
    setAllExpanded(newExpandedState);

    const newExpandedDays: Record<string, boolean> = {};
    days
      .filter((day) => day.date)
      .forEach((day) => (newExpandedDays[day.date] = newExpandedState));
    setExpandedDays(newExpandedDays);
  };

  const handleDayToggle = (date: string, isExpanded: boolean) => {
    setExpandedDays((prev) => ({
      ...prev,
      [date]: isExpanded,
    }));

    const allDaysExpanded = Object.values({
      ...expandedDays,
      [date]: isExpanded,
    }).every((expanded) => expanded !== false);
    setAllExpanded(allDaysExpanded);
  };

  const calculateTotalDays = (): number => {
    if (!dateRange) return 0;
    return (
      Math.ceil(
        (new Date(dateRange.end).getTime() -
          new Date(dateRange.start).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    );
  };

  if (!days || days.length === 0) {
    return <EmptyTripState hasTitle={hasTitle} />;
  }

  const validDays = days.filter((day) => day.date && day.date !== "");
  const totalDays = calculateTotalDays();

  return (
    <div className="space-y-0">
      <hr className="border-t border-inverse mb-6 mt-8" />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-inverse text-center flex-grow">
          Itinerary
        </h2>

        {validDays.length > 0 && (
          <button
            onClick={handleExpandAll}
            className="flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 text-inverse rounded-lg transition-colors cursor-pointer"
            title={allExpanded ? "Collapse All" : "Expand All"}
          >
            {allExpanded ? (
              <IoContractOutline size={16} />
            ) : (
              <IoExpandOutline size={16} />
            )}
          </button>
        )}
      </div>

      <div>
        {validDays.map((day, index) => (
          <TripDay
            key={day.date}
            day={day}
            tripPlan={tripPlan}
            isExpanded={expandedDays[day.date] ?? true}
            onToggle={(isExpanded) => handleDayToggle(day.date, isExpanded)}
            dayNumber={index + 1}
          />
        ))}
      </div>

      {days.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          🚀 Generating your itinerary...
        </div>
      )}

      {days.length > 0 && days.length < totalDays && (
        <div className="text-center py-4 text-gray-500">
          ✨ Adding day {days.length + 1} of {totalDays}...
        </div>
      )}
    </div>
  );
}