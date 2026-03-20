import type { SpeechTranscriptionResult } from './api';
import {
  getVoiceLanguageLabel,
  getVoiceTranscriptionOverride,
  type VoiceLanguagePreference,
} from '../voice/languages';

export const createFallbackSpeechTranscription = (input: {
  transcript: string;
  voiceLanguage: VoiceLanguagePreference;
}): SpeechTranscriptionResult => ({
  transcript: input.transcript.trim(),
  confidence: null,
  detectedLanguageCode: getVoiceTranscriptionOverride(input.voiceLanguage),
  detectedLanguageLabel:
    input.voiceLanguage === 'auto' ? 'Device transcript' : getVoiceLanguageLabel(input.voiceLanguage),
  detectionMode: 'fallback',
});
