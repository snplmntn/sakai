const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/gu, ' ');

const ASSISTANT_PREFIX_PATTERN = /^(?:(?:hey|hi|hello|uy)\s+)?sakai[\s,.:!-]*/iu;
const DESTINATION_PREFIX_PATTERN =
  /^(?:how do i get to|how to go to|how can i get to|directions to|route to|go to|take me to|get me to)\s+/iu;
const EXPLICIT_ROUTE_PATTERN = /^from\s+.+?\s+to\s+(.+)$/iu;

export const normalizeVoiceRouteQuery = (value: string): string =>
  normalizeWhitespace(value).replace(ASSISTANT_PREFIX_PATTERN, '').trim();

export const extractVoiceDestinationHint = (value: string): string => {
  const normalized = normalizeVoiceRouteQuery(value).replace(DESTINATION_PREFIX_PATTERN, '').trim();
  const explicitRouteMatch = normalized.match(EXPLICIT_ROUTE_PATTERN);

  if (explicitRouteMatch?.[1]) {
    return normalizeWhitespace(explicitRouteMatch[1]);
  }

  return normalizeWhitespace(normalized);
};

