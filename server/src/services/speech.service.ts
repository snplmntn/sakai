import { z } from "zod";

import { getEnv } from "../config/env.js";
import { HttpError } from "../types/http-error.js";

const GOOGLE_GEMINI_AUDIO_MODEL = "gemini-3-flash-preview";
const GOOGLE_GENERATE_CONTENT_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_GEMINI_AUDIO_MODEL}:generateContent`;
const GOOGLE_REQUEST_TIMEOUT_MS = 25_000;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const LANGUAGE_OVERRIDE_LABELS = {
  "en-PH": "English (Philippines)",
  "fil-PH": "Filipino / Tagalog",
  "ceb-PH": "Cebuano",
  "ilo-PH": "Ilocano",
  "hil-PH": "Hiligaynon",
  "pam-PH": "Kapampangan",
  "war-PH": "Waray"
} as const;

type SpeechLanguageOverride = keyof typeof LANGUAGE_OVERRIDE_LABELS;

const nullableTextSchema = z
  .union([z.string().trim().min(1).max(80), z.null()])
  .optional()
  .transform((value) => value ?? null);

const speechTranscriptionResultSchema = z.object({
  transcript: z.string().trim().min(1).max(2_000),
  detectedLanguageCode: nullableTextSchema,
  detectedLanguageLabel: nullableTextSchema
});

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GeminiErrorResponse {
  error?: {
    message?: string;
  };
}

const parseResponseText = (payload: GeminiResponse) => {
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text.length > 0) {
    return text;
  }

  if (payload.promptFeedback?.blockReason) {
    throw new HttpError(502, "Speech transcription was blocked", {
      reasonCode: "speech_blocked",
      blockReason: payload.promptFeedback.blockReason
    });
  }

  throw new HttpError(502, "Speech transcription returned no text", {
    reasonCode: "speech_empty_response"
  });
};

const readGoogleApiKey = () => {
  const apiKey = getEnv().GOOGLE_API_KEY?.trim() ?? "";

  if (apiKey.length === 0) {
    throw new HttpError(503, "Speech transcription is unavailable", {
      reasonCode: "speech_not_configured"
    });
  }

  return apiKey;
};

const decodeAudioSize = (audioBase64: string) => {
  try {
    return Buffer.from(audioBase64, "base64").byteLength;
  } catch {
    throw new HttpError(400, "audioBase64 must be valid base64 audio data", {
      reasonCode: "speech_invalid_base64"
    });
  }
};

export const transcribeSpeech = async (input: {
  audioBase64: string;
  mimeType: string;
  languageOverride?: SpeechLanguageOverride | null;
}): Promise<{
  transcript: string;
  confidence: null;
  detectedLanguageCode: string | null;
  detectedLanguageLabel: string | null;
  detectionMode: "auto" | "override";
}> => {
  if (decodeAudioSize(input.audioBase64) > MAX_AUDIO_BYTES) {
    throw new HttpError(413, "Audio clip is too large for transcription", {
      reasonCode: "speech_audio_too_large"
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GOOGLE_REQUEST_TIMEOUT_MS);

  const languageOverride = input.languageOverride ?? null;
  const languageOverrideLabel =
    languageOverride === null ? null : LANGUAGE_OVERRIDE_LABELS[languageOverride];

  try {
    const response = await fetch(
      GOOGLE_GENERATE_CONTENT_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": readGoogleApiKey()
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    [
                      "Transcribe this spoken commute request exactly.",
                      "Detect the spoken language automatically unless a language override is provided.",
                      "The speech may be Taglish, Filipino, English, Cebuano, Ilocano, Hiligaynon, Kapampangan, Waray, or another language.",
                      "Preserve mixed-language phrasing, route labels, place names, and proper nouns.",
                      languageOverrideLabel === null
                        ? "Return JSON only with transcript, detectedLanguageCode, and detectedLanguageLabel."
                        : `Bias the transcription toward ${languageOverrideLabel}. Return JSON only with transcript, detectedLanguageCode, and detectedLanguageLabel.`,
                      "Do not summarize."
                    ].join(" ")
                },
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: input.audioBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                transcript: {
                  type: "STRING"
                },
                detectedLanguageCode: {
                  type: "STRING"
                },
                detectedLanguageLabel: {
                  type: "STRING"
                }
              },
              required: ["transcript", "detectedLanguageCode", "detectedLanguageLabel"]
            }
          }
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as GeminiErrorResponse | null;
      throw new HttpError(502, "Speech transcription failed", {
        reasonCode: "speech_upstream_error",
        upstreamMessage:
          errorBody?.error?.message?.trim() ||
          `Google API request failed with status ${response.status}`
      });
    }

    const payload = (await response.json()) as GeminiResponse;
    const parsedResult = speechTranscriptionResultSchema.safeParse(
      JSON.parse(parseResponseText(payload)) as unknown
    );

    if (!parsedResult.success) {
      throw new HttpError(502, "Speech transcription returned invalid JSON", {
        reasonCode: "speech_invalid_json",
        issues: parsedResult.error.issues
      });
    }

    return {
      transcript: parsedResult.data.transcript,
      confidence: null,
      detectedLanguageCode:
        languageOverride ?? parsedResult.data.detectedLanguageCode,
      detectedLanguageLabel:
        languageOverrideLabel ?? parsedResult.data.detectedLanguageLabel,
      detectionMode: languageOverride === null ? "auto" : "override"
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(504, "Speech transcription timed out", {
        reasonCode: "speech_timeout"
      });
    }

    throw new HttpError(502, "Speech transcription request failed", {
      reasonCode: "speech_request_failed",
      message: error instanceof Error ? error.message : undefined
    });
  } finally {
    clearTimeout(timeoutId);
  }
};
