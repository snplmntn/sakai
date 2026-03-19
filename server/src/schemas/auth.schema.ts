import { z } from "zod";

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(8).max(72);

export const emailPasswordAuthSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().trim().min(1)
});

export const googleStartQuerySchema = z.object({
  appRedirectUri: z.string().trim().url().optional()
});

export const googleCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  error_description: z.string().trim().min(1).optional()
});
