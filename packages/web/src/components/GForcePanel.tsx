import { useRef, useEffect } from 'react';
import { useSessionStore } from '../store/session-store';
import styles from './GForcePanel.module.css';

const CANVAS_SIZE = 240;
const MAX_G = 2.0;

export function GForcePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const playback = useSessionStore((s) => s.playback);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = CANVAS_SIZE;
    const cx = size / 2;
    const cy = size / 2;
    const scale = (size / 2 - 20) / MAX_G;

    ctx.clearRect(0, 0, size, size);

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0f3460';
    ctx.fill();
    ctx.strokeStyle = '#1a4a8a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = '#1a3a6a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, 10);
    ctx.lineTo(cx, size - 10);
    ctx.moveTo(10, cy);
    ctx.lineTo(size - 10, cy);
    ctx.stroke();

    // Find current G values
    let lateralG = 0;
    let longitudinalG = 0;

    if (session) {
      const lap = session.laps[currentLapIndex];
      if (lap && lap.points.length > 0) {
        const targetTime = lap.points[0].timestampMs + playback.currentTime;
        let closest = lap.points[0];
        for (const p of lap.points) {
          if (Math.abs(p.timestampMs - targetTime) < Math.abs(closest.timestampMs - targetTime)) {
            closest = p;
          }
        }
        lateralG = closest.accel[0] / 9.81;
        longitudinalG = -closest.accel[1] / 9.81;
      }
    }

    const dotX = cx + lateralG * scale;
    const dotY = cy + longitudinalG * scale;

    // Trail
    trailRef.current.push({ x: dotX, y: dotY });
    if (trailRef.current.length > 30) trailRef.current.shift();

    ctx.beginPath();
    for (let i = 0; i < trailRef.current.length - 1; i++) {
      const t = trailRef.current[i];
      const alpha = (i + 1) / trailRef.current.length * 0.5;
      ctx.fillStyle = `rgba(233, 69, 96, ${alpha})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e94560';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [session, currentLapIndex, playback.currentTime]);

  if (!session) {
    return (
      <div className={styles.container}>
        <span className={styles.noData}>No data</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
    </div>
  );
}
