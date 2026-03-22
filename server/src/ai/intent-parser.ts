import { generateJson, getPrimaryModel } from "./client.js";
import {
  routeIntentResponseSchema,
  routeIntentSchema,
  type RouteIntent
} from "./types.js";

const buildIntentPrompt = (queryText: string) => `You are extracting commute-search intent for Sakai, a Philippines commute assistant.

Return JSON only.

Rules:
- Extract only originText, destinationText, preference, passengerType, modifiers, requiresClarification, clarificationField, confidence.
- Extract commuteModes and allowCarAccess too.
- Do not invent route names, stops, prices, or extra fields.
- preference may only be fastest, cheapest, balanced, or null.
- passengerType may only be regular, student, senior, pwd, or null.
- modifiers may only contain jeep_if_possible and less_walking.
- commuteModes may only contain jeepney, train, uv, bus, and tricycle, or be null.
- allowCarAccess may only be true, false, or null.
- Map phrasing like "jeep if possible", "jeepney if possible", or "more jeep" to jeep_if_possible.
- Map phrasing like "less walking", "shorter walk", or "avoid walking too much" to less_walking.
- Map train phrasing to commuteModes including train.
- Map UV phrasing to commuteModes including uv.
- Map bus phrasing to commuteModes including bus.
- Map tricycle phrasing to commuteModes including tricycle.
- Map jeep-only style phrasing to commuteModes ["jeepney"].
- Map "avoid bus" style phrasing to the preferred set that excludes bus.
- Map "avoid train" or "no train" style phrasing to the preferred set that excludes train.
- Map "with car", "car access", or "park and ride" to allowCarAccess true.
- Map "no car", "avoid car", or "walk only to stops" to allowCarAccess false.
- Ignore assistant-calling filler like "hey sakai", "sakai", "hello sakai", or "uy sakai".
- Return an empty modifiers array when no modifier is clearly stated.
- Return commuteModes as null when no ride-mode preference is clearly stated.
- Return allowCarAccess as null when car access is not clearly stated.
- If the query does not clearly identify an origin, destination, or both, set requiresClarification to true.
- If no clarification is needed, clarificationField must be null.

User query:
${queryText}`;

export const parseRouteIntent = async (queryText: string): Promise<RouteIntent> =>
  generateJson({
    model: getPrimaryModel(),
    prompt: buildIntentPrompt(queryText),
    outputSchema: routeIntentSchema,
    responseSchema: routeIntentResponseSchema
  });
