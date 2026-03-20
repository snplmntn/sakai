import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

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

type SpeechRecognitionSubscription = {
  remove: () => void;
};
type SpeechRecognitionPermissionResponse = {
  granted: boolean;
};
type SpeechRecognitionModule = {
  addListener: (
    eventName: 'start' | 'end' | 'result' | 'error',
    listener: (
      event:
        | ExpoSpeechRecognitionResultEvent
        | ExpoSpeechRecognitionErrorEvent
        | Record<string, never>
    ) => void
  ) => SpeechRecognitionSubscription;
  getPermissionsAsync: () => Promise<SpeechRecognitionPermissionResponse>;
  requestPermissionsAsync: () => Promise<SpeechRecognitionPermissionResponse>;
  isRecognitionAvailable: () => boolean;
  start: (options: {
    lang: string;
    interimResults: boolean;
    addsPunctuation: boolean;
    continuous: boolean;
  }) => void;
  stop: () => void;
};

interface UseVoiceInputOptions {
  locale?: string;
}

const VOICE_UNAVAILABLE_MESSAGE =
  Platform.OS === 'web'
    ? 'Voice input is unavailable on web.'
    : 'Speech recognition is unavailable in this build or on this device. Rebuild the app after native changes, then make sure system speech recognition is enabled.';

let activeVoiceOwner: symbol | null = null;
let speechRecognitionModule: SpeechRecognitionModule | null | undefined;

const getVoiceInputUnavailableMessage = (): string => VOICE_UNAVAILABLE_MESSAGE;

const getSpeechRecognitionModule = (): SpeechRecognitionModule | null => {
  if (Platform.OS === 'web') {
    return null;
  }

  if (speechRecognitionModule !== undefined) {
    return speechRecognitionModule;
  }

  speechRecognitionModule = requireOptionalNativeModule<SpeechRecognitionModule>(
    'ExpoSpeechRecognition'
  );
  return speechRecognitionModule;
};

const getPrimaryResultTranscript = (event: ExpoSpeechRecognitionResultEvent): string =>
  event.results[0]?.transcript ?? '';

const getFriendlySpeechErrorMessage = (
  event: ExpoSpeechRecognitionErrorEvent,
  locale: string
): string => {
  switch (event.error) {
    case 'not-allowed':
      return 'Speech recognition permission is off. Allow microphone and speech recognition access in Settings.';
    case 'service-not-allowed':
      return 'Speech recognition is turned off or unavailable on this device. Enable the system speech service and try again.';
    case 'language-not-supported':
      return `Speech recognition does not support ${locale}. Try Auto detect or a different voice language.`;
    case 'audio-capture':
      return 'Microphone capture failed. Close other voice apps and try again.';
    case 'busy':
      return 'Speech recognition is already in use. Try again in a moment.';
    case 'no-speech':
    case 'speech-timeout':
      return 'No speech was detected. Try speaking again.';
    case 'network':
      return 'Speech recognition could not reach the service. Check connectivity and try again.';
    default:
      return event.message.trim().length > 0 ? event.message : 'Voice recognition failed.';
  }
};

export const useVoiceInput = (
  options: UseVoiceInputOptions = {}
): VoiceInputState & VoiceInputActions => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const mountedRef = useRef(true);
  const isListeningRef = useRef(false);
  const ownerRef = useRef(Symbol('voice-input-owner'));
  const resolvedLocale = options.locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US';

  useEffect(() => {
    mountedRef.current = true;
    const speechModule = getSpeechRecognitionModule();
    const ownerId = ownerRef.current;
    const subscriptions: SpeechRecognitionSubscription[] = [];

    if (speechModule === null) {
      setIsAvailable(false);
    } else {
      try {
        setIsAvailable(speechModule.isRecognitionAvailable());
      } catch {
        setIsAvailable(false);
      }

      subscriptions.push(speechModule.addListener('start', () => {
        if (!mountedRef.current || activeVoiceOwner !== ownerId) {
          return;
        }

        isListeningRef.current = true;
        setIsListening(true);
      }));

      subscriptions.push(speechModule.addListener('end', () => {
        if (!mountedRef.current || activeVoiceOwner !== ownerId) {
          return;
        }

        isListeningRef.current = false;
        setIsListening(false);
      }));

      subscriptions.push(speechModule.addListener('result', (event) => {
        if (!mountedRef.current || activeVoiceOwner !== ownerId) {
          return;
        }

        const nextTranscript = getPrimaryResultTranscript(event as ExpoSpeechRecognitionResultEvent);

        if ((event as ExpoSpeechRecognitionResultEvent).isFinal) {
          setTranscript(nextTranscript);
          setPartialTranscript('');
          return;
        }

        setPartialTranscript(nextTranscript);
      }));

      subscriptions.push(speechModule.addListener('error', (event) => {
        if (!mountedRef.current || activeVoiceOwner !== ownerId) {
          return;
        }

        isListeningRef.current = false;
        setIsListening(false);
        setError(
          getFriendlySpeechErrorMessage(event as ExpoSpeechRecognitionErrorEvent, resolvedLocale)
        );
      }));
    }

    return () => {
      mountedRef.current = false;
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });

      if (activeVoiceOwner === ownerRef.current) {
        activeVoiceOwner = null;

        if (isListeningRef.current) {
          getSpeechRecognitionModule()?.stop();
        }
      }
    };
  }, [resolvedLocale]);

  const startListening = async () => {
    const speechModule = getSpeechRecognitionModule();

    if (speechModule === null) {
      const errorMessage = VOICE_UNAVAILABLE_MESSAGE;
      setIsAvailable(false);
      setIsListening(false);
      throw new Error(errorMessage);
    }

    try {
      const permissions = await speechModule.getPermissionsAsync();
      const grantedPermissions = permissions.granted
        ? permissions
        : await speechModule.requestPermissionsAsync();

      if (!grantedPermissions.granted) {
        const errorMessage = getFriendlySpeechErrorMessage(
          { error: 'not-allowed', message: '' },
          resolvedLocale
        );
        setIsAvailable(speechModule.isRecognitionAvailable());
        setIsListening(false);
        throw new Error(errorMessage);
      }

      const recognitionAvailable = speechModule.isRecognitionAvailable();
      setIsAvailable(recognitionAvailable);

      if (!recognitionAvailable) {
        const errorMessage = VOICE_UNAVAILABLE_MESSAGE;
        setIsListening(false);
        throw new Error(errorMessage);
      }

      activeVoiceOwner = ownerRef.current;
      setError(null);
      setTranscript('');
      setPartialTranscript('');
      speechModule.start({
        lang: resolvedLocale,
        interimResults: true,
        addsPunctuation: true,
        continuous: false,
      });
    } catch (err: unknown) {
      if (activeVoiceOwner === ownerRef.current) {
        activeVoiceOwner = null;
      }

      const errorMessage = err instanceof Error ? err.message : 'Voice recognition failed';
      isListeningRef.current = false;
      setIsListening(false);
      throw (err instanceof Error ? err : new Error(errorMessage));
    }
  };

  const stopListening = async () => {
    const speechModule = getSpeechRecognitionModule();

    if (speechModule === null) {
      setIsAvailable(false);
      setIsListening(false);
      setError(VOICE_UNAVAILABLE_MESSAGE);
      return;
    }

    try {
      speechModule.stop();
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

export { getVoiceInputUnavailableMessage };
