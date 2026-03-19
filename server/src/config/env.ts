import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AUTH_GOOGLE_REDIRECT_URI: z.string().url().optional(),
  AUTH_APP_REDIRECT_URI: z.string().url(),
  AUTH_STATE_SIGNING_SECRET: z.string().min(32),
  AI_PROVIDER: z.enum(["gemini_developer", "vertex_express"]).default("vertex_express"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  VERTEX_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL_PRIMARY: z.string().min(1).optional(),
  GEMINI_MODEL_LIGHT: z.string().min(1).optional(),
  MMDA_SOURCE_URLS: z.string().min(1).optional()
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export const getEnv = (): Env => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsedEnv = envSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  cachedEnv = parsedEnv.data;
  return cachedEnv;
};
