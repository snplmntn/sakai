import { z } from "zod";

import type { RoutePreference } from "../models/user-preference.model.js";
import type { PassengerType } from "../types/fare.js";

const routePreferenceValues = ["fastest", "cheapest", "balanced"] as const satisfies RoutePreference[];
const passengerTypeValues = ["regular", "student", "senior", "pwd"] as const satisfies PassengerType[];
const incidentSeverityValues = ["low", "medium", "high"] as const;

export const routeIntentSchema = z.object({
  originText: z.string().trim().min(1).max(160).nullable(),
  destinationText: z.string().trim().min(1).max(160).nullable(),
  preference: z.enum(routePreferenceValues).nullable(),
  passengerType: z.enum(passengerTypeValues).nullable(),
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
