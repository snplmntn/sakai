import { z } from "zod";

export const createCommunityQuestionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(1200),
  originLabel: z.string().trim().min(1).max(160),
  destinationLabel: z.string().trim().min(1).max(160),
  originPlaceId: z.string().uuid().optional(),
  destinationPlaceId: z.string().uuid().optional(),
  routeQueryText: z.string().trim().min(1).max(240).optional(),
  preference: z.enum(["fastest", "cheapest", "balanced"]).optional(),
  passengerType: z.enum(["regular", "student", "senior", "pwd"]).optional(),
  sourceContext: z.record(z.string(), z.unknown()).optional()
});

export const createCommunityAnswerSchema = z.object({
  body: z.string().trim().min(1).max(1200)
});

export type CreateCommunityQuestionInput = z.infer<typeof createCommunityQuestionSchema>;
export type CreateCommunityAnswerInput = z.infer<typeof createCommunityAnswerSchema>;
