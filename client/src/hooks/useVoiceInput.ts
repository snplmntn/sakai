import { useEffect, useRef, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
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

type NativeVoiceModule = {
  destroySpeech: (callback: (error: string) => void) => void;
  isSpeechAvailable: (callback: (isAvailable: 0 | 1, error: string) => void) => void;
  startSpeech: (...args: unknown[]) => void;
  stopSpeech: (callback: (error: string) => void) => void;
};

const VOICE_UNAVAILABLE_MESSAGE =
  Platform.OS === 'web'
    ? 'Voice input is unavailable on web.'
    : 'Voice input is unavailable in this build.';

let activeVoiceOwner: symbol | null = null;

const hasNativeVoiceSupport = (): boolean => {
  const nativeVoiceModule = NativeModules.Voice as Partial<NativeVoiceModule> | null | undefined;

  return (
    Platform.OS !== 'web' &&
    nativeVoiceModule !== null &&
    nativeVoiceModule !== undefined &&
    typeof nativeVoiceModule.destroySpeech === 'function' &&
    typeof nativeVoiceModule.isSpeechAvailable === 'function' &&
    typeof nativeVoiceModule.startSpeech === 'function' &&
    typeof nativeVoiceModule.stopSpeech === 'function'
  );
};

export const useVoiceInput = (): VoiceInputState & VoiceInputActions => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const mountedRef = useRef(true);
  const isListeningRef = useRef(false);
  const ownerRef = useRef(Symbol('voice-input-owner'));

  const bindVoiceListeners = () => {
    const ownerId = ownerRef.current;
    activeVoiceOwner = ownerId;

    Voice.onSpeechStart = () => {
      if (!mountedRef.current || activeVoiceOwner !== ownerId) {
        return;
      }

      isListeningRef.current = true;
      setIsListening(true);
    };

    Voice.onSpeechEnd = () => {
      if (!mountedRef.current || activeVoiceOwner !== ownerId) {
        return;
      }

      isListeningRef.current = false;
      setIsListening(false);
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!mountedRef.current || activeVoiceOwner !== ownerId) {
        return;
      }

      setTranscript(e.value?.[0] ?? '');
    };

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (!mountedRef.current || activeVoiceOwner !== ownerId) {
        return;
      }

      setPartialTranscript(e.value?.[0] ?? '');
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (!mountedRef.current || activeVoiceOwner !== ownerId) {
        return;
      }

      isListeningRef.current = false;
      setIsListening(false);
      setError(e.error?.message ?? 'Voice recognition failed');
    };
  };

  useEffect(() => {
    mountedRef.current = true;

    if (!hasNativeVoiceSupport()) {
      setIsAvailable(false);

      return () => {
        mountedRef.current = false;
        if (activeVoiceOwner === ownerRef.current) {
          activeVoiceOwner = null;
        }
      };
    }

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

    return () => {
      mountedRef.current = false;

      if (activeVoiceOwner === ownerRef.current) {
        activeVoiceOwner = null;

        if (isListeningRef.current) {
          void Voice.stop().catch(() => undefined);
        }
      }
    };
  }, []);

  const startListening = async () => {
    if (!hasNativeVoiceSupport()) {
      setIsAvailable(false);
      setIsListening(false);
      setError(VOICE_UNAVAILABLE_MESSAGE);
      return;
    }

    bindVoiceListeners();
    setError(null);
    setTranscript('');
    setPartialTranscript('');

    try {
      await Voice.start('en-PH');
    } catch (err: unknown) {
      if (activeVoiceOwner === ownerRef.current) {
        activeVoiceOwner = null;
      }

      isListeningRef.current = false;
      setIsListening(false);
      setError(err instanceof Error ? err.message : 'Voice recognition failed');
    }
  };

  const stopListening = async () => {
    if (!hasNativeVoiceSupport()) {
      setIsAvailable(false);
      setIsListening(false);
      setError(VOICE_UNAVAILABLE_MESSAGE);
      return;
    }

    try {
      await Voice.stop();
    } catch (err: unknown) {
      isListeningRef.current = false;
      setIsListening(false);
      setError(err instanceof Error ? err.message : 'Voice recognition failed');
    }
  };

  const resetTranscript = () => {
    isListeningRef.current = false;
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
