import { useEffect, useRef, useCallback } from 'react';
import type uPlot from 'uplot';
import { useSessionStore } from '../store/session-store';

export function usePlaybackCrosshair(
  chartRef: React.RefObject<uPlot | null>,
  distancesRef: React.RefObject<number[]>,
  vLineRef: React.RefObject<HTMLDivElement | null>,
  tooltipRef: React.RefObject<HTMLDivElement | null>,
  renderTooltip: (speedKmh: number, refSpeedKmh?: number) => string,
) {
  const sessionRef = useRef(useSessionStore.getState().session);
  const currentLapIndexRef = useRef(useSessionStore.getState().currentLapIndex);
  const referenceLapIndexRef = useRef(useSessionStore.getState().referenceLapIndex);
  const playbackRef = useRef(useSessionStore.getState().playback);

  useEffect(() => {
    const unsub = useSessionStore.subscribe((state) => {
      sessionRef.current = state.session;
      currentLapIndexRef.current = state.currentLapIndex;
      referenceLapIndexRef.current = state.referenceLapIndex;
      playbackRef.current = state.playback;
    });
    return unsub;
  }, []);

  const positionVLine = useCallback(() => {
    const chart = chartRef.current;
    const vLine = vLineRef.current;
    const tooltip = tooltipRef.current;
    const sess = sessionRef.current;
    const curIdx = currentLapIndexRef.current;
    const refIdx = referenceLapIndexRef.current;
    const pb = playbackRef.current;
    if (!chart || !vLine || !tooltip || !sess) return;

    const lap = sess.laps[curIdx];
    const points = lap ? lap.points : sess.points;
    if (!points || points.length === 0 || !distancesRef.current || distancesRef.current.length === 0) {
      vLine.style.display = 'none';
      tooltip.style.display = 'none';
      return;
    }

    const targetTime = points[0].timestampMs + pb.currentTime;
    let closestIdx = 0;
    for (let i = 1; i < points.length; i++) {
      if (
        Math.abs(points[i].timestampMs - targetTime) <
        Math.abs(points[closestIdx].timestampMs - targetTime)
      ) {
        closestIdx = i;
      }
    }

    const distance =
      points[closestIdx].distanceFromStart - points[0].distanceFromStart;

    try {
      const xPos = chart.valToPos(distance, 'x');
      vLine.style.display = 'block';
      vLine.style.left = xPos + 'px';

      let refSpeed: number | undefined;
      if (refIdx !== null && refIdx !== curIdx && sess.laps[refIdx]) {
        const refLap = sess.laps[refIdx];
        const refDist = distance + refLap.points[0].distanceFromStart;
        let refClosest = refLap.points[0];
        for (const p of refLap.points) {
          if (
            Math.abs(p.distanceFromStart - refDist) <
            Math.abs(refClosest.distanceFromStart - refDist)
          ) {
            refClosest = p;
          }
        }
        refSpeed = refClosest.speedKmh;
      }

      tooltip.innerHTML = renderTooltip(points[closestIdx].speedKmh, refSpeed);
      tooltip.style.display = 'block';
      tooltip.style.left = xPos + 8 + 'px';
    } catch {
      vLine.style.display = 'none';
      tooltip.style.display = 'none';
    }
  }, [chartRef, distancesRef, vLineRef, tooltipRef, renderTooltip]);

  useEffect(() => {
    positionVLine();
  }, [positionVLine]);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);
  const currentTime = useSessionStore((s) => s.playback.currentTime);

  useEffect(() => {
    positionVLine();
  }, [session, currentLapIndex, referenceLapIndex, currentTime, positionVLine]);

  return positionVLine;
}
