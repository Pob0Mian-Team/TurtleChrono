import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../store/session-store';

export function usePlayback() {
  const playback = useSessionStore((s) => s.playback);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const session = useSessionStore((s) => s.session);
  const setPlayback = useSessionStore((s) => s.setPlayback);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const currentTimeRef = useRef(playback.currentTime);
  currentTimeRef.current = playback.currentTime;
  const speedRef = useRef(playback.speed);
  speedRef.current = playback.speed;

  const lap = session?.laps[currentLapIndex];
  const lapDuration = lap?.durationMs ?? 0;

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaMs = (timestamp - lastTimeRef.current) * speedRef.current;
      lastTimeRef.current = timestamp;

      const newTime = currentTimeRef.current + deltaMs;
      currentTimeRef.current = newTime;

      if (newTime >= lapDuration) {
        setPlayback({ currentTime: lapDuration, isPlaying: false });
        return;
      }

      setPlayback({ currentTime: newTime });
      rafRef.current = requestAnimationFrame(animate);
    },
    [lapDuration, setPlayback],
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
