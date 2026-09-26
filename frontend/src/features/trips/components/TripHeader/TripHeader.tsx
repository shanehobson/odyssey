import { JSX } from "react";

interface TripHeaderProps {
  title: string;
  startDate: string;
  endDate: string;
  duration: number;
  formatDate: (dateString: string) => string;
}

export function TripHeader({
  title,
  startDate,
  endDate,
  duration,
  formatDate,
}: TripHeaderProps): JSX.Element {
  return (
    <div className="px-6 z-10">
      <h1 className="text-2xl lg:text-3xl font-bold text-inverse text-center mb-3">
        {title}
      </h1>

      <div className="flex flex-wrap gap-4 text-sm text-inverse text-center justify-center">
        <div className="flex items-center">
          <span className="font-medium">📅</span>
          <span className="ml-2">
            {formatDate(startDate)} → {formatDate(endDate)}
          </span>
        </div>

        <div className="flex items-center">
          <span className="font-medium">⏱️</span>
          <span className="ml-2">
            {duration} {duration === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
    </div>
  );
}