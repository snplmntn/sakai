import {
  AiInvalidResponseError,
  AiUnavailableError,
  generateJson,
  getLightModel,
  isAiEnabled
} from "./client.js";
import {
  mmdaAlertExtractionResponseSchema,
  mmdaAlertExtractionSchema,
  type MmdaAlertExtraction
} from "./types.js";

const CORRIDOR_RULES: Array<{
  tag: string;
  patterns: RegExp[];
}> = [
  {
    tag: "edsa",
    patterns: [/\bedsa\b/i]
  },
  {
    tag: "c5",
    patterns: [/\bc5\b/i, /\bc-5\b/i]
  },
  {
    tag: "ortigas",
    patterns: [/\bortigas\b/i]
  },
  {
    tag: "roxas-blvd",
    patterns: [/\broxas\b/i]
  },
  {
    tag: "slex",
    patterns: [/\bslex\b/i]
  },
  {
    tag: "magallanes",
    patterns: [/\bmagallanes\b/i]
  },
  {
    tag: "pasay",
    patterns: [/\bpasay\b/i, /\brotonda\b/i]
  },
  {
    tag: "bicutan",
    patterns: [/\bbicutan\b/i]
  },
  {
    tag: "alabang",
    patterns: [/\balabang\b/i]
  },
  {
    tag: "gate-3",
    patterns: [/\bgate\s*3\b/i]
  },
  {
    tag: "aurora",
    patterns: [/\baurora\b/i]
  },
  {
    tag: "sta-mesa",
    patterns: [/\bsta\.?\s*mesa\b/i, /\bsanta\s*mesa\b/i]
  }
];

interface ParsedMmdaAlertInput {
  rawText: string;
  alertType: string;
  location: string;
  direction: string | null;
  involved: string | null;
  reportedTimeText: string | null;
  laneStatus: string | null;
  trafficStatus: string | null;
}

const normalizeLocationText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ");

export const extractCorridorTagsFromText = (...values: Array<string | null | undefined>) => {
  const text = values.filter(Boolean).join(" ");
  const tags = new Set<string>();

  for (const rule of CORRIDOR_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      tags.add(rule.tag);
    }
  }

  return [...tags];
};

export const deriveMmdaSeverity = (input: ParsedMmdaAlertInput): MmdaAlertExtraction["severity"] => {
  const text = [
    input.alertType,
    input.laneStatus,
    input.trafficStatus,
    input.involved,
    input.rawText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\bfatal\b|\bmultiple vehicle\b|\boverturned\b|\btruck\b|\btrailer\b|\bfire\b|\bflood\b/.test(
      text
    ) ||
    /\bthree lanes?\b|\ball lanes?\b|\broad closed\b|\bstandstill\b/.test(text)
  ) {
    return "high";
  }

  if (
    /\bone lane occupied\b|\btwo lanes occupied\b|\broad crash\b|\bcollision\b|\bstalled\b|\bdisabled\b/.test(
      text
    )
  ) {
    return "medium";
  }

  return "low";
};

const buildFallbackSummary = (input: ParsedMmdaAlertInput) => {
  const directionText = input.direction ? ` ${input.direction}` : "";
  const laneText = input.laneStatus ? ` ${input.laneStatus}.` : "";
  const trafficText = input.trafficStatus ? ` ${input.trafficStatus}.` : "";

  return `${input.alertType} near ${input.location}${directionText}.${laneText}${trafficText}`
    .replace(/\s+/g, " ")
    .replace(/\.\s+\./g, ".")
    .trim()
    .slice(0, 240);
};

export const buildFallbackMmdaAlertExtraction = (
  input: ParsedMmdaAlertInput
): MmdaAlertExtraction => ({
  alertType: input.alertType,
  location: input.location,
  direction:
    input.direction === "NB" ||
    input.direction === "SB" ||
    input.direction === "EB" ||
    input.direction === "WB"
      ? input.direction
      : null,
  involved: input.involved,
  reportedTimeText: input.reportedTimeText,
  laneStatus: input.laneStatus,
  trafficStatus: input.trafficStatus,
  severity: deriveMmdaSeverity(input),
  summary: buildFallbackSummary(input),
  corridorTags: extractCorridorTagsFromText(input.location, input.rawText),
  normalizedLocation: normalizeLocationText(input.location)
});

const buildMmdaAlertPrompt = (input: ParsedMmdaAlertInput) => `You are structuring MMDA traffic alerts for Sakai, a Metro Manila commute assistant.

Return JSON only.

Rules:
- Use only facts from the raw alert text and deterministic hint fields below.
- Keep the same incident meaning. Do not invent roads, vehicles, lane counts, or timelines.
- severity must be one of: low, medium, high.
- summary must be short, rider-facing, factual, and under 240 characters.
- corridorTags must be a short array of normalized corridor/location tags like edsa, c5, ortigas, roxas-blvd, sta-mesa, alabang, pasay.
- normalizedLocation must be a concise lowercase searchable location string.
- direction must be NB, SB, EB, WB, or null.

Raw MMDA alert:
${input.rawText}

Deterministic hint fields:
${JSON.stringify(
  {
    alertType: input.alertType,
    location: input.location,
    direction: input.direction,
    involved: input.involved,
    reportedTimeText: input.reportedTimeText,
    laneStatus: input.laneStatus,
    trafficStatus: input.trafficStatus
  },
  null,
  2
)}`;

const isRecoverableMmdaError = (
  error: unknown
): error is AiUnavailableError | AiInvalidResponseError =>
  error instanceof Error &&
  (error.name === "AiUnavailableError" || error.name === "AiInvalidResponseError");

export const computeDisplayUntil = (
  severity: MmdaAlertExtraction["severity"],
  scrapedAtIso: string
) => {
  const displayUntil = new Date(scrapedAtIso);
  const hours =
    severity === "high" ? 5 : severity === "medium" ? 3 : 1;

  displayUntil.setHours(displayUntil.getHours() + hours);
  return displayUntil.toISOString();
};

export const extractMmdaAlertWithAi = async (
  input: ParsedMmdaAlertInput
): Promise<MmdaAlertExtraction> => {
  const fallback = buildFallbackMmdaAlertExtraction(input);

  if (!isAiEnabled()) {
    return fallback;
  }

  try {
    const result = await generateJson({
      model: getLightModel(),
      prompt: buildMmdaAlertPrompt(input),
      outputSchema: mmdaAlertExtractionSchema,
      responseSchema: mmdaAlertExtractionResponseSchema,
      temperature: 0.1
    });

    return {
      ...result,
      direction:
        result.direction === "NB" ||
        result.direction === "SB" ||
        result.direction === "EB" ||
        result.direction === "WB"
          ? result.direction
          : fallback.direction,
      corridorTags: result.corridorTags.length > 0 ? result.corridorTags : fallback.corridorTags,
      normalizedLocation: result.normalizedLocation || fallback.normalizedLocation
    };
  } catch (error) {
    if (isRecoverableMmdaError(error)) {
      console.warn("Falling back to deterministic MMDA extraction", {
        operation: "mmda_alert_extraction",
        model: getLightModel(),
        reason: error.message
      });
      return fallback;
    }

    throw error;
  }
};
