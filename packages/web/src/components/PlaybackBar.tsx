import { useSessionStore } from '../store/session-store';
import { usePlayback } from '../hooks/usePlayback';
import styles from './PlaybackBar.module.css';

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(1).padStart(4, '0')}`;
}

export function PlaybackBar() {
  const playback = useSessionStore((s) => s.playback);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const session = useSessionStore((s) => s.session);
  const { play, pause, seek, setSpeed } = usePlayback();

  const lapDuration = session?.laps[currentLapIndex]?.durationMs ?? 0;
  const speeds: (1 | 2 | 4)[] = [1, 2, 4];

  return (
    <div className={styles.bar}>
      <button
        className={styles.playBtn}
        onClick={playback.isPlaying ? pause : play}
      >
        {playback.isPlaying ? '⏸' : '▶'}
      </button>
      <input
        className={styles.scrubber}
        type="range"
        min={0}
        max={lapDuration || 1}
        value={playback.currentTime}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <span className={styles.timeLabel}>
        {formatTime(playback.currentTime)} / {formatTime(lapDuration)}
      </span>
      {speeds.map((s) => (
        <button
          key={s}
          className={`${styles.speedBtn} ${playback.speed === s ? styles.active : ''}`}
          onClick={() => setSpeed(s)}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}
