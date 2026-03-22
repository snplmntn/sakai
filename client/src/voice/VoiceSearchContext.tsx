import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type VoiceSearchContextValue = {
  startToken: number;
  stopToken: number;
  isListening: boolean;
  requestStart: () => void;
  requestStop: () => void;
  setIsListening: (value: boolean) => void;
};

const VoiceSearchContext = createContext<VoiceSearchContextValue | null>(null);

export function VoiceSearchProvider({ children }: { children: ReactNode }) {
  const [startToken, setStartToken] = useState(0);
  const [stopToken, setStopToken] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const value = useMemo<VoiceSearchContextValue>(
    () => ({
      startToken,
      stopToken,
      isListening,
      requestStart: () => setStartToken((n) => n + 1),
      requestStop: () => setStopToken((n) => n + 1),
      setIsListening,
    }),
    [isListening, startToken, stopToken]
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
