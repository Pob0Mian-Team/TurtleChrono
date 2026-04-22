import { useRef } from 'react';
import { useSessionStore } from '../store/session-store';
import { useLogLoader } from '../hooks/useLogLoader';
import styles from './Sidebar.module.css';

function formatLapTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

export function Sidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);
  const rawLog = useSessionStore((s) => s.rawLog);
  const gateMode = useSessionStore((s) => s.gateMode);
  const setGateMode = useSessionStore((s) => s.setGateMode);
  const error = useSessionStore((s) => s.error);
  const { loadFile, selectCurrentLap, selectReferenceLap } = useLogLoader();

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
        <p className={styles.empty}>
          {rawLog
            ? 'Set start/finish gate to split laps'
            : 'Load a file to begin'}
        </p>
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
    </div>
  );
}
