import { JSX } from "react";

interface EmptyTripStateProps {
  hasTitle: boolean;
}

export function EmptyTripState({ hasTitle }: EmptyTripStateProps): JSX.Element {
  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">🚗</div>
      <h3 className="text-lg font-medium text-inverse mb-2">
        {hasTitle ? "Planning Your Trip" : "No itinerary yet"}
      </h3>
      <p className="text-inverse">
        {hasTitle
          ? "Your personalized itinerary is being created..."
          : "This trip doesn't have any planned activities yet."}
      </p>
    </div>
  );
}