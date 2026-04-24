import { useRef, useEffect, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSessionStore } from '../store/session-store';
import styles from './ChartPanel.module.css';

function buildChartData(
  points: { distanceFromStart: number; speedKmh: number }[],
  deltaPoints?: { distance: number; deltaMs: number }[] | null,
): { data: (number | null)[][]; distances: number[] } {
  if (points.length === 0) return { data: [[], [], []], distances: [] };

  const distances: number[] = [];
  const speeds: number[] = [];
  const deltas: (number | null)[] = [];

  let lastDist = -1;
  for (const p of points) {
    const d = Math.round(p.distanceFromStart - points[0].distanceFromStart);
    if (d <= lastDist) continue;
    lastDist = d;
    distances.push(d);
    speeds.push(p.speedKmh);
    deltas.push(null);
  }

  if (deltaPoints && deltaPoints.length > 0) {
    let deltaIdx = 0;
    let deltaLastDist = -1;
    const filtered: { d: number; v: number }[] = [];
    for (const dp of deltaPoints) {
      const d = Math.round(dp.distance);
      if (d <= deltaLastDist) continue;
      deltaLastDist = d;
      filtered.push({ d, v: dp.deltaMs });
    }

    for (let i = 0; i < distances.length; i++) {
      while (
        deltaIdx < filtered.length - 1 &&
        Math.abs(filtered[deltaIdx + 1].d - distances[i]) <=
          Math.abs(filtered[deltaIdx].d - distances[i])
      ) {
        deltaIdx++;
      }
      if (deltaIdx < filtered.length) {
        const diff = Math.abs(filtered[deltaIdx].d - distances[i]);
        if (diff <= 5) {
          deltas[i] = filtered[deltaIdx].v;
        }
      }
    }
  }

  return {
    data: [distances, speeds, deltas],
    distances,
  };
}

function formatDistance(d: number): string {
  return d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${d.toFixed(0)}m`;
}

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const dataRef = useRef<(number | null)[][]>([[], [], []]);
  const distancesRef = useRef<number[]>([]);
  const vLineRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const refSeriesIdxRef = useRef<number | null>(null);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);
  const lapDelta = useSessionStore((s) => s.lapDelta);
  const playback = useSessionStore((s) => s.playback);
  const setPlayback = useSessionStore((s) => s.setPlayback);

  const sessionRef = useRef(session);
  const currentLapIndexRef = useRef(currentLapIndex);
  const referenceLapIndexRef = useRef(referenceLapIndex);
  const playbackRef = useRef(playback);
  sessionRef.current = session;
  currentLapIndexRef.current = currentLapIndex;
  referenceLapIndexRef.current = referenceLapIndex;
  playbackRef.current = playback;

  const getPoints = useCallback(() => {
    if (!session) return null;
    const lap = session.laps[currentLapIndex];
    return lap ? lap.points : session.points;
  }, [session, currentLapIndex]);

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
    if (!points || points.length === 0 || distancesRef.current.length === 0) {
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

      let html = `<div style="color:#4ecca3">${points[closestIdx].speedKmh.toFixed(0)} km/h</div>`;

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
        html += `<div style="color:#e94560">${refClosest.speedKmh.toFixed(0)} km/h</div>`;
      }

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      tooltip.style.left = xPos + 8 + 'px';
    } catch {
      vLine.style.display = 'none';
      tooltip.style.display = 'none';
    }
  }, []);

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
        speed: { auto: true },
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
          size: (self: uPlot, values: string[] | undefined, axisIdx: number, cycleNum: number) => {
            const axis = self.axes[axisIdx];
            if (cycleNum > 1) return axis._size;
            if (!values || values.length === 0) return axis._size;
            const fontHeight = axis.font[1] / devicePixelRatio;
            return Math.ceil(axis.ticks.size + axis.gap + fontHeight + 2);
          },
        },
        {
          scale: 'speed',
          side: 3,
          stroke: '#888',
          grid: { stroke: '#1a3a6a' },
          values: (_u: uPlot, ticks: number[]) =>
            ticks.map((v) => `${v.toFixed(0)} km/h`),
          size: (self: uPlot, values: string[] | undefined, axisIdx: number, cycleNum: number) => {
            const axis = self.axes[axisIdx];
            if (cycleNum > 1) return axis._size;
            const longest = (values ?? []).reduce((a, v) => (v.length > a.length ? v : a), '');
            if (!longest) return axis._size;
            self.ctx.font = axis.font[0];
            return Math.ceil(axis.ticks.size + axis.gap + self.ctx.measureText(longest).width / devicePixelRatio + 4);
          },
        },
        {
          scale: 'delta',
          side: 1,
          stroke: '#888',
          grid: { show: false },
          values: (_u: uPlot, ticks: number[]) =>
            ticks.map((v) => `${(v / 1000).toFixed(2)}s`),
          size: (self: uPlot, values: string[] | undefined, axisIdx: number, cycleNum: number) => {
            const axis = self.axes[axisIdx];
            if (cycleNum > 1) return axis._size;
            const longest = (values ?? []).reduce((a, v) => (v.length > a.length ? v : a), '');
            if (!longest) return axis._size;
            self.ctx.font = axis.font[0];
            return Math.ceil(axis.ticks.size + axis.gap + self.ctx.measureText(longest).width / devicePixelRatio + 4);
          },
        },
      ],
      series: [
        {},
        {
          label: 'Speed',
          stroke: '#4ecca3',
          width: 2,
          scale: 'speed',
          value: (_u: uPlot, v: number | null) =>
            v == null ? '' : `${v.toFixed(0)} km/h`,
        },
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

    const chart = new uPlot(opts, [[], [], []], container);
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

    return () => {
      ro.disconnect();
      vLine.remove();
      tooltip.remove();
      chart.destroy();
      chartRef.current = null;
      vLineRef.current = null;
      tooltipRef.current = null;
    };
  }, []);

  useEffect(() => {
    const points = getPoints();
    if (!chartRef.current || !points || points.length === 0) return;

    const { data, distances } = buildChartData(points, lapDelta?.points);
    dataRef.current = data;
    distancesRef.current = distances;

    if (refSeriesIdxRef.current !== null) {
      chartRef.current.delSeries(refSeriesIdxRef.current);
      data.splice(refSeriesIdxRef.current, 1);
      refSeriesIdxRef.current = null;
    }

    if (
      referenceLapIndex !== null &&
      referenceLapIndex !== currentLapIndex &&
      session &&
      session.laps[referenceLapIndex]
    ) {
      const refLap = session.laps[referenceLapIndex];
      const refBase = refLap.points[0].distanceFromStart;
      const refSpeeds: (number | null)[] = [];
      const refMap = new Map<number, number>();
      let refLastDist = -1;
      for (const p of refLap.points) {
        const d = Math.round(p.distanceFromStart - refBase);
        if (d <= refLastDist) continue;
        refLastDist = d;
        refMap.set(d, p.speedKmh);
      }
      for (const d of distances) {
        refSpeeds.push(refMap.get(d) ?? null);
      }

      const seriesIdx = data.length;
      data.push(refSpeeds);
      chartRef.current.addSeries(
        {
          label: 'Ref Speed',
          stroke: '#e94560',
          width: 2,
          scale: 'speed',
          value: (_u: uPlot, v: number | null) =>
            v == null ? '' : `${v.toFixed(0)} km/h`,
        },
        seriesIdx,
      );
      refSeriesIdxRef.current = seriesIdx;
    }

    chartRef.current.setData(data as uPlot.AlignedData);
    positionVLine();
  }, [session, currentLapIndex, referenceLapIndex, lapDelta, getPoints, positionVLine]);

  useEffect(() => {
    positionVLine();
  }, [session, currentLapIndex, referenceLapIndex, playback.currentTime, positionVLine]);

  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;

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
    };
  }, []);

  return (
    <div className={styles.container}>
      {!session && (
        <div className={styles.noData}>Load a log file to view charts</div>
      )}
      <div
        ref={containerRef}
        className={styles.chart}
        style={session ? undefined : { visibility: 'hidden' }}
      />
    </div>
  );
}
