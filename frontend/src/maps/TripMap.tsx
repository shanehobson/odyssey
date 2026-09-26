import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  calculateTripTotals,
  convertORSCoordinates,
  fetchTripRoutes,
  formatDistance,
  formatDuration,
  type RouteResponse,
} from "./routingService";

export type TripStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

function FitBounds({ stops }: { stops: TripStop[] }) {
  const map = useMap();

  useEffect(() => {
    if (!stops.length) return;

    // If only one stop, just set view
    if (stops.length === 1 && stops[0]) {
      map.setView([stops[0].lat, stops[0].lng], 10, { animate: true });
      return;
    }

    const bounds = stops.map((s) => [s.lat, s.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, stops]);

  return null;
}

interface TripMapProps {
  stops: TripStop[];
  height?: number;
  showWrapper?: boolean;
}

export function TripMap({
  stops,
  height = 520,
  showWrapper = false,
}: TripMapProps) {
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (stops.length && stops[0]) return [stops[0].lat, stops[0].lng];
    // fallback center (Denver)
    return [39.7392, -104.9903];
  }, [stops]);

  // Fetch routes when stops change
  useEffect(() => {
    if (stops.length < 2) {
      setRoutes([]);
      return;
    }

    setIsLoadingRoutes(true);
    setRouteError(null);

    fetchTripRoutes(stops)
      .then((fetchedRoutes) => {
        setRoutes(fetchedRoutes);
        // Don't show error for expected fallback behavior
        // Only set error if we have partial routes (some succeeded, some failed)
        const hasPartialRoutes = fetchedRoutes.length > 0 && fetchedRoutes.length < stops.length - 1;
        if (hasPartialRoutes) {
          setRouteError("Some routes unavailable. Showing simplified paths.");
        }
      })
      .catch((error) => {
        console.error("Route fetching failed:", error);
        // Don't show error - this is expected behavior for some locations
        setRoutes([]);
      })
      .finally(() => {
        setIsLoadingRoutes(false);
      });
  }, [stops]);

  // Create polylines from routes or fallback to straight lines
  const polylines = useMemo(() => {
    if (routes.length > 0) {
      // Use actual road routes
      return routes.map((route, index) => ({
        id: `route-${index}`,
        positions: convertORSCoordinates(route.coordinates),
        pathOptions: {
          color: "#2563eb", // Blue for actual routes
          weight: 4,
        }
      }));
    } else if (stops.length >= 2) {
      // Fallback to straight lines
      const straightLine = stops.map((s) => [s.lat, s.lng] as [number, number]);
      return [
        {
          id: "straight-line",
          positions: straightLine,
          pathOptions: {
            color: "#dc2626", // Red for straight lines
            weight: 3,
            dashArray: "10, 10", // Dashed to indicate it's not a real route
          }
        },
      ];
    }
    return [];
  }, [routes, stops]);

  // Calculate trip totals if we have routes
  const tripTotals = useMemo(() => {
    if (routes.length > 0) {
      return calculateTripTotals(routes);
    }
    return null;
  }, [routes]);

  const mapContent = (
    <div className="map-container">
      {/* Route Info Header */}
      {tripTotals && (
        <div className="map-info-header">
          <span>📍 {stops.length} stops</span>
          <span>🛣️ {formatDistance(tripTotals.distance)}</span>
          <span>⏱️ {formatDuration(tripTotals.duration)}</span>
          {isLoadingRoutes && (
            <span className="map-loading-indicator">🔄 Loading routes...</span>
          )}
        </div>
      )}

      {/* Map Container */}
      <div className="w-full" style={{ height }}>
        <MapContainer
          center={center}
          zoom={10}
          scrollWheelZoom={true}
          className="map-leaflet-container"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <FitBounds stops={stops} />

          {stops.map((s, i) => {
            const label =
              i === 0
                ? "Start"
                : i === stops.length - 1
                ? "End"
                : `Stop ${i + 1}`;

            return (
              <Marker key={s.id} position={[s.lat, s.lng]}>
                <Popup>
                  <div className="map-popup-title">{s.name}</div>
                  <div className="map-popup-subtitle">
                    {label}
                  </div>
                  <div className="map-popup-coordinates">
                    {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {polylines.map((line) => (
            <Polyline
              key={line.id}
              positions={line.positions}
              pathOptions={line.pathOptions}
            />
          ))}
        </MapContainer>
      </div>

      {/* Route Warning - Below Map */}
      {routeError && (
        <div className="map-error-banner-below">
          ℹ️ {routeError}
        </div>
      )}
    </div>
  );

  if (showWrapper) {
    return (
      <div className="mb-6">
        <hr className="border-t border-inverse mb-6 mt-8" />
        <h2 className="text-xl font-semibold text-inverse mb-4 text-center">
          Route Map
        </h2>
        <div className="rounded-xl overflow-hidden shadow-lg">
          {mapContent}
        </div>
      </div>
    );
  }

  return mapContent;
}
