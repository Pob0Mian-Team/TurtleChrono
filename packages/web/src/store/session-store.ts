import { create } from 'zustand';
import type { RawLog, ProcessedSession, Gate, LapDelta } from '@turtlechrono/core';

interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  speed: 1 | 2 | 4;
}

interface SessionStore {
  rawLog: RawLog | null;
  session: ProcessedSession | null;
  currentLapIndex: number;
  referenceLapIndex: number | null;
  startFinishGate: Gate | null;
  playback: PlaybackState;
  focusedPanel: string | null;
  lapDelta: LapDelta | null;
  gateMode: boolean;
  error: string | null;

  setRawLog: (log: RawLog) => void;
  setSession: (session: ProcessedSession) => void;
  setCurrentLapIndex: (index: number) => void;
  setReferenceLapIndex: (index: number | null) => void;
  setStartFinishGate: (gate: Gate | null) => void;
  setPlayback: (partial: Partial<PlaybackState>) => void;
  setFocusedPanel: (panel: string | null) => void;
  setLapDelta: (delta: LapDelta | null) => void;
  setGateMode: (mode: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  rawLog: null,
  session: null,
  currentLapIndex: 0,
  referenceLapIndex: null as number | null,
  startFinishGate: null as Gate | null,
  playback: {
    currentTime: 0,
    isPlaying: false,
    speed: 1 as const,
  },
  focusedPanel: null as string | null,
  lapDelta: null as LapDelta | null,
  gateMode: false,
  error: null as string | null,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setRawLog: (rawLog) => set({ rawLog }),
  setSession: (session) => set({ session }),
  setCurrentLapIndex: (currentLapIndex) => set({ currentLapIndex }),
  setReferenceLapIndex: (referenceLapIndex) => set({ referenceLapIndex }),
  setStartFinishGate: (startFinishGate) => set({ startFinishGate }),
  setPlayback: (partial) =>
    set((state) => ({ playback: { ...state.playback, ...partial } })),
  setFocusedPanel: (focusedPanel) => set({ focusedPanel }),
  setLapDelta: (lapDelta) => set({ lapDelta }),
  setGateMode: (gateMode) => set({ gateMode }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
