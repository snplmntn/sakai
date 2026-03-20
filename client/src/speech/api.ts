import { isRecord, requestData } from '../api/base';
import type { VoiceLanguagePreference } from '../voice/languages';

const blobToBase64 = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Unable to read the recorded audio clip.'));
    };

    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to encode the recorded audio clip.'));
        return;
      }

      const commaIndex = reader.result.indexOf(',');
      resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
    };

    reader.readAsDataURL(blob);
  });

export interface SpeechTranscriptionResult {
  transcript: string;
  confidence: number | null;
  detectedLanguageCode: string | null;
  detectedLanguageLabel: string | null;
  detectionMode: 'auto' | 'override' | 'fallback';
}

const readNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid speech transcription response');
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseSpeechTranscript = (value: unknown): SpeechTranscriptionResult => {
  if (!isRecord(value) || typeof value.transcript !== 'string') {
    throw new Error('Invalid speech transcription response');
  }

  return {
    transcript: value.transcript,
    confidence: typeof value.confidence === 'number' ? value.confidence : null,
    detectedLanguageCode: readNullableString(value.detectedLanguageCode),
    detectedLanguageLabel: readNullableString(value.detectedLanguageLabel),
    detectionMode:
      value.detectionMode === 'override' || value.detectionMode === 'fallback'
        ? value.detectionMode
        : 'auto',
  };
};

export const transcribeSpeechRecording = async (input: {
  uri: string;
  mimeType: string;
  accessToken?: string;
  languageOverride?: Exclude<VoiceLanguagePreference, 'auto'> | null;
}): Promise<SpeechTranscriptionResult> => {
  const fileResponse = await fetch(input.uri);
  const blob = await fileResponse.blob();
  const audioBase64 = await blobToBase64(blob);

  return requestData(
    {
      method: 'POST',
      path: '/api/speech/transcribe',
      accessToken: input.accessToken,
      body: {
        audioBase64,
        mimeType: input.mimeType,
        languageOverride: input.languageOverride ?? null,
      },
    },
    parseSpeechTranscript
  );
};
