import { TripList } from "@/features/trips/components/TripList/TripList";
import { useUserPrefs } from "@/shared/hooks/useUserPrefs";
import { JSX } from "react";
import {
  TbCirclePlus,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
} from "react-icons/tb";

interface SidebarProps {
  onOpenTrip: (tripId: string) => void;
  onCreateTrip: () => void;
}

export function Sidebar({
  onOpenTrip,
  onCreateTrip,
}: SidebarProps): JSX.Element {
  const { prefs, setSidebarCollapsed } = useUserPrefs();
  const isCollapsed = prefs.sidebarCollapsed ?? true;

  return (
    <aside
      className={`hidden lg:flex lg:flex-col shrink-0 border-r border-border-muted transition-all duration-300 overflow-y-auto ${
        isCollapsed ? "w-12" : "w-[300px]"
      }`}
    >
      <div
        className={`flex p-4 ${
          isCollapsed
            ? "flex-col-reverse items-center gap-2"
            : "justify-between gap-1"
        }`}
      >
        <button
          onClick={onCreateTrip}
          className="text-inverse-muted hover:text-inverse p-1 transition-colors cursor-pointer"
          aria-label="Create new trip"
        >
          <TbCirclePlus size={28} />
        </button>
        <button
          onClick={() => setSidebarCollapsed(!isCollapsed)}
          className="text-inverse-muted hover:text-inverse p-1 transition-colors cursor-pointer"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <TbLayoutSidebarLeftExpand size={27} />
          ) : (
            <TbLayoutSidebarLeftCollapse size={27} />
          )}
        </button>
      </div>

      <div
        className={`flex-1 px-4 pb-4 transition-opacity duration-300 ${
          isCollapsed
            ? "opacity-0 pointer-events-none overflow-hidden"
            : "opacity-100"
        }`}
      >
        <TripList onTripSelect={onOpenTrip} onCreateTrip={onCreateTrip} />
      </div>
    </aside>
  );
}
