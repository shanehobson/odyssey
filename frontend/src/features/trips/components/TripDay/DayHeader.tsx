import { JSX } from "react";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import { formatDate } from "./dateTimeUtils";

interface DayHeaderProps {
  date: string;
  dayNumber: number;
  primaryLocation: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function DayHeader({
  date,
  dayNumber,
  primaryLocation,
  isExpanded,
  onToggle,
}: DayHeaderProps): JSX.Element {
  return (
    <button
      onClick={onToggle}
      className="w-full bg-brand-primary bg-brand-primary-hover transition-colors py-5 text-inverse relative cursor-pointer"
    >
      <div className="flex flex-col items-center gap-1 px-20">
        <div className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-white text-black px-3 py-1 rounded-full text-xs font-medium">
          Day {dayNumber}
        </div>

        <h3 className="text-lg font-semibold">{formatDate(date)}</h3>

        {primaryLocation && (
          <div className="flex gap-1 text-sm">
            <span>{primaryLocation}</span>
          </div>
        )}
      </div>

      <div className="absolute right-5 top-1/2 transform -translate-y-1/2">
        {isExpanded ? <IoChevronDown size={20} /> : <IoChevronUp size={20} />}
      </div>
    </button>
  );
}
