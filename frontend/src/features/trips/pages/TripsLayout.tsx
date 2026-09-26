import { Sidebar } from "@/features/trips/components/Sidebar/Sidebar";
import { AppHeader } from "@/shared/components/AppHeader/AppHeader";
import { JSX } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BottomNavigation } from "../components/BottomNavigation/BottomNavigation";
import { useBackgroundImage } from "../hooks/useBackgroundImage";

export default function TripsLayout(): JSX.Element {
  const navigate = useNavigate();
  const backgroundConfig = useBackgroundImage();

  const handleOpenTrip = (tripId: string) => {
    navigate(`/trips/${tripId}`);
  };

  const handleCreateTrip = () => {
    navigate("/trips/new");
  };

  return (
    <div
      className="flex h-screen flex-col relative"
      style={{
        backgroundImage: `url(${backgroundConfig.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dynamic overlay for better readability */}
      {backgroundConfig.overlay && (
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{ backgroundColor: backgroundConfig.overlay }}
        />
      )}

      <div className="relative z-10 flex flex-col h-screen">
        <AppHeader />

        <div className="flex flex-1 min-h-0">
          <Sidebar
            onOpenTrip={handleOpenTrip}
            onCreateTrip={handleCreateTrip}
          />

          <div className="flex flex-1 flex-col min-w-0">
            <main className="flex-1 overflow-y-auto pb-16 lg:py-8 lg:px-14 lg:pb-0">
              <Outlet />
            </main>

            <BottomNavigation />
          </div>
        </div>
      </div>
    </div>
  );
}
