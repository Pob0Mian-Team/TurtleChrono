import { useSessionStore } from '../store/session-store';
import styles from './LapInfoPanel.module.css';

function formatLapTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

function formatDelta(ms: number): string {
  const prefix = ms >= 0 ? '+' : '';
  return `${prefix}${(ms / 1000).toFixed(3)}s`;
}

export function LapInfoPanel() {
  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const bestLapIndex = useSessionStore((s) => s.session?.bestLapIndex ?? -1);
  const lapDelta = useSessionStore((s) => s.lapDelta);
  const playback = useSessionStore((s) => s.playback);

  if (!session || session.laps.length === 0) {
    return (
      <div className={styles.panel}>
        <span className={styles.noData}>No lap data</span>
      </div>
    );
  }

  const lap = session.laps[currentLapIndex];
  if (!lap) return null;

  const bestLap = session.laps[bestLapIndex];

  let currentSpeed = 0;
  if (lap.points.length > 0) {
    const targetTime = lap.points[0].timestampMs + playback.currentTime;
    let closest = lap.points[0];
    for (const p of lap.points) {
      if (Math.abs(p.timestampMs - targetTime) < Math.abs(closest.timestampMs - targetTime)) {
        closest = p;
      }
    }
    currentSpeed = closest.speedKmh;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.label}>Current</span>
        <span className={styles.value}>
          {formatLapTime(playback.currentTime)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Lap Time</span>
        <span className={styles.value}>
          {formatLapTime(lap.durationMs)}
        </span>
      </div>
      {bestLap && bestLapIndex !== currentLapIndex && (
        <div className={styles.row}>
          <span className={styles.label}>Best</span>
          <span className={`${styles.value} ${styles.best}`}>
            {formatLapTime(bestLap.durationMs)}
          </span>
        </div>
      )}
      {lapDelta && (
        <div className={styles.row}>
          <span className={styles.label}>Delta</span>
          <span
            className={`${styles.value} ${
              lapDelta.totalTimeDeltaMs >= 0 ? styles.deltaPos : styles.deltaNeg
            }`}
          >
            {formatDelta(lapDelta.totalTimeDeltaMs)}
          </span>
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.label}>Speed</span>
        <span className={`${styles.value} ${styles.speed}`}>
          {currentSpeed.toFixed(0)}
          <span style={{ fontSize: 14, fontWeight: 'normal' }}> km/h</span>
        </span>
      </div>
    </div>
  );
}
