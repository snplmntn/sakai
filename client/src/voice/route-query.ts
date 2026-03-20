const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/gu, ' ');

const ASSISTANT_PREFIX_PATTERN = /^(?:(?:hey|hi|hello|uy)\s+)?sakai[\s,.:!-]*/iu;
const DESTINATION_PREFIX_PATTERNS = [
  /^(?:how do i get to|how to go to|how can i get to|directions to|route to|go to|take me to|get me to)\s+/iu,
  /^(?:papunta sa|paano pumunta sa|dalhin mo ako sa|ihatid mo ako sa|ruta papuntang)\s+/iu,
] as const;
const EXPLICIT_ROUTE_PATTERN = /^from\s+.+?\s+to\s+(.+)$/iu;
const EXPLICIT_ROUTE_PATTERN_FILIPINO = /^mula\s+.+?\s+(?:papunta sa|hanggang)\s+(.+)$/iu;

export const normalizeVoiceRouteQuery = (value: string): string =>
  normalizeWhitespace(value).replace(ASSISTANT_PREFIX_PATTERN, '').trim();

export const extractVoiceDestinationHint = (value: string): string => {
  const normalized = DESTINATION_PREFIX_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, '').trim(),
    normalizeVoiceRouteQuery(value)
  );
  const explicitRouteMatch =
    normalized.match(EXPLICIT_ROUTE_PATTERN) ?? normalized.match(EXPLICIT_ROUTE_PATTERN_FILIPINO);

  if (explicitRouteMatch?.[1]) {
    return normalizeWhitespace(explicitRouteMatch[1]);
  }

  return normalizeWhitespace(normalized);
};
