import { TripForm } from "@/features/trips/components/TripForm/TripForm";
import { JSX } from "react";

export default function CreateTripPage(): JSX.Element {
  return (
    <div className="p-4 max-w-[1000px] mx-auto">
      <h1 className="text-2xl lg:text-3xl font-bold text-inverse text-center mb-6">
        Describe Your Ideal Road Trip
      </h1>
      <TripForm />
    </div>
  );
}
