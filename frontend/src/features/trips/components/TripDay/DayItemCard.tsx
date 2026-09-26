import type { DayItem } from "@/shared/types/trip";
import { JSX } from "react";
import { formatTime } from "./dateTimeUtils";

interface DayItemCardProps {
  item: DayItem;
  placeName: string;
  isLast: boolean;
}

function getItemIcon(kind: DayItem["kind"]): string {
  switch (kind) {
    case "activity":
      return "🎯";
    case "lodging":
      return "🏨";
    case "hold":
      return "⏳";
    case "note":
      return "📝";
    default:
      return "📌";
  }
}

export function DayItemCard({
  item,
  placeName,
  isLast,
}: DayItemCardProps): JSX.Element {
  return (
    <div className="flex items-start space-x-4 p-4 rounded-lg bg-[#e0e0e0] border border-border-card hover:border-border-muted shadow-md transition-colors">
      <div className="flex flex-col items-center">
        <div className="text-2xl mb-1">{getItemIcon(item.kind)}</div>
        {!isLast && <div className="w-px h-8 bg-gray-300 mt-2"></div>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-medium text-gray-900 mb-1">
              {item.title}
            </h4>
            <div className="md:flex md:gap-3">
              {item.placeId && placeName && (
                <div className="text-sm text-gray-600 mb-2">📍 {placeName}</div>
              )}

              {(item.start || item.end) && (
                <div className="text-sm text-gray-600 mb-2">
                  ⏰ {item.start && formatTime(item.start)}
                  {item.start && item.end && " - "}
                  {item.end && formatTime(item.end)}
                </div>
              )}
            </div>

            {item.notes && (
              <div className="text-sm text-gray-700 mt-2 px-3 py-2 bg-gray-50 rounded-md">
                {item.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
