import { setTimeout as delay } from "node:timers/promises";

import type { ZodType } from "zod";

import { getEnv } from "../config/env.js";

const VERTEX_EXPRESS_API_URL = "https://aiplatform.googleapis.com/v1";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_PRIMARY_MODEL = "gemini-2.5-flash";
const DEFAULT_LIGHT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_AI_PROVIDER = "gemini_developer";

export type AiProvider = "gemini_developer" | "vertex_express";

interface GeminiGenerateContentPart {
  text?: string;
}

interface GeminiGenerateContentCandidate {
  content?: {
    parts?: GeminiGenerateContentPart[];
  };
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiGenerateContentCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GeminiErrorResponse {
  error?: {
    message?: string;
  };
}

export interface GenerateJsonOptions<T> {
  model?: string;
  prompt: string;
  outputSchema: ZodType<T>;
  responseSchema: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
  retryCount?: number;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export class AiInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiInvalidResponseError";
  }
}

const getAiProvider = (): AiProvider => getEnv().AI_PROVIDER ?? DEFAULT_AI_PROVIDER;

const getApiKey = () => {
  const env = getEnv();
  const provider = getAiProvider();

  return provider === "vertex_express"
    ? env.VERTEX_API_KEY?.trim() ?? ""
    : env.GEMINI_API_KEY?.trim() ?? "";
};

export const isAiEnabled = () => getApiKey().length > 0;

export const getPrimaryModel = () =>
  getEnv().GEMINI_MODEL_PRIMARY?.trim() || DEFAULT_PRIMARY_MODEL;

export const getLightModel = () =>
  getEnv().GEMINI_MODEL_LIGHT?.trim() || DEFAULT_LIGHT_MODEL;

const getVertexExpressModelPath = (model: string) =>
  model.startsWith("publishers/") ? model : `publishers/google/models/${model}`;

const getRequestUrl = (model: string) => {
  const apiKey = getApiKey();
  const provider = getAiProvider();

  if (!apiKey) {
    const missingKeyName =
      provider === "vertex_express" ? "VERTEX_API_KEY" : "GEMINI_API_KEY";

    throw new AiUnavailableError(
      `${provider === "vertex_express" ? "Vertex AI express mode" : "Gemini Developer API"} is disabled because ${missingKeyName} is not configured`
    );
  }

  if (provider === "vertex_express") {
    const vertexModel = getVertexExpressModelPath(model);

    return `${VERTEX_EXPRESS_API_URL}/${vertexModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  return `${GEMINI_API_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
};

const shouldRetry = (error: unknown) => {
  if (error instanceof AiUnavailableError) {
    return true;
  }

  return false;
};

const parseResponseText = (payload: GeminiGenerateContentResponse) => {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text.length > 0) {
    return text;
  }

  if (payload.promptFeedback?.blockReason) {
    throw new AiInvalidResponseError(
      `Gemini blocked the response: ${payload.promptFeedback.blockReason}`
    );
  }

  throw new AiInvalidResponseError("Gemini returned no text content");
};

const postJson = async (
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiUnavailableError("Gemini request timed out");
    }

    throw new AiUnavailableError(
      error instanceof Error ? error.message : "Gemini request failed"
    );
  } finally {
    clearTimeout(timeout);
  }
};

const requestJson = async <T>(options: GenerateJsonOptions<T>) => {
  const model = options.model ?? getPrimaryModel();
  const url = getRequestUrl(model);
  const response = await postJson(
    url,
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: options.prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.1,
        responseMimeType: "application/json",
        responseSchema: options.responseSchema
      }
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as GeminiErrorResponse | null;
    const message = errorBody?.error?.message?.trim() || `Gemini request failed with status ${response.status}`;

    if (response.status === 429 || response.status >= 500) {
      throw new AiUnavailableError(message);
    }

    throw new AiInvalidResponseError(message);
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const text = parseResponseText(payload);

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(text) as unknown;
  } catch {
    throw new AiInvalidResponseError("Gemini returned invalid JSON");
  }

  const result = options.outputSchema.safeParse(parsedValue);

  if (!result.success) {
    throw new AiInvalidResponseError("Gemini returned JSON that failed schema validation");
  }

  return result.data;
};

export const generateJson = async <T>(options: GenerateJsonOptions<T>): Promise<T> => {
  const retryCount = options.retryCount ?? DEFAULT_RETRY_COUNT;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await requestJson(options);
    } catch (error) {
      if (attempt === retryCount || !shouldRetry(error)) {
        throw error;
      }

      await delay(250 * (attempt + 1));
    }
  }

  throw new AiUnavailableError("Gemini request failed after retries");
};
