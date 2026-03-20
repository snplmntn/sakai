import { requestData } from '../api/base';

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

const parseSpeechTranscript = (value: unknown): { transcript: string; confidence: number | null } => {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as { transcript?: unknown }).transcript !== 'string'
  ) {
    throw new Error('Invalid speech transcription response');
  }

  return {
    transcript: (value as { transcript: string }).transcript,
    confidence:
      typeof (value as { confidence?: unknown }).confidence === 'number'
        ? (value as { confidence: number }).confidence
        : null,
  };
};

export const transcribeSpeechRecording = async (input: {
  uri: string;
  mimeType: string;
  accessToken?: string;
}): Promise<{ transcript: string; confidence: number | null }> => {
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
      },
    },
    parseSpeechTranscript
  );
};

