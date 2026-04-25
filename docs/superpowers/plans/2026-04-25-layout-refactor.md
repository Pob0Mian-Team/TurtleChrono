# Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the app layout to a three-column grid (Sidebar | Left Column | Charts), split the combined speed+delta chart into independent chart components, and add sidebar toggle chips for chart visibility.

**Architecture:** Extract shared chart logic (data building, scrub interaction, crosshair positioning) into utility functions and hooks. Replace the single `ChartPanel` with `SpeedChart` and `DeltaChart` components rendered by a `ChartContainer`. Add `enabledCharts` state to the Zustand store with toggle chips in the sidebar. Rewrite the App CSS grid to the new three-column layout.

**Tech Stack:** React 18, Zustand, uPlot, CSS Modules, TypeScript, Vite

---

### Task 1: Add ChartType and enabledCharts to Zustand store

**Files:**
- Modify: `packages/web/src/store/session-store.ts`

- [ ] **Step 1: Add ChartType, enabledCharts, and toggleChart to the store**

Replace the entire contents of `packages/web/src/store/session-store.ts` with:

```ts
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
  focusedPanel: string | null;
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
  setFocusedPanel: (panel: string | null) => void;
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
  focusedPanel: null as string | null,
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
  setFocusedPanel: (focusedPanel) => set({ focusedPanel }),
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
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/store/session-store.ts
git commit -m "feat: add ChartType and enabledCharts to session store"
```

---

### Task 2: Extract shared chart utilities

**Files:**
- Create: `packages/web/src/utils/chart-helpers.ts`

- [ ] **Step 1: Create chart-helpers.ts with shared logic**

Create `packages/web/src/utils/chart-helpers.ts` with:

```ts
export function buildSpeedData(
  points: { distanceFromStart: number; speedKmh: number }[],
): { distances: number[]; speeds: number[] } {
  if (points.length === 0) return { distances: [], speeds: [] };

  const distances: number[] = [];
  const speeds: number[] = [];
  let lastDist = -1;
  for (const p of points) {
    const d = Math.round(p.distanceFromStart - points[0].distanceFromStart);
    if (d <= lastDist) continue;
    lastDist = d;
    distances.push(d);
    speeds.push(p.speedKmh);
  }
  return { distances, speeds };
}

export function buildDeltaData(
  distances: number[],
  deltaPoints: { distance: number; deltaMs: number }[] | null | undefined,
): (number | null)[] {
  const deltas: (number | null)[] = new Array(distances.length).fill(null);
  if (!deltaPoints || deltaPoints.length === 0) return deltas;

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
  return deltas;
}

export function buildRefSpeedData(
  distances: number[],
  refPoints: { distanceFromStart: number; speedKmh: number }[],
): (number | null)[] {
  const refBase = refPoints[0].distanceFromStart;
  const refMap = new Map<number, number>();
  let refLastDist = -1;
  for (const p of refPoints) {
    const d = Math.round(p.distanceFromStart - refBase);
    if (d <= refLastDist) continue;
    refLastDist = d;
    refMap.set(d, p.speedKmh);
  }
  return distances.map((d) => refMap.get(d) ?? null);
}

export function formatDistance(d: number): string {
  return d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${d.toFixed(0)}m`;
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/utils/chart-helpers.ts
git commit -m "feat: extract shared chart helper utilities"
```

---

### Task 3: Create shared chart hooks

**Files:**
- Create: `packages/web/src/hooks/useChartScrub.ts`
- Create: `packages/web/src/hooks/usePlaybackCrosshair.ts`

- [ ] **Step 1: Create useChartScrub hook**

Create `packages/web/src/hooks/useChartScrub.ts` with:

```ts
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
        // ignore out-of-bounds
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
```

- [ ] **Step 2: Create usePlaybackCrosshair hook**

Create `packages/web/src/hooks/usePlaybackCrosshair.ts` with:

```ts
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
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/hooks/useChartScrub.ts packages/web/src/hooks/usePlaybackCrosshair.ts
git commit -m "feat: extract shared chart hooks (scrub + crosshair)"
```

---

### Task 4: Create SpeedChart component

**Files:**
- Create: `packages/web/src/components/SpeedChart.tsx`
- Create: `packages/web/src/components/SpeedChart.module.css`

- [ ] **Step 1: Create SpeedChart.module.css**

Create `packages/web/src/components/SpeedChart.module.css` with:

```css
.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #16213e;
  border-radius: 4px;
  overflow: hidden;
}

.header {
  padding: 4px 10px;
  font-size: 11px;
  color: #4ecca3;
  background: #1a2a4a;
  border-bottom: 1px solid #1a3a6a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.chartWrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.chart {
  width: 100%;
  height: 100%;
}

.noData {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 12px;
}

.vLine {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #758696;
  pointer-events: none;
  z-index: 5;
}

.tooltip {
  position: absolute;
  background: rgba(22, 33, 62, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
  font-size: 11px;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
  top: 8px;
}
```

- [ ] **Step 2: Create SpeedChart.tsx**

Create `packages/web/src/components/SpeedChart.tsx` with:

```ts
import { useRef, useEffect, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSessionStore } from '../store/session-store';
import { buildSpeedData, buildRefSpeedData, formatDistance } from '../utils/chart-helpers';
import { useChartScrub } from '../hooks/useChartScrub';
import { usePlaybackCrosshair } from '../hooks/usePlaybackCrosshair';
import styles from './SpeedChart.module.css';

export function SpeedChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const distancesRef = useRef<number[]>([]);
  const vLineRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const refSeriesIdxRef = useRef<number | null>(null);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);

  const getPoints = useCallback(() => {
    if (!session) return null;
    const lap = session.laps[currentLapIndex];
    return lap ? lap.points : session.points;
  }, [session, currentLapIndex]);

  const renderTooltip = useCallback(
    (speedKmh: number, refSpeedKmh?: number) => {
      let html = `<div style="color:#4ecca3">${speedKmh.toFixed(0)} km/h</div>`;
      if (refSpeedKmh !== undefined) {
        html += `<div style="color:#e94560">${refSpeedKmh.toFixed(0)} km/h</div>`;
      }
      return html;
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

  useChartScrub(chartRef, distancesRef);

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

    return () => {
      ro.disconnect();
      vLine.remove();
      tooltip.remove();
      chart.destroy();
      chartRef.current = null;
      vLineRef.current = null;
      tooltipRef.current = null;
    };
  }, [positionVLine]);

  useEffect(() => {
    const points = getPoints();
    if (!chartRef.current || !points || points.length === 0) return;

    const { distances, speeds } = buildSpeedData(points);
    distancesRef.current = distances;

    const data: (number | null)[][] = [distances, speeds];

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
      const refSpeeds = buildRefSpeedData(distances, refLap.points);
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
  }, [session, currentLapIndex, referenceLapIndex, getPoints, positionVLine]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>Speed (km/h)</div>
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
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/SpeedChart.tsx packages/web/src/components/SpeedChart.module.css
git commit -m "feat: create SpeedChart component"
```

---

### Task 5: Create DeltaChart component

**Files:**
- Create: `packages/web/src/components/DeltaChart.tsx`
- Create: `packages/web/src/components/DeltaChart.module.css`

- [ ] **Step 1: Create DeltaChart.module.css**

Create `packages/web/src/components/DeltaChart.module.css` with:

```css
.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #16213e;
  border-radius: 4px;
  overflow: hidden;
}

.header {
  padding: 4px 10px;
  font-size: 11px;
  color: #4ecca3;
  background: #1a2a4a;
  border-bottom: 1px solid #1a3a6a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.chartWrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.chart {
  width: 100%;
  height: 100%;
}

.noData {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 12px;
}

.vLine {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #758696;
  pointer-events: none;
  z-index: 5;
}

.tooltip {
  position: absolute;
  background: rgba(22, 33, 62, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
  font-size: 11px;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
  top: 8px;
}
```

- [ ] **Step 2: Create DeltaChart.tsx**

Create `packages/web/src/components/DeltaChart.tsx` with:

```ts
import { useRef, useEffect, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSessionStore } from '../store/session-store';
import { buildSpeedData, buildDeltaData, formatDistance } from '../utils/chart-helpers';
import { useChartScrub } from '../hooks/useChartScrub';
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

  const getPoints = useCallback(() => {
    if (!session) return null;
    const lap = session.laps[currentLapIndex];
    return lap ? lap.points : session.points;
  }, [session, currentLapIndex]);

  const renderTooltip = useCallback(
    (_speedKmh: number, _refSpeedKmh?: number) => {
      return `<div style="color:#4ecca3">Delta</div>`;
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

  useChartScrub(chartRef, distancesRef);

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
          size: (self: uPlot, values: string[] | undefined, axisIdx: number, cycleNum: number) => {
            const axis = self.axes[axisIdx];
            if (cycleNum > 1) return axis._size;
            if (!values || values.length === 0) return axis._size;
            const fontHeight = axis.font[1] / devicePixelRatio;
            return Math.ceil(axis.ticks.size + axis.gap + fontHeight + 2);
          },
        },
        {
          scale: 'delta',
          side: 3,
          stroke: '#888',
          grid: { stroke: '#1a3a6a' },
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

    return () => {
      ro.disconnect();
      vLine.remove();
      tooltip.remove();
      chart.destroy();
      chartRef.current = null;
      vLineRef.current = null;
      tooltipRef.current = null;
    };
  }, [positionVLine]);

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
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/DeltaChart.tsx packages/web/src/components/DeltaChart.module.css
git commit -m "feat: create DeltaChart component"
```

---

### Task 6: Create ChartContainer component

**Files:**
- Create: `packages/web/src/components/ChartContainer.tsx`
- Create: `packages/web/src/components/ChartContainer.module.css`

- [ ] **Step 1: Create ChartContainer.module.css**

Create `packages/web/src/components/ChartContainer.module.css` with:

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  overflow: hidden;
}

.chartSlot {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 2: Create ChartContainer.tsx**

Create `packages/web/src/components/ChartContainer.tsx` with:

```ts
import { useSessionStore, type ChartType } from '../store/session-store';
import { SpeedChart } from './SpeedChart';
import { DeltaChart } from './DeltaChart';
import styles from './ChartContainer.module.css';

const CHART_REGISTRY: Record<ChartType, { label: string; component: React.ComponentType }> = {
  speed: { label: 'Speed', component: SpeedChart },
  delta: { label: 'Delta', component: DeltaChart },
};

export function ChartContainer() {
  const enabledCharts = useSessionStore((s) => s.enabledCharts);

  return (
    <div className={styles.container}>
      {enabledCharts.map((type) => {
        const entry = CHART_REGISTRY[type];
        const ChartComponent = entry.component;
        return (
          <div key={type} className={styles.chartSlot}>
            <ChartComponent />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/ChartContainer.tsx packages/web/src/components/ChartContainer.module.css
git commit -m "feat: create ChartContainer with chart registry"
```

---

### Task 7: Add chart toggle chips to Sidebar

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx`
- Modify: `packages/web/src/components/Sidebar.module.css`

- [ ] **Step 1: Add chip styles to Sidebar.module.css**

Append to `packages/web/src/components/Sidebar.module.css`:

```css
.chip {
  padding: 4px 10px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: bold;
  text-align: left;
}

.chipEnabled {
  background: #4ecca3;
  color: #1a1a2e;
}

.chipDisabled {
  background: #333;
  color: #666;
}

.chipsContainer {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

- [ ] **Step 2: Add chart toggle section to Sidebar.tsx**

Replace the full contents of `packages/web/src/components/Sidebar.tsx` with:

```ts
import { useRef } from 'react';
import { useSessionStore, type ChartType } from '../store/session-store';
import { useLogLoader } from '../hooks/useLogLoader';
import styles from './Sidebar.module.css';

function formatLapTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

const ALL_CHART_TYPES: ChartType[] = ['speed', 'delta'];
const CHART_LABELS: Record<ChartType, string> = {
  speed: 'Speed',
  delta: 'Delta',
};

export function Sidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);
  const rawLog = useSessionStore((s) => s.rawLog);
  const gateMode = useSessionStore((s) => s.gateMode);
  const setGateMode = useSessionStore((s) => s.setGateMode);
  const error = useSessionStore((s) => s.error);
  const enabledCharts = useSessionStore((s) => s.enabledCharts);
  const toggleChart = useSessionStore((s) => s.toggleChart);
  const { loadFile, selectCurrentLap, selectReferenceLap, treatAsSingleLap } = useLogLoader();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.bin')) loadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const laps = session?.laps ?? [];

  return (
    <div
      className={styles.sidebar}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <button className={styles.loadBtn} onClick={() => fileInputRef.current?.click()}>
        Load .bin File
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {error && <p className={styles.error}>{error}</p>}

      {rawLog && !session && (
        <>
          {!import.meta.env.VITE_AMAP_KEY && (
            <p className={styles.error}>
              AMap API key not configured. Set VITE_AMAP_KEY in .env to enable gate selection.
            </p>
          )}
          <button
            className={`${styles.gateBtn} ${gateMode ? styles.active : ''}`}
            onClick={() => setGateMode(!gateMode)}
            disabled={!import.meta.env.VITE_AMAP_KEY}
          >
            {gateMode ? 'Cancel Gate' : 'Set S/F Gate'}
          </button>
        </>
      )}

      <p className={styles.sectionTitle}>Laps</p>
      {laps.length === 0 ? (
        <>
          <p className={styles.empty}>
            {rawLog
              ? 'Set start/finish gate to split laps'
              : 'Load a file to begin'}
          </p>
          {rawLog && (
            <button className={styles.gateBtn} onClick={treatAsSingleLap}>
              Treat as Single Lap
            </button>
          )}
        </>
      ) : (
        <ul className={styles.lapList}>
          {laps.map((lap, i) => (
            <li
              key={i}
              className={`${styles.lapItem} ${
                i === currentLapIndex ? styles.current : ''
              } ${
                i === referenceLapIndex ? styles.reference : ''
              } ${
                i === session!.bestLapIndex ? styles.best : ''
              }`}
              onClick={() => selectCurrentLap(i)}
            >
              <span>
                L{i + 1}
                {i === session!.bestLapIndex ? ' ★' : ''}
              </span>
              <span className={styles.lapTime}>{formatLapTime(lap.durationMs)}</span>
              <button
                className={styles.refBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  selectReferenceLap(i === referenceLapIndex ? null : i);
                }}
              >
                {i === referenceLapIndex ? 'Unref' : 'Ref'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.sectionTitle}>Charts</p>
      <div className={styles.chipsContainer}>
        {ALL_CHART_TYPES.map((type) => {
          const enabled = enabledCharts.includes(type);
          return (
            <button
              key={type}
              className={`${styles.chip} ${enabled ? styles.chipEnabled : styles.chipDisabled}`}
              onClick={() => toggleChart(type)}
            >
              {enabled ? '✓ ' : ''}{CHART_LABELS[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/Sidebar.tsx packages/web/src/components/Sidebar.module.css
git commit -m "feat: add chart toggle chips to sidebar"
```

---

### Task 8: Rewrite App layout (App.tsx + App.module.css)

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/App.module.css`

- [ ] **Step 1: Rewrite App.module.css**

Replace the full contents of `packages/web/src/App.module.css` with:

```css
.app {
  display: grid;
  grid-template-columns: 220px auto 1fr;
  grid-template-rows: 1fr auto;
  column-gap: 4px;
  padding: 4px;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.sidebar {
  grid-column: 1;
  grid-row: 1 / -1;
}

.leftColumn {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.mapPanel {
  height: 30vh;
  aspect-ratio: 1;
}

.gforcePanel {
  height: 30vh;
  aspect-ratio: 1;
}

.lapInfoPanel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.chartColumn {
  grid-column: 3;
  grid-row: 1;
  min-height: 0;
}

.playbackBar {
  grid-column: 2 / -1;
  grid-row: 2;
}
```

- [ ] **Step 2: Rewrite App.tsx**

Replace the full contents of `packages/web/src/App.tsx` with:

```ts
import { FocusWrapper } from './components/FocusWrapper';
import { Sidebar } from './components/Sidebar';
import { MapPanel } from './components/MapPanel';
import { GForcePanel } from './components/GForcePanel';
import { ChartContainer } from './components/ChartContainer';
import { PlaybackBar } from './components/PlaybackBar';
import { LapInfoPanel } from './components/LapInfoPanel';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.app}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>
      <div className={styles.leftColumn}>
        <FocusWrapper panelId="map" className={styles.mapPanel}>
          <MapPanel />
        </FocusWrapper>
        <FocusWrapper panelId="gforce" className={styles.gforcePanel}>
          <GForcePanel />
        </FocusWrapper>
        <div className={styles.lapInfoPanel}>
          <LapInfoPanel />
        </div>
      </div>
      <div className={styles.chartColumn}>
        <ChartContainer />
      </div>
      <div className={styles.playbackBar}>
        <PlaybackBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/App.module.css
git commit -m "feat: rewrite layout to three-column grid"
```

---

### Task 9: Remove old ChartPanel

**Files:**
- Delete: `packages/web/src/components/ChartPanel.tsx`
- Delete: `packages/web/src/components/ChartPanel.module.css`

- [ ] **Step 1: Delete ChartPanel files**

```bash
rm packages/web/src/components/ChartPanel.tsx packages/web/src/components/ChartPanel.module.css
```

- [ ] **Step 2: Verify no imports reference ChartPanel**

Run: `grep -r "ChartPanel" packages/web/src/`
Expected: No results.

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore: remove old ChartPanel component"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run web tests**

Run: `npm run test:web`
Expected: All tests pass (or no test runner configured).

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Start dev server and visually verify**

Run: `npm run dev`

Open http://localhost:5173 and verify:
1. Sidebar is on the left (220px)
2. Left column has Map (square, 30vh) → G-Force (square, 30vh) → Lap Info (fills remaining)
3. Right column shows Speed chart and Delta chart (split equally)
4. Sidebar has "Charts" section with Speed and Delta toggle chips
5. Clicking a chip toggles the corresponding chart on/off
6. At least one chart stays enabled
7. Playback scrubbing works on both charts
8. Playback crosshair appears on both charts
9. Reference lap speed line appears on Speed chart when a ref lap is selected
10. FocusWrapper expand/collapse works on Map and G-Force
