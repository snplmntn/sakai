import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractMmdaAlertMessages,
  parseMmdaAlertMessage,
  refreshMmdaAlerts
} from "../src/services/mmda-alert.service.js";

describe("MMDA alert service", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.AUTH_APP_REDIRECT_URI = "sakai://auth/callback";
    process.env.AUTH_STATE_SIGNING_SECRET = "12345678901234567890123456789012";
    process.env.AI_PROVIDER = "vertex_express";
    delete process.env.VERTEX_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts MMDA alerts from mixed page content", () => {
    const content = `
      <html>
        <body>
          Tweets by @MMDA
          MMDA ALERT: Stalled truck due to mechanical trouble at Ortigas Avenue before EDSA intersection WB as of 5:53 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda
          MMDA ALERT: Road crash incident at Roxas Blvd EDSA after flyover SB involving 2 motorcycles as of 5:29 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda
        </body>
      </html>
    `;

    expect(extractMmdaAlertMessages(content)).toEqual([
      "MMDA ALERT: Stalled truck due to mechanical trouble at Ortigas Avenue before EDSA intersection WB as of 5:53 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
      "MMDA ALERT: Road crash incident at Roxas Blvd EDSA after flyover SB involving 2 motorcycles as of 5:29 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda"
    ]);
  });

  it("parses a road crash alert into structured fields", () => {
    const alert = parseMmdaAlertMessage(
      "MMDA ALERT: Road crash incident at C5 Green meadows before intersection SB involving wing van and AUV as of 5:00 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
      "https://x.com/MMDA",
      new Date("2026-03-19T10:05:00.000Z")
    );

    expect(alert).toMatchObject({
      source: "mmda",
      sourceUrl: "https://x.com/MMDA",
      alertType: "Road crash incident",
      location: "C5 Green meadows before intersection",
      direction: "SB",
      involved: "wing van and AUV",
      reportedTimeText: "5:00 PM",
      laneStatus: "One lane occupied",
      trafficStatus: "MMDA enforcers are on site managing traffic",
      scrapedAt: "2026-03-19T10:05:00.000Z"
    });
  });

  it("adds fallback severity and expiry when AI is unavailable", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        "MMDA ALERT: Road crash incident at C5 Green meadows before intersection SB involving wing van and AUV as of 5:00 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
        {
          status: 200
        }
      );

    const alerts = await refreshMmdaAlerts({
      sourceUrls: ["https://example.com/success"],
      fetchImpl,
      now: new Date("2026-03-19T10:05:00.000Z")
    });

    expect(alerts[0]).toMatchObject({
      severity: "medium",
      corridorTags: ["c5"],
      normalizedLocation: "c5 green meadows before intersection",
      displayUntil: "2026-03-19T13:05:00.000Z"
    });
  });

  it("collects unique alerts from all successful sources", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.includes("success")) {
        return new Response(
          "MMDA ALERT: Stalled truck due to mechanical trouble at Ortigas Avenue before EDSA intersection WB as of 5:53 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
          {
            status: 200
          }
        );
      }

      return new Response("unavailable", {
        status: 503
      });
    };

    const alerts = await refreshMmdaAlerts({
      sourceUrls: ["https://example.com/success", "https://example.com/fail"],
      fetchImpl,
      now: new Date("2026-03-19T10:05:00.000Z")
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      location: "Ortigas Avenue before EDSA intersection",
      direction: "WB"
    });
  });

  it("continues refreshing when one source throws a network error", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.includes("throw")) {
        throw new Error("network failure");
      }

      return new Response(
        "MMDA ALERT: Road crash incident at Roxas Blvd EDSA after flyover SB involving 2 motorcycles as of 5:29 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
        {
          status: 200
        }
      );
    };

    const alerts = await refreshMmdaAlerts({
      sourceUrls: ["https://example.com/throw", "https://example.com/success"],
      fetchImpl,
      now: new Date("2026-03-19T10:05:00.000Z")
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      location: "Roxas Blvd EDSA after flyover",
      direction: "SB"
    });
  });
});
