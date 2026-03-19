import type {
  RouteQueryLeg,
  RouteQueryNormalizedInput,
  RouteQueryOption
} from "../types/route-query.js";
import {
  generateJson,
  getLightModel,
  isAiEnabled,
  type AiInvalidResponseError,
  type AiUnavailableError
} from "./client.js";
import {
  routeSummaryResponseSchema,
  routeSummarySchema
} from "./types.js";

const buildLegLine = (leg: RouteQueryLeg) =>
  leg.type === "walk"
    ? `Walk ${leg.durationMinutes} minutes from ${leg.fromLabel} to ${leg.toLabel}.`
    : leg.type === "drive"
      ? `Drive ${leg.durationMinutes} minutes from ${leg.fromLabel} to ${leg.toLabel}.`
    : `Ride ${leg.routeName} from ${leg.fromStop.stopName} to ${leg.toStop.stopName}.`;

export const buildTemplateRouteSummary = (option: RouteQueryOption): string =>
  option.legs.map(buildLegLine).join(" ");

const buildSummaryPrompt = (
  option: RouteQueryOption,
  normalizedQuery: RouteQueryNormalizedInput
) => `Write one short rider-facing route summary for Sakai.

Rules:
- Use only the provided route facts.
- Do not invent fare changes, delays, stops, or route names.
- Keep the summary under 240 characters.
- Mention transfers only if useful.
- Mention incidents only if they already exist in the route facts.
- Return JSON only with a single "summary" field.

Trip:
- Origin: ${normalizedQuery.origin.label}
- Destination: ${normalizedQuery.destination.label}
- Total duration minutes: ${option.totalDurationMinutes}
- Total fare: ${option.totalFare}
- Transfer count: ${option.transferCount}
- Fare confidence: ${option.fareConfidence}
- Legs:
${option.legs.map((leg) => `- ${buildLegLine(leg)}`).join("\n")}
- Relevant incidents:
${option.relevantIncidents.length > 0 ? JSON.stringify(option.relevantIncidents) : "- none"}`;

const isRecoverableSummaryError = (
  error: unknown
): error is AiUnavailableError | AiInvalidResponseError =>
  error instanceof Error &&
  (error.name === "AiUnavailableError" || error.name === "AiInvalidResponseError");

export const generateRouteSummary = async (input: {
  option: RouteQueryOption;
  normalizedQuery: RouteQueryNormalizedInput;
}): Promise<string> => {
  const fallbackSummary = buildTemplateRouteSummary(input.option);

  if (!isAiEnabled()) {
    return fallbackSummary;
  }

  try {
    const result = await generateJson({
      model: getLightModel(),
      prompt: buildSummaryPrompt(input.option, input.normalizedQuery),
      outputSchema: routeSummarySchema,
      responseSchema: routeSummaryResponseSchema,
      temperature: 0.2
    });

    return result.summary;
  } catch (error) {
    if (isRecoverableSummaryError(error)) {
      console.warn("Falling back to deterministic route summary", {
        operation: "route_summary",
        model: getLightModel(),
        reason: error.message
      });
      return fallbackSummary;
    }

    throw error;
  }
};
