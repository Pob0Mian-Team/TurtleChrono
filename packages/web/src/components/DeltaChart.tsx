import { useRef, useEffect, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSessionStore } from '../store/session-store';
import { buildSpeedData, buildDeltaData, formatDistance } from '../utils/chart-helpers';
import { usePlaybackCrosshair } from '../hooks/usePlaybackCrosshair';
import styles from './DeltaChart.module.css';

export function DeltaChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const distancesRef = useRef<number[]>([]);
  const vLineRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const lapDelta = useSessionStore((s) => s.lapDelta);
  const setPlayback = useSessionStore((s) => s.setPlayback);

  const lapDeltaRef = useRef(lapDelta);
  lapDeltaRef.current = lapDelta;

  const sessionRef = useRef(session);
  const currentLapIndexRef = useRef(currentLapIndex);
  sessionRef.current = session;
  currentLapIndexRef.current = currentLapIndex;

  const getPoints = useCallback(() => {
    if (!session) return null;
    const lap = session.laps[currentLapIndex];
    return lap ? lap.points : session.points;
  }, [session, currentLapIndex]);

  const renderTooltip = useCallback(
    (_speedKmh: number, _refSpeedKmh: number | undefined, distance: number) => {
      const deltas = lapDeltaRef.current?.points;
      if (!deltas || deltas.length === 0) {
        return `<div style="color:#666">No ref lap</div>`;
      }
      let closest = deltas[0];
      for (const d of deltas) {
        if (Math.abs(d.distance - distance) < Math.abs(closest.distance - distance)) {
          closest = d;
        }
      }
      const v = closest.deltaMs;
      const prefix = v >= 0 ? '+' : '';
      return `<div style="color:${v >= 0 ? '#e94560' : '#4ecca3'}">${prefix}${(v / 1000).toFixed(3)}s</div>`;
    },
    [],
  );

  const positionVLine = usePlaybackCrosshair(
    chartRef,
    distancesRef,
    vLineRef,
    tooltipRef,
    renderTooltip,
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const opts: uPlot.Options = {
      width: container.clientWidth,
      height: container.clientHeight,
      cursor: { show: false },
      legend: { show: false },
      padding: [12, 12, 12, 12],
      scales: {
        x: { time: false },
        delta: {
          auto: true,
          range: (_u: uPlot, min: number, max: number) => {
            if (!isFinite(min) || !isFinite(max)) return [-1000, 1000];
            const absMax = Math.max(Math.abs(min), Math.abs(max), 100);
            return [-absMax * 1.2, absMax * 1.2];
          },
        },
      },
      axes: [
        {
          scale: 'x',
          grid: { show: false },
          stroke: '#888',
          values: (_u: uPlot, ticks: number[]) =>
            ticks.map(formatDistance),
          size: 28,
        },
        {
          scale: 'delta',
          side: 3,
          stroke: '#888',
          grid: { stroke: '#1a3a6a' },
          values: (_u: uPlot, ticks: number[]) =>
            ticks.map((v) => `${(v / 1000).toFixed(2)}s`),
          size: 56,
        },
      ],
      series: [
        {},
        {
          label: 'Delta',
          stroke: '#4ecca3',
          width: 1,
          scale: 'delta',
          show: true,
          value: (_u: uPlot, v: number | null) =>
            v == null ? '' : `${(v / 1000).toFixed(2)}s`,
        },
      ],
      hooks: {},
    };

    const chart = new uPlot(opts, [[], []], container);
    chartRef.current = chart;

    const vLine = document.createElement('div');
    vLine.className = styles.vLine;
    chart.over.appendChild(vLine);
    vLineRef.current = vLine;

    const tooltip = document.createElement('div');
    tooltip.className = styles.tooltip;
    tooltip.style.display = 'none';
    chart.over.appendChild(tooltip);
    tooltipRef.current = tooltip;

    const ro = new ResizeObserver(() => {
      chart.setSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      positionVLine();
    });
    ro.observe(container);

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
      if (!pts || pts.length === 0 || distancesRef.current.length === 0) return;
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
      ro.disconnect();
      vLine.remove();
      tooltip.remove();
      chart.destroy();
      chartRef.current = null;
      vLineRef.current = null;
      tooltipRef.current = null;
    };
  }, [positionVLine, setPlayback]);

  useEffect(() => {
    const points = getPoints();
    if (!chartRef.current || !points || points.length === 0) return;

    const { distances } = buildSpeedData(points);
    distancesRef.current = distances;
    const deltas = buildDeltaData(distances, lapDelta?.points);

    chartRef.current.setData([distances, deltas] as uPlot.AlignedData);
    positionVLine();
  }, [session, currentLapIndex, lapDelta, getPoints, positionVLine]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>Time Delta (s)</div>
      {!session && (
        <div className={styles.noData}>Load a log file to view charts</div>
      )}
      <div className={styles.chartWrap}>
        <div
          ref={containerRef}
          className={styles.chart}
          style={session ? undefined : { visibility: 'hidden' }}
        />
      </div>
    </div>
  );
}
