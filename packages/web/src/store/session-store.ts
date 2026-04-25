import { create } from 'zustand';
import type { RawLog, ProcessedSession, Gate, LapDelta } from '@turtlechrono/core';

export type ChartType = 'speed' | 'delta';

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
  lapDelta: LapDelta | null;
  gateMode: boolean;
  error: string | null;
  enabledCharts: ChartType[];

  setRawLog: (log: RawLog) => void;
  setSession: (session: ProcessedSession) => void;
  setCurrentLapIndex: (index: number) => void;
  setReferenceLapIndex: (index: number | null) => void;
  setStartFinishGate: (gate: Gate | null) => void;
  setPlayback: (partial: Partial<PlaybackState>) => void;
  setLapDelta: (delta: LapDelta | null) => void;
  setGateMode: (mode: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  toggleChart: (type: ChartType) => void;
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
  lapDelta: null as LapDelta | null,
  gateMode: false,
  error: null as string | null,
  enabledCharts: ['speed', 'delta'] as ChartType[],
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
  setLapDelta: (lapDelta) => set({ lapDelta }),
  setGateMode: (gateMode) => set({ gateMode }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
  toggleChart: (type) =>
    set((state) => {
      const has = state.enabledCharts.includes(type);
      if (!has) {
        return { enabledCharts: [...state.enabledCharts, type] };
      }
      if (state.enabledCharts.length <= 1) return {};
      return { enabledCharts: state.enabledCharts.filter((t) => t !== type) };
    }),
}));
