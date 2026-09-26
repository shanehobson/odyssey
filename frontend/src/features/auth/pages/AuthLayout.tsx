import logo1 from "@/assets/images/logo1.svg";
import yosemiteBackground from "@/assets/images/yosemite.png";
import { JSX, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AuthLayout(): JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  // Redirect authenticated users directly to create trip page
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/trips/new", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <div className="text-inverse bg-overlay-medium px-6 py-3 rounded-md backdrop-blur-sm">
            Loading...
          </div>
        </div>
      );
    }

    if (isAuthenticated) {
      return (
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <div className="text-inverse bg-overlay-medium px-6 py-3 rounded-md backdrop-blur-sm">
            Redirecting...
          </div>
        </div>
      );
    }

    return (
      <div className="relative z-10 w-full px-4 pt-4 flex flex-col items-center">
        <div className="text-center mb-8 mt-2 lg:mb-4">
          <img
            src={logo1}
            alt="Odyssey Logo"
            className="logo mb-2 h-32 w-auto mx-auto"
          />
          <h1 className="heading-primary text-inverse drop-shadow-lg">
            Plan Your Next Adventure
          </h1>
        </div>

        <div className="w-full flex justify-center mt-12 lg:mt-4 flex-grow">
          <div className="bg-surface/95 rounded-lg shadow-xl p-8 max-w-md w-full h-full">
            <Outlet />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen flex relative"
      style={{
        backgroundImage: `url(${yosemiteBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4 z-20"></div>

      {/* Single dark overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-overlay" />

      {renderContent()}
    </div>
  );
}
