import { z } from "zod";

export const routePreferenceSchema = z.enum(["fastest", "cheapest", "balanced"]);
export const passengerTypeSchema = z.enum(["regular", "student", "senior", "pwd"]);

export const upsertUserPreferenceSchema = z.object({
  defaultPreference: routePreferenceSchema,
  passengerType: passengerTypeSchema
});
