import { useRef, useEffect } from 'react';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useSessionStore } from '../store/session-store';
import styles from './ChartPanel.module.css';

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const speedSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const deltaSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const refSpeedSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);
  const lapDelta = useSessionStore((s) => s.lapDelta);
  const playback = useSessionStore((s) => s.playback);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#16213e' },
        textColor: '#888',
      },
      grid: {
        vertLines: { color: '#1a3a6a' },
        horzLines: { color: '#1a3a6a' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#1a3a6a' },
      timeScale: { borderColor: '#1a3a6a', timeVisible: false },
    });

    chartRef.current = chart;

    const speedSeries = chart.addAreaSeries({
      lineColor: '#4ecca3',
      topColor: 'rgba(78, 204, 163, 0.3)',
      bottomColor: 'rgba(78, 204, 163, 0.0)',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (p: number) => `${p.toFixed(0)} km/h` },
    });
    speedSeriesRef.current = speedSeries;

    const deltaSeries = chart.addHistogramSeries({
      priceFormat: { type: 'custom', formatter: (p: number) => `${(p / 1000).toFixed(2)}s` },
      priceScaleId: 'delta',
    });

    chart.priceScale('delta').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    });
    deltaSeriesRef.current = deltaSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update data when lap/delta changes
  useEffect(() => {
    if (!chartRef.current || !speedSeriesRef.current || !session) return;

    const lap = session.laps[currentLapIndex];
    if (!lap || lap.points.length === 0) return;

    const speedData = lap.points.map((p, i) => ({
      time: i as unknown as string,
      value: p.speedKmh,
    }));
    speedSeriesRef.current.setData(speedData as never);

    // Reference lap overlay
    if (refSpeedSeriesRef.current) {
      chartRef.current.removeSeries(refSpeedSeriesRef.current);
      refSpeedSeriesRef.current = null;
    }

    if (referenceLapIndex !== null && referenceLapIndex !== currentLapIndex) {
      const refLap = session.laps[referenceLapIndex];
      if (refLap) {
        const refSeries = chartRef.current.addLineSeries({
          color: 'rgba(233, 69, 96, 0.3)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const refData = refLap.points.map((p, i) => ({
          time: i as unknown as string,
          value: p.speedKmh,
        }));
        refSeries.setData(refData as never);
        refSpeedSeriesRef.current = refSeries;
      }
    }

    // Delta histogram
    if (deltaSeriesRef.current) {
      if (lapDelta && lapDelta.points.length > 0) {
        const deltaData = lapDelta.points.map((dp, i) => ({
          time: i as unknown as string,
          value: dp.deltaMs,
          color: dp.deltaMs <= 0 ? 'rgba(78, 204, 163, 0.6)' : 'rgba(233, 69, 96, 0.6)',
        }));
        deltaSeriesRef.current.setData(deltaData as never);
      } else {
        deltaSeriesRef.current.setData([]);
      }
    }
  }, [session, currentLapIndex, referenceLapIndex, lapDelta]);

  // Move crosshair to playback position
  useEffect(() => {
    if (!chartRef.current || !session) return;
    const lap = session.laps[currentLapIndex];
    if (!lap || lap.points.length === 0) return;

    const targetTime = lap.points[0].timestampMs + playback.currentTime;
    let closestIdx = 0;
    for (let i = 0; i < lap.points.length; i++) {
      if (Math.abs(lap.points[i].timestampMs - targetTime) < Math.abs(lap.points[closestIdx].timestampMs - targetTime)) {
        closestIdx = i;
      }
    }

    chartRef.current.setCrosshairPosition(
      lap.points[closestIdx].speedKmh,
      closestIdx as unknown as string,
      speedSeriesRef.current!,
    );
  }, [session, currentLapIndex, playback.currentTime]);

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>Load a log file to view charts</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.chart} />
    </div>
  );
}
