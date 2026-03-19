import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type VoiceSearchContextValue = {
  triggerToken: number;
  isListening: boolean;
  requestToggle: () => void;
  setIsListening: (value: boolean) => void;
};

const VoiceSearchContext = createContext<VoiceSearchContextValue | null>(null);

export function VoiceSearchProvider({ children }: { children: ReactNode }) {
  const [triggerToken, setTriggerToken] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const value = useMemo<VoiceSearchContextValue>(
    () => ({
      triggerToken,
      isListening,
      requestToggle: () => {
        setTriggerToken((current) => current + 1);
      },
      setIsListening,
    }),
    [isListening, triggerToken]
  );

  return <VoiceSearchContext.Provider value={value}>{children}</VoiceSearchContext.Provider>;
}

export function useVoiceSearchTrigger(): VoiceSearchContextValue {
  const context = useContext(VoiceSearchContext);

  if (context === null) {
    throw new Error('useVoiceSearchTrigger must be used within a VoiceSearchProvider');
  }

  return context;
}
