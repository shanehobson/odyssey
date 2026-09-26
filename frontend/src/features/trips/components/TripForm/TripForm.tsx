import type { StreamTripEvent } from "@/features/trips/api/streamTrip";
import { useCreateTripStream } from "@/features/trips/data/useCreateTripStream";
import { useUpdateTripStream } from "@/features/trips/data/useUpdateTripStream";
import {
  createTripFormSchema,
  createUpdateTripFormSchema,
  type TripFormData,
} from "@/features/trips/validations/trip.schemas";
import type { UserPlan } from "@/shared/config/plan-policy";
import { ErrorMessage } from "@/shared/components/ErrorMessage/ErrorMessage";
import { FieldError } from "@/shared/components/FieldError/FieldError";
import type { TripRequest } from "@/shared/types/trip";
import { zodResolver } from "@hookform/resolvers/zod";
import { JSX, useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { UpgradeModal } from "@/features/billing/components/UpgradeModal/UpgradeModal";
import { useBillingStatus } from "@/features/billing/data/useBillingStatus";
import { isUpgradeRequiredError, isUpgradeRequiredStreamEvent } from "@/features/billing/utils/billing.utils";
import { useUserPrefs } from "@/shared/hooks/useUserPrefs";
import { getCreateStatusMessage, getUpdateStatusMessage } from "./statusMessages";
import { ProgressIndicator } from "./ProgressIndicator";
import { DateRangeInputs } from "./DateRangeInputs";

interface TripFormProps {
  defaults?: Partial<TripFormData>;
  onSuccess?: (tripId: string) => void;
  tripId?: string;
  isUpdateMode?: boolean;
}

export function TripForm({
  defaults,
  onSuccess,
  tripId,
  isUpdateMode,
}: TripFormProps): JSX.Element {
  const navigate = useNavigate();
  const { setSidebarCollapsed, hasSidebarPreference } = useUserPrefs();

  const isUpdate = !!tripId;

  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { data: billingStatus } = useBillingStatus();
  
  const userPlan: UserPlan = billingStatus?.plan === "pro" ? "pro" : "free";
  const tripFormSchema = useMemo(
    () => isUpdate ? createUpdateTripFormSchema(userPlan) : createTripFormSchema(userPlan),
    [userPlan, isUpdate]
  );

  const handleStreamEvent = (event: StreamTripEvent) => {
    if (event.type === "metadata") {
      if (!isUpdate && event.tripId && event.tripId !== 'undefined') {
        navigate(`/trips/${event.tripId}`);
      }
    }
    if (event.type === "status") {
      const customMessage = isUpdate ? 
        getUpdateStatusMessage(event.message) : 
        getCreateStatusMessage(event.message);
      setProgressMessage(customMessage);
    }
    if (event.type === "error") {
      if (isUpgradeRequiredStreamEvent(event)) {
        setProgressMessage(null);
        setShowUpgradeModal(true);
      } else {
        setProgressMessage(`Error: ${event.message}`);
      }
    }
  };

  const createTripStreamMutation = useCreateTripStream(handleStreamEvent);
  const updateTripStreamMutation = useUpdateTripStream(handleStreamEvent);

  const mutation = isUpdate ? updateTripStreamMutation : createTripStreamMutation;

  const {
    register,
    handleSubmit,
    resetField,
    reset,
    watch,
    formState: { errors, isSubmitting, isValid, touchedFields },
  } = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema) as never,
    mode: "all",
    defaultValues: {
      tripInput: defaults?.tripInput || "",
      dateStart: defaults?.dateStart || "",
      dateEnd: defaults?.dateEnd || "",
    },
  });

  const watchedValues = watch();
  const hasChanges = useMemo(() => {
    if (!isUpdate) return true;
    const tripInputChanged = (watchedValues.tripInput || "") !== (defaults?.tripInput || "");
    const dateStartChanged = (watchedValues.dateStart || "") !== (defaults?.dateStart || "");
    const dateEndChanged = (watchedValues.dateEnd || "") !== (defaults?.dateEnd || "");
    return tripInputChanged || dateStartChanged || dateEndChanged;
  }, [isUpdate, watchedValues, defaults]);

  // Reset form values when defaults change (e.g., switching between trips)
  useEffect(() => {
    if (defaults) {
      reset({
        tripInput: defaults.tripInput || "",
        dateStart: defaults.dateStart || "",
        dateEnd: defaults.dateEnd || "",
      });
    }
  }, [defaults, reset]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !mutation.isPending && isValid && hasChanges) {
      event.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const onSubmit = async (data: TripFormData) => {
    setError(null);
    setProgressMessage(null);

    const tripRequest: TripRequest = {
      ...(isUpdate && { tripId }),
      intent: isUpdate ? "update" : "create",
      tripInput: data.tripInput,
      preferences: {
        dateRange: {
          start: data.dateStart,
          end: data.dateEnd,
        },
        include: {
          hotels: true,
          restaurants: true,
          camping: true,
        },
      },
    };

    try {
      const result = await mutation.mutateAsync(tripRequest);
      const resultTripId = result.trip?.tripId || tripId;

      if (resultTripId) {
        setProgressMessage(null);

        if (!isUpdate && !hasSidebarPreference()) {
          setSidebarCollapsed(false);
        }

        if (isUpdate) {
          resetField("tripInput");
        }

        if (onSuccess) {
          onSuccess(resultTripId);
        } else {
          navigate(`/trips/${resultTripId}`);
        }
      } else {
        setError("Trip was created/updated but no ID was returned");
      }
    } catch (err) {
      setProgressMessage(null);
      
      if (isUpgradeRequiredError(err)) {
        setShowUpgradeModal(true);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to ${isUpdate ? "update" : "create"} trip`
        );
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <textarea
          {...register("tripInput")}
          id="tripInput"
          className="w-full px-3 py-2 border border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-inverse bg-transparent placeholder-white/60"
          rows={4}
          spellCheck={false}
          placeholder={
            isUpdateMode
              ? "Provide additional details or changes you'd like AI to make to refine your trip..."
              : "Tell us about your dream trip...Where do you want to go? What do you want to see? Any specific activities or experiences you are looking for?"
          }
          disabled={isSubmitting}
          onKeyDown={handleKeyDown}
        />
        {errors.tripInput && touchedFields.tripInput && <FieldError error={errors.tripInput.message} />}
      </div>

      <DateRangeInputs
        register={register}
        errors={errors}
        isSubmitting={isSubmitting}
        onKeyDown={handleKeyDown}
      />

      {mutation.isPending && progressMessage && (
        <ProgressIndicator message={progressMessage} />
      )}

      <ErrorMessage
        error={error}
        className="text-inverse bg-white/20 border border-border-inverse-subtle px-4 py-3 rounded-md"
      />

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={mutation.isPending || !isValid || !hasChanges}
          className={`btn ${
            mutation.isPending ? "btn-primary" : "btn-secondary"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {mutation.isPending
            ? `${isUpdate ? "Updating" : "Generating"} Trip...`
            : `${isUpdate ? "Update Trip" : "Generate Trip With AI"}`}
        </button>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        billingStatus={billingStatus}
      />
    </form>
  );
}
