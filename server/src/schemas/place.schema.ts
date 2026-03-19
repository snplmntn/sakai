import { z } from "zod";

export const placeSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(160),
    limit: z.coerce.number().int().min(1).max(20).optional()
  })
  .strict();
