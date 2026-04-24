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
