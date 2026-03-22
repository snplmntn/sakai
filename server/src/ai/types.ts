import { z } from "zod";

import type { RoutePreference } from "../models/user-preference.model.js";
import type { PassengerType } from "../types/fare.js";
import type { CommuteMode, RouteModifier } from "../types/route-query.js";

const routePreferenceValues = ["fastest", "cheapest", "balanced"] as const satisfies RoutePreference[];
const passengerTypeValues = ["regular", "student", "senior", "pwd"] as const satisfies PassengerType[];
const routeModifierValues = ["jeep_if_possible", "less_walking"] as const satisfies RouteModifier[];
const commuteModeValues = ["jeepney", "train", "uv", "bus", "tricycle"] as const satisfies CommuteMode[];
const incidentSeverityValues = ["low", "medium", "high"] as const;
const communityProposalTypeValues = [
  "route_create",
  "route_update",
  "route_deprecate",
  "route_reactivate",
  "stop_correction",
  "transfer_correction",
  "fare_update",
  "route_note"
] as const;
const communityAiConfidenceValues = ["high", "medium", "low"] as const;
const routeLifecycleValues = ["active", "deprecated", "superseded"] as const;

export const routeIntentSchema = z.object({
  originText: z.string().trim().min(1).max(160).nullable(),
  destinationText: z.string().trim().min(1).max(160).nullable(),
  preference: z.enum(routePreferenceValues).nullable(),
  passengerType: z.enum(passengerTypeValues).nullable(),
  modifiers: z.array(z.enum(routeModifierValues)).max(routeModifierValues.length),
  commuteModes: z
    .array(z.enum(commuteModeValues))
    .min(1)
    .max(commuteModeValues.length)
    .nullable(),
  allowCarAccess: z.boolean().nullable(),
  requiresClarification: z.boolean(),
  clarificationField: z.enum(["origin", "destination", "both"]).nullable(),
  confidence: z.enum(["high", "medium", "low"])
});

export type RouteIntent = z.infer<typeof routeIntentSchema>;

export const routeSummarySchema = z.object({
  summary: z.string().trim().min(1).max(240)
});

export type RouteSummaryResult = z.infer<typeof routeSummarySchema>;

export const mmdaAlertExtractionSchema = z.object({
  alertType: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(200),
  direction: z.enum(["NB", "SB", "EB", "WB"]).nullable(),
  involved: z.string().trim().min(1).max(160).nullable(),
  reportedTimeText: z.string().trim().min(1).max(40).nullable(),
  laneStatus: z.string().trim().min(1).max(160).nullable(),
  trafficStatus: z.string().trim().min(1).max(240).nullable(),
  severity: z.enum(incidentSeverityValues),
  summary: z.string().trim().min(1).max(240),
  corridorTags: z.array(z.string().trim().min(1).max(60)).max(8),
  normalizedLocation: z.string().trim().min(1).max(200)
});

export type MmdaAlertExtraction = z.infer<typeof mmdaAlertExtractionSchema>;

export const communityReviewAiDraftSchema = z.object({
  confidence: z.enum(communityAiConfidenceValues),
  suggestedProposalType: z.enum(communityProposalTypeValues),
  reason: z.string().trim().min(1).max(320),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(600).nullable(),
  changeSummary: z.string().trim().min(1).max(240),
  reviewNotes: z.string().trim().min(1).max(1200),
  note: z.string().trim().min(1).max(1200).nullable(),
  routeCode: z.string().trim().min(1).max(80).nullable(),
  routeVariantCode: z.string().trim().min(1).max(120).nullable(),
  proposedLifecycleStatus: z.enum(routeLifecycleValues).nullable(),
  duplicateKey: z.string().trim().min(1).max(180).nullable(),
  reviewedChangeSetText: z.string().trim().min(2).max(4000)
});

export type CommunityReviewAiDraft = z.infer<typeof communityReviewAiDraftSchema>;

export const routeIntentResponseSchema = {
  type: "OBJECT",
  properties: {
    originText: {
      type: "STRING",
      nullable: true
    },
    destinationText: {
      type: "STRING",
      nullable: true
    },
    preference: {
      type: "STRING",
      enum: routePreferenceValues,
      nullable: true
    },
    passengerType: {
      type: "STRING",
      enum: passengerTypeValues,
      nullable: true
    },
    modifiers: {
      type: "ARRAY",
      items: {
        type: "STRING",
        enum: routeModifierValues
      }
    },
    commuteModes: {
      type: "ARRAY",
      nullable: true,
      items: {
        type: "STRING",
        enum: commuteModeValues
      }
    },
    allowCarAccess: {
      type: "BOOLEAN",
      nullable: true
    },
    requiresClarification: {
      type: "BOOLEAN"
    },
    clarificationField: {
      type: "STRING",
      enum: ["origin", "destination", "both"],
      nullable: true
    },
    confidence: {
      type: "STRING",
      enum: ["high", "medium", "low"]
    }
  },
  required: [
    "originText",
    "destinationText",
    "preference",
    "passengerType",
    "modifiers",
    "commuteModes",
    "allowCarAccess",
    "requiresClarification",
    "clarificationField",
    "confidence"
  ]
} as const;

export const routeSummaryResponseSchema = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING"
    }
  },
  required: ["summary"]
} as const;

export const mmdaAlertExtractionResponseSchema = {
  type: "OBJECT",
  properties: {
    alertType: {
      type: "STRING"
    },
    location: {
      type: "STRING"
    },
    direction: {
      type: "STRING",
      enum: ["NB", "SB", "EB", "WB"],
      nullable: true
    },
    involved: {
      type: "STRING",
      nullable: true
    },
    reportedTimeText: {
      type: "STRING",
      nullable: true
    },
    laneStatus: {
      type: "STRING",
      nullable: true
    },
    trafficStatus: {
      type: "STRING",
      nullable: true
    },
    severity: {
      type: "STRING",
      enum: incidentSeverityValues
    },
    summary: {
      type: "STRING"
    },
    corridorTags: {
      type: "ARRAY",
      items: {
        type: "STRING"
      }
    },
    normalizedLocation: {
      type: "STRING"
    }
  },
  required: [
    "alertType",
    "location",
    "direction",
    "involved",
    "reportedTimeText",
    "laneStatus",
    "trafficStatus",
    "severity",
    "summary",
    "corridorTags",
    "normalizedLocation"
  ]
} as const;

export const communityReviewAiDraftResponseSchema = {
  type: "OBJECT",
  properties: {
    confidence: {
      type: "STRING",
      enum: communityAiConfidenceValues
    },
    suggestedProposalType: {
      type: "STRING",
      enum: communityProposalTypeValues
    },
    reason: {
      type: "STRING"
    },
    title: {
      type: "STRING"
    },
    summary: {
      type: "STRING",
      nullable: true
    },
    changeSummary: {
      type: "STRING"
    },
    reviewNotes: {
      type: "STRING"
    },
    note: {
      type: "STRING",
      nullable: true
    },
    routeCode: {
      type: "STRING",
      nullable: true
    },
    routeVariantCode: {
      type: "STRING",
      nullable: true
    },
    proposedLifecycleStatus: {
      type: "STRING",
      enum: routeLifecycleValues,
      nullable: true
    },
    duplicateKey: {
      type: "STRING",
      nullable: true
    },
    reviewedChangeSetText: {
      type: "STRING"
    }
  },
  required: [
    "confidence",
    "suggestedProposalType",
    "reason",
    "title",
    "summary",
    "changeSummary",
    "reviewNotes",
    "note",
    "routeCode",
    "routeVariantCode",
    "proposedLifecycleStatus",
    "duplicateKey",
    "reviewedChangeSetText"
  ]
} as const;
