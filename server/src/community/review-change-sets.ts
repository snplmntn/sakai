import { z } from "zod";

import type { CommunityProposalType } from "./constants.js";

const routeModeValues = ["jeepney", "uv", "mrt3", "lrt1", "lrt2", "bus", "car"] as const;
const fareModeValues = ["jeepney", "uv", "mrt3", "lrt1", "lrt2", "bus"] as const;
const fareTrustLevelValues = ["official", "estimated", "partially_estimated"] as const;

const normalizeOptionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

const optionalText = normalizeOptionalString(z.string().trim().max(200));
const optionalLongText = normalizeOptionalString(z.string().trim().max(400));
const optionalUrl = normalizeOptionalString(z.string().trim().url().max(400));
const optionalUuidString = normalizeOptionalString(z.string().uuid());
const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}, z.number().finite().optional());
const optionalInteger = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}, z.number().int().finite().optional());
const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}, z.boolean().optional());

export const communityRouteRecordSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    displayName: optionalText,
    primaryMode: z.enum(routeModeValues).optional(),
    operatorName: optionalText,
    sourceName: optionalText,
    sourceUrl: optionalUrl
  })
  .strict();

export const communityRouteUpdateRecordSchema = z
  .object({
    displayName: optionalText,
    operatorName: optionalText,
    sourceName: optionalText,
    sourceUrl: optionalUrl
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.displayName && !value.operatorName && !value.sourceName && !value.sourceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Route update needs at least one route field."
      });
    }
  });

export const communityRouteVariantRecordSchema = z
  .object({
    code: z.string().trim().min(1).max(120),
    displayName: optionalText,
    directionLabel: optionalText,
    originPlaceId: optionalUuidString,
    destinationPlaceId: optionalUuidString
  })
  .strict();

export const communityRouteLegSchema = z
  .object({
    sequence: z.number().int().min(0),
    mode: z.enum(routeModeValues),
    fromStopId: z.string().uuid(),
    toStopId: z.string().uuid(),
    routeLabel: optionalText,
    distanceKm: z.number().min(0),
    durationMinutes: z.number().int().min(0),
    fareProductCode: optionalText,
    corridorTag: optionalText
  })
  .strict();

export const communityRouteCreateChangeSetSchema = z
  .object({
    route: communityRouteRecordSchema,
    variant: communityRouteVariantRecordSchema,
    legs: z.array(communityRouteLegSchema).min(1)
  })
  .strict();

export const communityRouteUpdateChangeSetSchema = z
  .object({
    route: communityRouteUpdateRecordSchema.optional(),
    variant: communityRouteVariantRecordSchema,
    legs: z.array(communityRouteLegSchema).min(1)
  })
  .strict();

export const communityStopCorrectionChangeSetSchema = z
  .object({
    stopId: optionalUuidString,
    stopName: optionalText,
    externalStopCode: optionalText,
    area: optionalText,
    latitude: optionalNumber,
    longitude: optionalNumber,
    placeId: optionalUuidString,
    isActive: optionalBoolean
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !value.stopName &&
      !value.externalStopCode &&
      !value.area &&
      value.latitude === undefined &&
      value.longitude === undefined &&
      !value.placeId &&
      value.isActive === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stop correction needs at least one stop field to change."
      });
    }
  });

export const communityTransferCorrectionChangeSetSchema = z
  .object({
    transferPointId: optionalUuidString,
    fromStopId: optionalUuidString,
    toStopId: optionalUuidString,
    walkingDistanceM: optionalInteger,
    walkingDurationMinutes: optionalInteger,
    isAccessible: optionalBoolean
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.transferPointId && !(value.fromStopId && value.toStopId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transfer correction needs a transfer point or both stop IDs."
      });
    }

    if (
      value.walkingDistanceM === undefined &&
      value.walkingDurationMinutes === undefined &&
      value.isAccessible === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transfer correction needs at least one transfer field to change."
      });
    }
  });

export const communityFareRuleVersionChangeSetSchema = z
  .object({
    mode: z.enum(fareModeValues),
    versionName: optionalText,
    sourceName: optionalText,
    sourceUrl: optionalUrl,
    effectivityDate: normalizeOptionalString(z.string().date()),
    verifiedAt: normalizeOptionalString(z.string().datetime({ offset: true })),
    trustLevel: z.enum(fareTrustLevelValues).optional()
  })
  .strict();

export const communityFareProductChangeSetSchema = z
  .object({
    productCode: z.string().trim().min(1).max(120),
    mode: z.enum(fareModeValues).optional(),
    pricingStrategy: z.string().trim().min(1).max(120),
    vehicleClass: z.string().trim().min(1).max(120),
    minimumDistanceKm: z.number().min(0),
    minimumFareRegular: z.number().min(0),
    minimumFareDiscounted: optionalNumber,
    succeedingDistanceKm: z.number().min(0),
    succeedingFareRegular: z.number().min(0),
    succeedingFareDiscounted: optionalNumber,
    notes: optionalLongText
  })
  .strict();

export const communityTrainStationFareChangeSetSchema = z
  .object({
    originStopId: z.string().uuid(),
    destinationStopId: z.string().uuid(),
    regularFare: z.number().min(0),
    discountedFare: z.number().min(0)
  })
  .strict();

export const communityFareUpdateChangeSetSchema = z
  .object({
    ruleVersion: communityFareRuleVersionChangeSetSchema,
    activateVersion: z.boolean().optional(),
    fareProducts: z.array(communityFareProductChangeSetSchema).optional(),
    trainStationFares: z.array(communityTrainStationFareChangeSetSchema).optional()
  })
  .strict();

export const communityEmptyReviewedChangeSetSchema = z.object({}).strict();

export const reviewedChangeSetSchemaByProposalType = {
  route_create: communityRouteCreateChangeSetSchema,
  route_update: communityRouteUpdateChangeSetSchema,
  route_deprecate: communityEmptyReviewedChangeSetSchema,
  route_reactivate: communityEmptyReviewedChangeSetSchema,
  stop_correction: communityStopCorrectionChangeSetSchema,
  transfer_correction: communityTransferCorrectionChangeSetSchema,
  fare_update: communityFareUpdateChangeSetSchema,
  route_note: communityEmptyReviewedChangeSetSchema
} as const satisfies Record<CommunityProposalType, z.ZodTypeAny>;

export const reviewedChangeSetUnionSchema = z.union([
  communityRouteCreateChangeSetSchema,
  communityRouteUpdateChangeSetSchema,
  communityStopCorrectionChangeSetSchema,
  communityTransferCorrectionChangeSetSchema,
  communityFareUpdateChangeSetSchema,
  communityEmptyReviewedChangeSetSchema
]);

export type CommunityRouteRecord = z.infer<typeof communityRouteRecordSchema>;
export type CommunityRouteUpdateRecord = z.infer<typeof communityRouteUpdateRecordSchema>;
export type CommunityRouteVariantRecord = z.infer<typeof communityRouteVariantRecordSchema>;
export type CommunityRouteLeg = z.infer<typeof communityRouteLegSchema>;
export type CommunityRouteCreateChangeSet = z.infer<typeof communityRouteCreateChangeSetSchema>;
export type CommunityRouteUpdateChangeSet = z.infer<typeof communityRouteUpdateChangeSetSchema>;
export type CommunityStopCorrectionChangeSet = z.infer<typeof communityStopCorrectionChangeSetSchema>;
export type CommunityTransferCorrectionChangeSet = z.infer<
  typeof communityTransferCorrectionChangeSetSchema
>;
export type CommunityFareRuleVersionChangeSet = z.infer<
  typeof communityFareRuleVersionChangeSetSchema
>;
export type CommunityFareProductChangeSet = z.infer<typeof communityFareProductChangeSetSchema>;
export type CommunityTrainStationFareChangeSet = z.infer<
  typeof communityTrainStationFareChangeSetSchema
>;
export type CommunityFareUpdateChangeSet = z.infer<typeof communityFareUpdateChangeSetSchema>;
export type CommunityReviewedChangeSet =
  | CommunityRouteCreateChangeSet
  | CommunityRouteUpdateChangeSet
  | CommunityStopCorrectionChangeSet
  | CommunityTransferCorrectionChangeSet
  | CommunityFareUpdateChangeSet
  | Record<string, never>;

export const parseReviewedChangeSetForProposalType = (
  proposalType: CommunityProposalType,
  reviewedChangeSet: unknown
) => reviewedChangeSetSchemaByProposalType[proposalType].parse(reviewedChangeSet ?? {});
