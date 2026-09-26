import { useNavigate } from "react-router-dom";
import { TripList } from "../components/TripList/TripList";

export default function TripsListPage() {
  const navigate = useNavigate();

  const handleTripSelect = (tripId: string) => {
    navigate(`/trips/${tripId}`);
  };

  return (
    <div
      id="trips-list-page"
      className="flex h-full flex-col bg-transparent lg:hidden px-1"
    >
      <header>
        <h1 className="text-2xl font-bold text-inverse text-center mb-2 pt-6">
          Your Trips
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 pb-16">
        <TripList onTripSelect={handleTripSelect} />
      </div>
    </div>
  );
}
