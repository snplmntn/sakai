import { z } from "zod";

export const speechTranscriptionSchema = z
  .object({
    audioBase64: z.string().trim().min(1).max(28_000_000),
    mimeType: z.string().trim().min(1).max(120)
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.mimeType.startsWith("audio/")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mimeType"],
        message: "mimeType must be an audio MIME type"
      });
    }
  });

