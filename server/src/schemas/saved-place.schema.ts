import { z } from "zod";

export const savedPlaceLabelPresetSchema = z.enum(["home", "office", "school"]);
export const savedPlaceLabelKindSchema = z.enum(["preset", "custom"]);

const baseSavedPlaceSchema = z.object({
  address: z.string().trim().min(1),
  labelKind: savedPlaceLabelKindSchema,
  presetLabel: savedPlaceLabelPresetSchema.optional(),
  customLabel: z.string().trim().min(1).optional()
});

export const upsertSavedPlaceSchema = baseSavedPlaceSchema.superRefine((value, ctx) => {
  if (value.labelKind === "preset") {
    if (!value.presetLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["presetLabel"],
        message: "presetLabel is required when labelKind is preset"
      });
    }

    if (value.customLabel !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customLabel"],
        message: "customLabel must be omitted when labelKind is preset"
      });
    }

    return;
  }

  if (!value.customLabel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customLabel"],
      message: "customLabel is required when labelKind is custom"
    });
  }

  if (value.presetLabel !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presetLabel"],
      message: "presetLabel must be omitted when labelKind is custom"
    });
  }
});

export const savedPlaceParamsSchema = z.object({
  savedPlaceId: z.uuid()
});
