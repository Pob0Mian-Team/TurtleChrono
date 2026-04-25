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
          <button className={styles.gateBtn} onClick={treatAsSingleLap}>
            Treat as Single Lap
          </button>
        </>
      )}

      {laps.length > 0 && (
        <>
          <p className={styles.sectionTitle}>Laps</p>
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
                <span className={styles.lapLabel}>
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
        </>
      )}

      <div className={styles.chartsSection}>
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
    </div>
  );
}
