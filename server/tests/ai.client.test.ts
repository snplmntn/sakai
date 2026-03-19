import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const restoreGeminiEnv = (snapshot: Partial<NodeJS.ProcessEnv>) => {
  if (snapshot.SUPABASE_URL === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = snapshot.SUPABASE_URL;
  }

  if (snapshot.SUPABASE_ANON_KEY === undefined) {
    delete process.env.SUPABASE_ANON_KEY;
  } else {
    process.env.SUPABASE_ANON_KEY = snapshot.SUPABASE_ANON_KEY;
  }

  if (snapshot.SUPABASE_SERVICE_ROLE_KEY === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = snapshot.SUPABASE_SERVICE_ROLE_KEY;
  }

  if (snapshot.AUTH_GOOGLE_REDIRECT_URI === undefined) {
    delete process.env.AUTH_GOOGLE_REDIRECT_URI;
  } else {
    process.env.AUTH_GOOGLE_REDIRECT_URI = snapshot.AUTH_GOOGLE_REDIRECT_URI;
  }

  if (snapshot.AUTH_APP_REDIRECT_URI === undefined) {
    delete process.env.AUTH_APP_REDIRECT_URI;
  } else {
    process.env.AUTH_APP_REDIRECT_URI = snapshot.AUTH_APP_REDIRECT_URI;
  }

  if (snapshot.AUTH_STATE_SIGNING_SECRET === undefined) {
    delete process.env.AUTH_STATE_SIGNING_SECRET;
  } else {
    process.env.AUTH_STATE_SIGNING_SECRET = snapshot.AUTH_STATE_SIGNING_SECRET;
  }

  if (snapshot.AI_PROVIDER === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = snapshot.AI_PROVIDER;
  }

  if (snapshot.GEMINI_API_KEY === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = snapshot.GEMINI_API_KEY;
  }

  if (snapshot.VERTEX_API_KEY === undefined) {
    delete process.env.VERTEX_API_KEY;
  } else {
    process.env.VERTEX_API_KEY = snapshot.VERTEX_API_KEY;
  }

  if (snapshot.GEMINI_MODEL_PRIMARY === undefined) {
    delete process.env.GEMINI_MODEL_PRIMARY;
  } else {
    process.env.GEMINI_MODEL_PRIMARY = snapshot.GEMINI_MODEL_PRIMARY;
  }

  if (snapshot.GEMINI_MODEL_LIGHT === undefined) {
    delete process.env.GEMINI_MODEL_LIGHT;
  } else {
    process.env.GEMINI_MODEL_LIGHT = snapshot.GEMINI_MODEL_LIGHT;
  }
};

describe("ai client", () => {
  const geminiEnvSnapshot = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AUTH_GOOGLE_REDIRECT_URI: process.env.AUTH_GOOGLE_REDIRECT_URI,
    AUTH_APP_REDIRECT_URI: process.env.AUTH_APP_REDIRECT_URI,
    AUTH_STATE_SIGNING_SECRET: process.env.AUTH_STATE_SIGNING_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    VERTEX_API_KEY: process.env.VERTEX_API_KEY,
    GEMINI_MODEL_PRIMARY: process.env.GEMINI_MODEL_PRIMARY,
    GEMINI_MODEL_LIGHT: process.env.GEMINI_MODEL_LIGHT
  };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.AUTH_GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";
    process.env.AUTH_APP_REDIRECT_URI = "http://localhost:8081/auth/callback";
    process.env.AUTH_STATE_SIGNING_SECRET = "12345678901234567890123456789012";
    process.env.AI_PROVIDER = "vertex_express";
    delete process.env.GEMINI_API_KEY;
    delete process.env.VERTEX_API_KEY;
    delete process.env.GEMINI_MODEL_PRIMARY;
    delete process.env.GEMINI_MODEL_LIGHT;
  });

  afterEach(() => {
    restoreGeminiEnv(geminiEnvSnapshot);
    vi.unstubAllGlobals();
  });

  it("treats Gemini Developer API as disabled when no key is configured", async () => {
    process.env.AI_PROVIDER = "gemini_developer";

    const client = await import("../src/ai/client.js");

    expect(client.isAiEnabled()).toBe(false);
    await expect(
      client.generateJson({
        prompt: "test",
        outputSchema: z.object({
          ok: z.boolean()
        }),
        responseSchema: {
          type: "OBJECT",
          properties: {
            ok: {
              type: "BOOLEAN"
            }
          },
          required: ["ok"]
        }
      })
    ).rejects.toBeInstanceOf(client.AiUnavailableError);
  });

  it("treats Vertex express mode as disabled when no key is configured", async () => {
    process.env.AI_PROVIDER = "vertex_express";

    const client = await import("../src/ai/client.js");

    expect(client.isAiEnabled()).toBe(false);
    await expect(
      client.generateJson({
        prompt: "test",
        outputSchema: z.object({
          ok: z.boolean()
        }),
        responseSchema: {
          type: "OBJECT",
          properties: {
            ok: {
              type: "BOOLEAN"
            }
          },
          required: ["ok"]
        }
      })
    ).rejects.toBeInstanceOf(client.AiUnavailableError);
  });

  it("retries transient Gemini failures and returns validated JSON", async () => {
    process.env.AI_PROVIDER = "gemini_developer";
    process.env.GEMINI_API_KEY = "test-key";

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "{\"summary\":\"Ride to PUP via Cubao.\"}"
                    }
                  ]
                }
              }
            ]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = await import("../src/ai/client.js");
    const result = await client.generateJson({
      prompt: "test",
      outputSchema: z.object({
        summary: z.string()
      }),
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: {
            type: "STRING"
          }
        },
        required: ["summary"]
      },
      retryCount: 1
    });

    expect(result).toEqual({
      summary: "Ride to PUP via Cubao."
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key"
    );
  });

  it("calls Vertex express mode with the Vertex API key", async () => {
    process.env.AI_PROVIDER = "vertex_express";
    process.env.VERTEX_API_KEY = "vertex-key";

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "{\"summary\":\"Ride to PUP via Cubao.\"}"
                  }
                ]
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = await import("../src/ai/client.js");
    const result = await client.generateJson({
      prompt: "test",
      outputSchema: z.object({
        summary: z.string()
      }),
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: {
            type: "STRING"
          }
        },
        required: ["summary"]
      }
    });

    expect(result).toEqual({
      summary: "Ride to PUP via Cubao."
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=vertex-key"
    );
  });
});
