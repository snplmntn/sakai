import { z } from "zod";

export const createCourseSchema = z.object({
  code: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional()
});

export const courseIdParamsSchema = z.object({
  id: z.string().uuid()
});
