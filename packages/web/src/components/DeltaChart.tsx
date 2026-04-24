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
