import { z } from "zod";

const routeQueryPointSchema = z
  .object({
    placeId: z.string().uuid().optional(),
    label: z.string().trim().min(1).max(160).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.placeId && !value.label) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either placeId or label is required"
      });
    }

    const hasLatitude = typeof value.latitude === "number";
    const hasLongitude = typeof value.longitude === "number";

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latitude and longitude must be provided together"
      });
    }
  });

export const routeQuerySchema = z
  .object({
    origin: routeQueryPointSchema.optional(),
    destination: routeQueryPointSchema.optional(),
    queryText: z.string().trim().min(1).max(500).optional(),
    preference: z.enum(["fastest", "cheapest", "balanced"]).optional(),
    passengerType: z.enum(["regular", "student", "senior", "pwd"]).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.queryText) {
      if (!value.origin) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["origin"],
          message: "Origin is required when queryText is absent"
        });
      }

      if (!value.destination) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination"],
          message: "Destination is required when queryText is absent"
        });
      }
    }
  });
