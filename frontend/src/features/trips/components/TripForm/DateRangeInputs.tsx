import { FieldError } from "@/shared/components/FieldError/FieldError";
import { JSX } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { TripFormData } from "@/features/trips/validations/trip.schemas";

interface DateRangeInputsProps {
  register: UseFormRegister<TripFormData>;
  errors: FieldErrors<TripFormData>;
  isSubmitting: boolean;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export function DateRangeInputs({
  register,
  errors,
  isSubmitting,
  onKeyDown,
}: DateRangeInputsProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label
          htmlFor="dateStart"
          className="block text-sm font-medium text-inverse mb-2"
        >
          Start Date
        </label>
        <input
          {...register("dateStart")}
          type="date"
          id="dateStart"
          className="w-full px-3 py-2 border border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-inverse bg-transparent placeholder-white/60 [color-scheme:dark]"
          disabled={isSubmitting}
          onKeyDown={onKeyDown}
        />
        {errors.dateStart && <FieldError error={errors.dateStart.message} />}
      </div>
      <div>
        <label
          htmlFor="dateEnd"
          className="block text-sm font-medium text-inverse mb-2"
        >
          End Date
        </label>
        <input
          {...register("dateEnd")}
          type="date"
          id="dateEnd"
          className="w-full px-3 py-2 border border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-inverse bg-transparent placeholder-white/60 [color-scheme:dark]"
          disabled={isSubmitting}
          onKeyDown={onKeyDown}
        />
        {errors.dateEnd && <FieldError error={errors.dateEnd.message} />}
      </div>
    </div>
  );
}
