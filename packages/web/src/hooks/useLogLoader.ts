import { useCallback } from 'react';
import { parseLog, processSession, computeLapDelta } from '@turtlechrono/core';
import type { Gate } from '@turtlechrono/core';
import { useSessionStore } from '../store/session-store';

export function useLogLoader() {
  const store = useSessionStore;

  const loadFile = useCallback(async (file: File) => {
    store.getState().reset();
    try {
      const buffer = await file.arrayBuffer();
      const rawLog = parseLog(buffer);
      store.getState().setRawLog(rawLog);
      store.getState().setError(null);
    } catch (e) {
      store.getState().setError(e instanceof Error ? e.message : 'Failed to parse log file');
    }
  }, []);

  const setGateAndProcess = useCallback((gate: Gate) => {
    const { rawLog } = store.getState();
    if (!rawLog) return;

    store.getState().setStartFinishGate(gate);
    const session = processSession(rawLog, gate);
    store.getState().setSession(session);

    if (session.laps.length > 0) {
      store.getState().setCurrentLapIndex(0);
      const bestIdx = session.bestLapIndex >= 0 ? session.bestLapIndex : 0;
      store.getState().setReferenceLapIndex(bestIdx);

      if (bestIdx !== 0) {
        const delta = computeLapDelta(session.laps[0], session.laps[bestIdx]);
        store.getState().setLapDelta(delta);
      } else {
        store.getState().setLapDelta(null);
      }
    }
  }, []);

  const selectCurrentLap = useCallback((index: number) => {
    const { session, referenceLapIndex } = store.getState();
    store.getState().setCurrentLapIndex(index);
    if (session && referenceLapIndex !== null && referenceLapIndex !== index) {
      const delta = computeLapDelta(session.laps[index], session.laps[referenceLapIndex]);
      store.getState().setLapDelta(delta);
    } else {
      store.getState().setLapDelta(null);
    }
    store.getState().setPlayback({ currentTime: 0, isPlaying: false });
  }, []);

  const selectReferenceLap = useCallback((index: number | null) => {
    const { session, currentLapIndex } = store.getState();
    store.getState().setReferenceLapIndex(index);
    if (session && index !== null && index !== currentLapIndex) {
      const delta = computeLapDelta(session.laps[currentLapIndex], session.laps[index]);
      store.getState().setLapDelta(delta);
    } else {
      store.getState().setLapDelta(null);
    }
  }, []);

  return { loadFile, setGateAndProcess, selectCurrentLap, selectReferenceLap };
}
