import { useEffect, useRef } from 'react';
import type uPlot from 'uplot';
import { useSessionStore } from '../store/session-store';

export function useChartScrub(
  chartRef: React.RefObject<uPlot | null>,
  distancesRef: React.RefObject<number[]>,
) {
  const setPlayback = useSessionStore((s) => s.setPlayback);
  const sessionRef = useRef(useSessionStore.getState().session);
  const currentLapIndexRef = useRef(useSessionStore.getState().currentLapIndex);

  useEffect(() => {
    const unsub = useSessionStore.subscribe((state) => {
      sessionRef.current = state.session;
      currentLapIndexRef.current = state.currentLapIndex;
    });
    return unsub;
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const over = chart.over;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      over.setPointerCapture(e.pointerId);
      scrubAtPixel(e.offsetX);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      scrubAtPixel(e.offsetX);
    };

    const onPointerUp = () => {
      dragging = false;
    };

    function scrubAtPixel(pixelX: number) {
      const c = chartRef.current;
      const sess = sessionRef.current;
      const curIdx = currentLapIndexRef.current;
      if (!sess || !c) return;
      const lap = sess.laps[curIdx];
      const pts = lap ? lap.points : sess.points;
      if (!pts || pts.length === 0 || !distancesRef.current || distancesRef.current.length === 0) return;

      try {
        const distance = c.posToVal(pixelX, 'x');
        const clickDist = distance + pts[0].distanceFromStart;
        let closest = pts[0];
        for (const p of pts) {
          if (
            Math.abs(p.distanceFromStart - clickDist) <
            Math.abs(closest.distanceFromStart - clickDist)
          ) {
            closest = p;
          }
        }
        setPlayback({ currentTime: closest.timestampMs - pts[0].timestampMs });
      } catch {
      }
    }

    over.addEventListener('pointerdown', onPointerDown);
    over.addEventListener('pointermove', onPointerMove);
    over.addEventListener('pointerup', onPointerUp);

    return () => {
      over.removeEventListener('pointerdown', onPointerDown);
      over.removeEventListener('pointermove', onPointerMove);
      over.removeEventListener('pointerup', onPointerUp);
    };
  }, [chartRef, distancesRef, setPlayback]);
}
