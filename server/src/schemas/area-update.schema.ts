import { z } from "zod";

export const areaUpdatesQuerySchema = z.object({
  area: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

export const refreshAreaUpdatesSchema = z.object({
  sourceUrls: z.array(z.string().url()).min(1).max(5).optional()
}).default({});

export const relevantAreaUpdatesSchema = z.object({
  corridorTags: z.array(z.string().trim().min(1).max(120)).default([]),
  originLabel: z.string().trim().min(1).max(160),
  destinationLabel: z.string().trim().min(1).max(160),
  limit: z.coerce.number().int().min(1).max(10).optional()
});
