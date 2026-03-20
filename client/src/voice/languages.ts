export type VoiceLanguagePreference =
  | 'auto'
  | 'en-PH'
  | 'fil-PH'
  | 'ceb-PH'
  | 'ilo-PH'
  | 'hil-PH'
  | 'pam-PH'
  | 'war-PH';

type VoiceLanguageOption = {
  value: VoiceLanguagePreference;
  label: string;
  description: string;
  recognitionLocale: string | null;
};

export const DEFAULT_VOICE_LANGUAGE: VoiceLanguagePreference = 'auto';

export const VOICE_LANGUAGE_OPTIONS: VoiceLanguageOption[] = [
  {
    value: 'auto',
    label: 'Auto detect',
    description: 'Detect the spoken language automatically and keep fast local voice preview.',
    recognitionLocale: null,
  },
  {
    value: 'en-PH',
    label: 'English (PH)',
    description: 'Bias spoken route capture toward Philippine English.',
    recognitionLocale: 'en-PH',
  },
  {
    value: 'fil-PH',
    label: 'Filipino / Tagalog',
    description: 'Prefer Filipino and Tagalog phrasing for route requests.',
    recognitionLocale: 'fil-PH',
  },
  {
    value: 'ceb-PH',
    label: 'Cebuano',
    description: 'Keep Cebuano as the final transcription hint while local preview stays PH-friendly.',
    recognitionLocale: 'fil-PH',
  },
  {
    value: 'ilo-PH',
    label: 'Ilocano',
    description: 'Keep Ilocano as the final transcription hint while local preview stays PH-friendly.',
    recognitionLocale: 'fil-PH',
  },
  {
    value: 'hil-PH',
    label: 'Hiligaynon',
    description: 'Keep Hiligaynon as the final transcription hint while local preview stays PH-friendly.',
    recognitionLocale: 'fil-PH',
  },
  {
    value: 'pam-PH',
    label: 'Kapampangan',
    description: 'Keep Kapampangan as the final transcription hint while local preview stays PH-friendly.',
    recognitionLocale: 'fil-PH',
  },
  {
    value: 'war-PH',
    label: 'Waray',
    description: 'Keep Waray as the final transcription hint while local preview stays PH-friendly.',
    recognitionLocale: 'fil-PH',
  },
];

const VOICE_LANGUAGE_VALUES = new Set<string>(
  VOICE_LANGUAGE_OPTIONS.map((option) => option.value)
);

const getVoiceLanguageOption = (value: VoiceLanguagePreference): VoiceLanguageOption => {
  const matchingOption = VOICE_LANGUAGE_OPTIONS.find((option) => option.value === value);

  if (matchingOption) {
    return matchingOption;
  }

  return VOICE_LANGUAGE_OPTIONS.find((option) => option.value === DEFAULT_VOICE_LANGUAGE) ?? {
    value: DEFAULT_VOICE_LANGUAGE,
    label: 'Auto detect',
    description: 'Detect the spoken language automatically and keep fast local voice preview.',
    recognitionLocale: null,
  };
};

const normalizeLocale = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const isVoiceLanguagePreference = (
  value: unknown
): value is VoiceLanguagePreference =>
  typeof value === 'string' && VOICE_LANGUAGE_VALUES.has(value);

export const getVoiceLanguageLabel = (value: VoiceLanguagePreference): string =>
  getVoiceLanguageOption(value).label;

export const getVoiceTranscriptionOverride = (
  value: VoiceLanguagePreference
): Exclude<VoiceLanguagePreference, 'auto'> | null => (value === 'auto' ? null : value);

export const getDeviceVoiceRecognitionLocale = (): string => {
  const locale = normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  return locale ?? 'en-US';
};

export const getVoiceRecognitionLocale = (value: VoiceLanguagePreference): string => {
  const configuredLocale = getVoiceLanguageOption(value).recognitionLocale;
  return configuredLocale ?? getDeviceVoiceRecognitionLocale();
};
