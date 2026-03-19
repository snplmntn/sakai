import { createHash } from "node:crypto";

import {
  computeDisplayUntil,
  extractMmdaAlertWithAi
} from "../ai/mmda-alert.js";
import { getEnv } from "../config/env.js";
import * as areaUpdateModel from "../models/area-update.model.js";
import { fetchMmdaSourceWithBrowser } from "./mmda-browser-fetch.service.js";

const DEFAULT_MMDA_SOURCE_URLS = [
  "https://x.com/MMDA",
  "https://mmda.gov.ph/mmda-social-media.html"
];

const CHALLENGE_MARKERS = [
  "just a moment",
  "checking your browser",
  "verify you are human",
  "attention required",
  "cf-browser-verification",
  "challenge-platform",
  "captcha",
  "enable javascript and cookies"
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
  severity: "low" | "medium" | "high";
  summary: string;
  corridorTags: string[];
  normalizedLocation: string;
  displayUntil: string;
  rawText: string;
  scrapedAt: string;
}

export interface RefreshMmdaAlertsOptions {
  sourceUrls?: string[];
  fetchImpl?: typeof fetch;
  now?: Date;
}

export interface SyncMmdaAlertsOptions extends RefreshMmdaAlertsOptions {}

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

const looksLikeBotChallenge = (content: string) => {
  const normalized = content.toLowerCase();

  return CHALLENGE_MARKERS.some((marker) => normalized.includes(marker));
};

const isXSourceUrl = (sourceUrl: string) => {
  try {
    const { hostname } = new URL(sourceUrl);
    return hostname === "x.com" || hostname === "www.x.com" || hostname === "twitter.com";
  } catch {
    return sourceUrl.includes("x.com/MMDA");
  }
};

const extractMmdaAlertMessagesForSource = (
  sourceUrl: string,
  content: string,
  extractedText?: string
) => {
  if (isXSourceUrl(sourceUrl) && extractedText) {
    const xMessages = extractMmdaAlertMessages(extractedText);
    if (xMessages.length > 0) {
      return xMessages;
    }
  }

  return extractMmdaAlertMessages(content);
};

const isBrowserFallbackEnabled = () => getEnv().MMDA_BROWSER_FALLBACK_ENABLED;

interface FetchedMmdaSource {
  content: string;
  extractedText?: string;
  sourceMethod: "fetch" | "browser";
}

const fetchSourceContentViaHttp = async (
  sourceUrl: string,
  fetchImpl: typeof fetch
) => {
  const response = await fetchImpl(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; Sakai MMDA scraper/1.0)",
      "accept-language": "en-US,en;q=0.9"
    }
  });

  return {
    ok: response.ok,
    status: response.status,
    content: await response.text()
  };
};

const fetchSourceContentWithFallback = async (
  sourceUrl: string,
  fetchImpl: typeof fetch
): Promise<FetchedMmdaSource | null> => {
  try {
    const response = await fetchSourceContentViaHttp(sourceUrl, fetchImpl);
    const messages = extractMmdaAlertMessages(response.content);
    const challengeDetected = looksLikeBotChallenge(response.content);

    if (response.ok && !challengeDetected && messages.length > 0) {
      return {
        content: response.content,
        extractedText: undefined,
        sourceMethod: "fetch" as const
      };
    }

    console.warn("MMDA source requires browser fallback", {
      sourceUrl,
      status: response.status,
      challengeDetected,
      extractedAlerts: messages.length
    });
  } catch (error) {
    console.warn("Failed to fetch MMDA source over HTTP", {
      sourceUrl,
      reason: error instanceof Error ? error.message : "unknown fetch error"
    });
  }

  if (!isBrowserFallbackEnabled()) {
    return null;
  }

  try {
    const browserResponse = await fetchMmdaSourceWithBrowser(sourceUrl, {
      extractDomText: isXSourceUrl(sourceUrl)
    });
    const extractedText = browserResponse.extractedText;
    const messages = extractMmdaAlertMessagesForSource(
      sourceUrl,
      browserResponse.content,
      extractedText
    );
    const challengeDetected =
      looksLikeBotChallenge(browserResponse.content) ||
      (extractedText ? looksLikeBotChallenge(extractedText) : false);

    if (challengeDetected || messages.length === 0) {
      console.warn("Browser fallback did not yield usable MMDA content", {
        sourceUrl,
        finalUrl: browserResponse.finalUrl,
        challengeDetected,
        extractedAlerts: messages.length
      });
      return null;
    }

    return {
      content: browserResponse.content,
      extractedText,
      sourceMethod: "browser" as const
    };
  } catch (error) {
    console.warn("Browser fallback failed for MMDA source", {
      sourceUrl,
      reason: error instanceof Error ? error.message : "unknown browser error"
    });
    return null;
  }
};

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
): Omit<
  ScrapedMmdaAlert,
  "severity" | "summary" | "corridorTags" | "normalizedLocation" | "displayUntil"
> => {
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
    const fetchedSource = await fetchSourceContentWithFallback(sourceUrl, fetchImpl);

    if (!fetchedSource) {
      continue;
    }

    const messages = extractMmdaAlertMessagesForSource(
      sourceUrl,
      fetchedSource.content,
      fetchedSource.extractedText
    );

    console.info("MMDA source fetched successfully", {
      sourceUrl,
      sourceMethod: fetchedSource.sourceMethod,
      extractedAlerts: messages.length
    });

    for (const message of messages) {
      const parsedAlert = parseMmdaAlertMessage(message, sourceUrl, now);
      const aiExtraction = await extractMmdaAlertWithAi(parsedAlert);

      alerts.set(parsedAlert.externalId, {
        ...parsedAlert,
        ...aiExtraction,
        displayUntil: computeDisplayUntil(aiExtraction.severity, parsedAlert.scrapedAt)
      });
    }
  }

  return [...alerts.values()];
};

export const syncMmdaAlerts = async (
  options: SyncMmdaAlertsOptions = {}
) => {
  const scrapedAlerts = await refreshMmdaAlerts(options);

  if (scrapedAlerts.length === 0) {
    return {
      scrapedAlerts,
      savedAlerts: []
    };
  }

  try {
    const savedAlerts = await areaUpdateModel.upsertAreaUpdates(scrapedAlerts);

    return {
      scrapedAlerts,
      savedAlerts
    };
  } catch (error) {
    console.error("MMDA alerts were scraped but could not be saved", {
      operation: "mmda_upsert_area_updates",
      scrapedAlerts: scrapedAlerts.length,
      reason: error instanceof Error ? error.message : "unknown error",
      sources: [
        ...new Set(scrapedAlerts.map((alert) => alert.sourceUrl))
      ],
      suggestedFixSql: [
        "grant select, insert, update, delete on public.area_updates to service_role;",
        "grant insert, update, select on public.area_updates to authenticated;"
      ]
    });

    throw error;
  }
};
