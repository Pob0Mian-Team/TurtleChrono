import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../store/session-store';

export function usePlayback() {
  const playback = useSessionStore((s) => s.playback);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const session = useSessionStore((s) => s.session);
  const setPlayback = useSessionStore((s) => s.setPlayback);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const lap = session?.laps[currentLapIndex];
  const lapDuration = lap?.durationMs ?? 0;

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaMs = (timestamp - lastTimeRef.current) * playback.speed;
      lastTimeRef.current = timestamp;

      const newTime = playback.currentTime + deltaMs;

      if (newTime >= lapDuration) {
        setPlayback({ currentTime: lapDuration, isPlaying: false });
        return;
      }

      setPlayback({ currentTime: newTime });
      rafRef.current = requestAnimationFrame(animate);
    },
    [playback.currentTime, playback.speed, lapDuration, setPlayback],
  );

  useEffect(() => {
    if (playback.isPlaying) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [playback.isPlaying, animate]);

  const play = useCallback(() => setPlayback({ isPlaying: true }), [setPlayback]);
  const pause = useCallback(() => setPlayback({ isPlaying: false }), [setPlayback]);
  const seek = useCallback(
    (time: number) => setPlayback({ currentTime: time }),
    [setPlayback],
  );
  const setSpeed = useCallback(
    (speed: 1 | 2 | 4) => setPlayback({ speed }),
    [setPlayback],
  );

  return { play, pause, seek, setSpeed };
}
