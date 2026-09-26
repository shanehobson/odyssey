import { TripDetail } from "@/features/trips/components/TripDetail/TripDetail";
import { JSX, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function TripDetailPage(): JSX.Element {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!tripId || tripId === 'undefined') {
      navigate("/trips", { replace: true });
    }
  }, [tripId, navigate]);

  if (!tripId || tripId === 'undefined') {
    return <div></div>;
  }

  return (
    <div className="p-4">
      <TripDetail tripId={tripId} />
    </div>
  );
}
