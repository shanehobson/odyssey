import { useLocation } from "react-router-dom";
import { useMemo } from "react";

// Background image imports
import multnomahBackground from "@/assets/images/multnomah.png";
import tripListBackground from "@/assets/images/trip-list-bg.png";
import profileBackground from "@/assets/images/profile-bg.png";

export interface BackgroundConfig {
  image: string;
  overlay?: string;
}

/**
 * Custom hook to manage background images based on the current route
 */
export function useBackgroundImage(): BackgroundConfig {
  const location = useLocation();

  const backgroundConfig = useMemo((): BackgroundConfig => {
    // Check for specific routes and return appropriate background
    switch (location.pathname) {
      case "/trips":
        return {
          image: tripListBackground,
          overlay: "rgba(0, 0, 0, 0.5)", // Lighter overlay for trips list
        };
      
      case "/trips/new":
        return {
          image: multnomahBackground,
          overlay: "rgba(0, 0, 0, 0.8)", // Darker overlay for create trip form
        };
      
      case "/profile":
        return {
          image: profileBackground,
          overlay: "rgba(0, 0, 0, 0.7)", // Dark overlay for readability
        };
      
      default:
        return {
          image: multnomahBackground,
          overlay: "rgba(0, 0, 0, 0.7)", // Default dark overlay
        };
    }
  }, [location.pathname]);

  return backgroundConfig;
}