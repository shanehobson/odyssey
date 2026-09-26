import { z } from "zod";
import { type UserPlan, getPlanLimits } from "@/shared/config/plan-policy";

const baseCreateTripFormSchema = z.object({
  tripInput: z
    .string()
    .min(1, "Trip description is required")
    .min(3, "Please provide a bit more detail (at least 3 characters)"),
  dateStart: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Start date cannot be in the past"),
  dateEnd: z
    .string()
    .optional(),
});

const baseUpdateTripFormSchema = z.object({
  tripInput: z.string().optional(),
  dateStart: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Start date cannot be in the past"),
  dateEnd: z
    .string()
    .optional(),
});

export function createTripFormSchema(plan: UserPlan = "free") {
  const limits = getPlanLimits(plan);
  
  return baseCreateTripFormSchema.refine((data) => {
    if (!data.dateStart || !data.dateEnd) return true;
    const startDate = new Date(data.dateStart);
    const endDate = new Date(data.dateEnd);
    return endDate >= startDate;
  }, {
    message: "End date cannot be before start date",
    path: ["dateEnd"],
  }).refine((data) => {
    if (!data.dateStart || !data.dateEnd) return true;
    const startDate = new Date(data.dateStart);
    const endDate = new Date(data.dateEnd);
    const diffInTime = endDate.getTime() - startDate.getTime();
    const diffInDays = Math.ceil(diffInTime / (1000 * 3600 * 24)) + 1;
    return diffInDays <= limits.maxTripDays;
  }, {
    message: `Trip duration cannot exceed ${limits.maxTripDays} days`,
    path: ["dateEnd"],
  });
}

export function createUpdateTripFormSchema(plan: UserPlan = "free") {
  const limits = getPlanLimits(plan);
  
  return baseUpdateTripFormSchema.refine((data) => {
    if (!data.dateStart || !data.dateEnd) return true;
    const startDate = new Date(data.dateStart);
    const endDate = new Date(data.dateEnd);
    return endDate >= startDate;
  }, {
    message: "End date cannot be before start date",
    path: ["dateEnd"],
  }).refine((data) => {
    if (!data.dateStart || !data.dateEnd) return true;
    const startDate = new Date(data.dateStart);
    const endDate = new Date(data.dateEnd);
    const diffInTime = endDate.getTime() - startDate.getTime();
    const diffInDays = Math.ceil(diffInTime / (1000 * 3600 * 24)) + 1;
    return diffInDays <= limits.maxTripDays;
  }, {
    message: `Trip duration cannot exceed ${limits.maxTripDays} days`,
    path: ["dateEnd"],
  });
}

export const tripFormSchema = createTripFormSchema("free");
export const updateTripFormSchema = createUpdateTripFormSchema("free");

export type TripFormData = z.infer<typeof tripFormSchema>;
export type UpdateTripFormData = z.infer<typeof updateTripFormSchema>;
