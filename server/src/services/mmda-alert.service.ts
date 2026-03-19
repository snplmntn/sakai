import { createHash } from "node:crypto";

import { getEnv } from "../config/env.js";

const DEFAULT_MMDA_SOURCE_URLS = [
  "https://x.com/MMDA",
  "https://mmda.gov.ph/mmda-social-media.html"
];

export interface ScrapedMmdaAlert {
  externalId: string;
  source: string;
  sourceUrl: string;
  alertType: string;
  location: string;
  direction: string | null;
  involved: string | null;
  reportedTimeText: string | null;
  laneStatus: string | null;
  trafficStatus: string | null;
  rawText: string;
  scrapedAt: string;
}

export interface RefreshMmdaAlertsOptions {
  sourceUrls?: string[];
  fetchImpl?: typeof fetch;
  now?: Date;
}

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const normalizeContent = (content: string): string =>
  decodeEntities(content)
    .replace(/\\u002F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003C/gi, "<")
    .replace(/\\u003E/gi, ">")
    .replace(/\\n/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractMmdaAlertMessages = (content: string): string[] => {
  const normalized = normalizeContent(content);
  const matches = normalized.match(/MMDA ALERT:\s*[\s\S]*?#mmda/gi) ?? [];
  const uniqueMessages = new Set<string>();

  for (const match of matches) {
    uniqueMessages.add(match.replace(/\s+/g, " ").trim());
  }

  return [...uniqueMessages];
};

export const parseMmdaAlertMessage = (
  rawMessage: string,
  sourceUrl: string,
  now = new Date()
): ScrapedMmdaAlert => {
  const rawText = rawMessage.replace(/\s+/g, " ").trim();
  const withoutHashtag = rawText.replace(/\s+#mmda\b/gi, "").trim();
  const alertBody = withoutHashtag.replace(/^MMDA ALERT:\s*/i, "").trim();
  const sentences = alertBody
    .split(".")
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const headline = sentences[0] ?? alertBody;
  const laneStatus = sentences[1] ?? null;
  const trafficStatus = sentences.length > 2 ? sentences.slice(2).join(". ") : null;
  const reportedTimeMatch = headline.match(/\bas of\s+([0-9]{1,2}:[0-9]{2}\s*[AP]M)\b/i);
  const reportedTimeText = reportedTimeMatch?.[1]?.toUpperCase() ?? null;
  const headlineWithoutTime = reportedTimeMatch
    ? headline.slice(0, reportedTimeMatch.index).trim()
    : headline;

  const [headlineBeforeInvolved, involvedSegment] = headlineWithoutTime.split(/\binvolving\b/i);
  const involved = involvedSegment?.trim() ?? null;
  const atIndex = headlineBeforeInvolved.toLowerCase().indexOf(" at ");

  let alertType = headlineBeforeInvolved.trim();
  let location = headlineBeforeInvolved.trim();
  let direction: string | null = null;

  if (atIndex !== -1) {
    alertType = headlineBeforeInvolved.slice(0, atIndex).trim();
    location = headlineBeforeInvolved.slice(atIndex + 4).trim();
  }

  const directionMatch = location.match(/^(.*?)(?:\s+)(NB|SB|EB|WB)$/i);
  if (directionMatch) {
    location = directionMatch[1].trim();
    direction = directionMatch[2].toUpperCase();
  }

  return {
    externalId: createHash("sha256").update(rawText).digest("hex"),
    source: "mmda",
    sourceUrl,
    alertType,
    location,
    direction,
    involved,
    reportedTimeText,
    laneStatus,
    trafficStatus,
    rawText,
    scrapedAt: now.toISOString()
  };
};

const getMmdaSourceUrls = (): string[] => {
  const configuredUrls = getEnv().MMDA_SOURCE_URLS?.split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return configuredUrls && configuredUrls.length > 0
    ? configuredUrls
    : DEFAULT_MMDA_SOURCE_URLS;
};

export const refreshMmdaAlerts = async (
  options: RefreshMmdaAlertsOptions = {}
): Promise<ScrapedMmdaAlert[]> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const sourceUrls = options.sourceUrls?.length ? options.sourceUrls : getMmdaSourceUrls();
  const alerts = new Map<string, ScrapedMmdaAlert>();

  for (const sourceUrl of sourceUrls) {
    let response: Response;

    try {
      response = await fetchImpl(sourceUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; Sakai MMDA scraper/1.0)",
          "accept-language": "en-US,en;q=0.9"
        }
      });
    } catch (error) {
      console.warn("Failed to fetch MMDA source", {
        sourceUrl,
        reason: error instanceof Error ? error.message : "unknown fetch error"
      });
      continue;
    }

    if (!response.ok) {
      console.warn("MMDA source returned a non-success status", {
        sourceUrl,
        status: response.status
      });
      continue;
    }

    const content = await response.text();
    const messages = extractMmdaAlertMessages(content);

    for (const message of messages) {
      const parsedAlert = parseMmdaAlertMessage(message, sourceUrl, now);
      alerts.set(parsedAlert.externalId, parsedAlert);
    }
  }

  return [...alerts.values()];
};
