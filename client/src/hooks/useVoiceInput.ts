import { useEffect, useRef, useState } from 'react';
import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice';

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  partialTranscript: string;
  error: string | null;
  isAvailable: boolean;
}

export interface VoiceInputActions {
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  resetTranscript: () => void;
}

export const useVoiceInput = (): VoiceInputState & VoiceInputActions => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    void Voice.isAvailable()
      .then((available) => {
        if (mountedRef.current) {
          setIsAvailable(Boolean(available));
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setIsAvailable(false);
        }
      });

    Voice.onSpeechStart = () => {
      if (mountedRef.current) {
        setIsListening(true);
      }
    };
    Voice.onSpeechEnd = () => {
      if (mountedRef.current) {
        setIsListening(false);
      }
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (mountedRef.current) setTranscript(e.value?.[0] ?? '');
    };
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (mountedRef.current) setPartialTranscript(e.value?.[0] ?? '');
    };
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (!mountedRef.current) return;
      setError(e.error?.message ?? 'Voice recognition failed');
      setIsListening(false);
    };

    return () => {
      mountedRef.current = false;
      void Voice.destroy().then(() => Voice.removeAllListeners());
    };
  }, []);

  const startListening = async () => {
    setError(null);
    setTranscript('');
    setPartialTranscript('');
    try {
      await Voice.start('en-PH');
    } catch (err: unknown) {
      setIsListening(false);
      setError(err instanceof Error ? err.message : 'Voice recognition failed');
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch (err: unknown) {
      setIsListening(false);
      setError(err instanceof Error ? err.message : 'Voice recognition failed');
    }
  };

  const resetTranscript = () => {
    setIsListening(false);
    setTranscript('');
    setPartialTranscript('');
    setError(null);
  };

  return {
    isListening,
    transcript,
    partialTranscript,
    error,
    isAvailable,
    startListening,
    stopListening,
    resetTranscript,
  };
};
