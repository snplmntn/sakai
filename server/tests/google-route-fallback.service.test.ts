import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({
  getEnv: vi.fn()
}));

import { getEnv } from "../src/config/env.js";
import { queryGoogleFallbackRoutes } from "../src/services/google-route-fallback.service.js";

const mockedGetEnv = vi.mocked(getEnv);

describe("google route fallback service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unavailable when the server key is not configured", async () => {
    mockedGetEnv.mockReturnValue({
      NODE_ENV: "test",
      PORT: 3000,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      AUTH_APP_REDIRECT_URI: "sakai://auth/callback",
      AUTH_STATE_SIGNING_SECRET: "12345678901234567890123456789012",
      AI_PROVIDER: "vertex_express",
      MMDA_REFRESH_INTERVAL_MINUTES: 15,
      MMDA_REFRESH_ENABLED: false,
      MMDA_BROWSER_FALLBACK_ENABLED: false,
      MMDA_BROWSER_TIMEOUT_MS: 20_000,
      GOOGLE_MAPS_SERVER_API_KEY: undefined
    });

    const result = await queryGoogleFallbackRoutes({
      normalizedQuery: {
        origin: {
          placeId: "place-origin",
          label: "Cubao",
          matchedBy: "alias",
          latitude: 14.62,
          longitude: 121.05
        },
        destination: {
          placeId: "place-destination",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName",
          latitude: 14.6,
          longitude: 121.01
        },
        preference: "balanced",
        passengerType: "regular",
        preferenceSource: "default",
        passengerTypeSource: "default",
        modifiers: [],
        modifierSource: "default"
      },
      modifiers: [],
      passengerType: "regular"
    });

    expect(result).toEqual({
      status: "unavailable",
      options: [],
      message: "Google Maps fallback is unavailable right now."
    });
  });

  it("normalizes a Google transit response into fallback options", async () => {
    mockedGetEnv.mockReturnValue({
      NODE_ENV: "test",
      PORT: 3000,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      AUTH_APP_REDIRECT_URI: "sakai://auth/callback",
      AUTH_STATE_SIGNING_SECRET: "12345678901234567890123456789012",
      AI_PROVIDER: "vertex_express",
      MMDA_REFRESH_INTERVAL_MINUTES: 15,
      MMDA_REFRESH_ENABLED: false,
      MMDA_BROWSER_FALLBACK_ENABLED: false,
      MMDA_BROWSER_TIMEOUT_MS: 20_000,
      GOOGLE_MAPS_SERVER_API_KEY: "maps-key"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          routes: [
            {
              duration: "1800s",
              travelAdvisory: {
                transitFare: {
                  units: "24",
                  nanos: 0
                }
              },
              legs: [
                {
                  steps: [
                    {
                      travelMode: "WALK",
                      distanceMeters: 120,
                      staticDuration: "120s",
                      navigationInstruction: {
                        instructions: "Walk to Cubao station"
                      },
                      polyline: {
                        encodedPolyline: "??"
                      }
                    },
                    {
                      travelMode: "TRANSIT",
                      distanceMeters: 5200,
                      staticDuration: "1680s",
                      startLocation: {
                        latLng: {
                          latitude: 14.62,
                          longitude: 121.05
                        }
                      },
                      endLocation: {
                        latLng: {
                          latitude: 14.6,
                          longitude: 121.01
                        }
                      },
                      transitDetails: {
                        headsign: "Recto",
                        stopDetails: {
                          departureStop: {
                            name: {
                              text: "Cubao"
                            }
                          },
                          arrivalStop: {
                            name: {
                              text: "Pureza"
                            }
                          }
                        },
                        transitLine: {
                          nameShort: {
                            text: "LRT-2"
                          },
                          vehicle: {
                            type: "SUBWAY"
                          }
                        }
                      },
                      polyline: {
                        encodedPolyline: "??"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        })
      })
    );

    const result = await queryGoogleFallbackRoutes({
      normalizedQuery: {
        origin: {
          placeId: "place-origin",
          label: "Cubao",
          matchedBy: "alias",
          latitude: 14.62,
          longitude: 121.05
        },
        destination: {
          placeId: "place-destination",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName",
          latitude: 14.6,
          longitude: 121.01
        },
        preference: "balanced",
        passengerType: "regular",
        preferenceSource: "default",
        passengerTypeSource: "default",
        modifiers: [],
        modifierSource: "default"
      },
      modifiers: ["less_walking"],
      passengerType: "regular"
    });

    expect(result.status).toBe("available");
    expect(result.options).toHaveLength(1);
    expect(result.options[0]).toMatchObject({
      source: "google_fallback",
      providerLabel: "Google Maps fallback",
      totalFare: 24,
      fareConfidence: "estimated"
    });
    expect(result.options[0]?.legs.map((leg) => leg.type)).toEqual(["walk", "ride"]);
  });
});
