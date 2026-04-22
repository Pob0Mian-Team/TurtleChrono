import { useEffect, useRef, useCallback } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { useSessionStore } from '../store/session-store';
import { useLogLoader } from '../hooks/useLogLoader';
import styles from './MapPanel.module.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AMap: any = null;

export function MapPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const gateClickPoints = useRef<{ latitude: number; longitude: number }[]>([]);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const playback = useSessionStore((s) => s.playback);
  const gateMode = useSessionStore((s) => s.gateMode);
  const setGateMode = useSessionStore((s) => s.setGateMode);
  const { setGateAndProcess } = useLogLoader();

  // Load AMap once
  useEffect(() => {
    AMapLoader.load({
      key: import.meta.env.VITE_AMAP_KEY as string,
      version: '2.0',
    }).then((amap: unknown) => {
      AMap = amap;
    });
  }, []);

  // Initialize map when AMap is ready and container exists
  useEffect(() => {
    if (!AMap || !containerRef.current || mapRef.current) return;

    mapRef.current = new AMap.Map(containerRef.current, {
      viewMode: '3D',
      layers: [new AMap.TileLayer.Satellite()],
      zoom: 15,
    });

    mapRef.current.on('click', (e: { lnglat: { getLat: () => number; getLng: () => number } }) => {
      if (!useSessionStore.getState().gateMode) return;
      const lat = e.lnglat.getLat();
      const lng = e.lnglat.getLng();
      gateClickPoints.current.push({ latitude: lat, longitude: lng });
      if (gateClickPoints.current.length === 2) {
        setGateMode(false);
        setGateAndProcess({
          pointA: gateClickPoints.current[0],
          pointB: gateClickPoints.current[1],
        });
        gateClickPoints.current = [];
      }
    });
  }, [AMap, setGateMode, setGateAndProcess]);

  // Draw track polyline colored by delta
  useEffect(() => {
    if (!mapRef.current || !AMap || !session) return;

    if (polylineRef.current) {
      mapRef.current.remove(polylineRef.current);
    }

    const lap = session.laps[currentLapIndex];
    if (!lap) return;

    const path = lap.points.map(
      (p) => new AMap.LngLat(p.longitude, p.latitude),
    );

    polylineRef.current = new AMap.Polyline({
      path,
      strokeColor: '#4ecca3',
      strokeWeight: 3,
      strokeOpacity: 0.9,
    });
    mapRef.current.add(polylineRef.current);
    mapRef.current.setFitView([polylineRef.current]);
  }, [session, currentLapIndex]);

  // Moving position marker during playback
  useEffect(() => {
    if (!mapRef.current || !AMap || !session) return;

    const lap = session.laps[currentLapIndex];
    if (!lap || lap.points.length === 0) return;

    if (!markerRef.current) {
      markerRef.current = new AMap.CircleMarker({
        radius: 6,
        fillColor: '#e94560',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      });
      mapRef.current.add(markerRef.current);
    }

    const targetTime = lap.points[0].timestampMs + playback.currentTime;
    let closest = lap.points[0];
    for (const p of lap.points) {
      if (Math.abs(p.timestampMs - targetTime) < Math.abs(closest.timestampMs - targetTime)) {
        closest = p;
      }
    }

    markerRef.current.setCenter([closest.longitude, closest.latitude]);
  }, [session, currentLapIndex, playback.currentTime]);

  // Draw unsplit trace when no laps
  useEffect(() => {
    if (!mapRef.current || !AMap || !session) return;
    if (session.laps.length > 0) return;

    if (polylineRef.current) {
      mapRef.current.remove(polylineRef.current);
    }

    const path = session.points.map(
      (p) => new AMap.LngLat(p.longitude, p.latitude),
    );

    if (path.length > 0) {
      polylineRef.current = new AMap.Polyline({
        path,
        strokeColor: '#888',
        strokeWeight: 2,
        strokeOpacity: 0.6,
        strokeStyle: 'dashed',
      });
      mapRef.current.add(polylineRef.current);
      mapRef.current.setFitView([polylineRef.current]);
    }
  }, [session, session?.laps.length]);

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>Load a log file to view the map</div>
      </div>
    );
  }

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      {gateMode && (
        <div className={styles.gateHint}>
          Click two points on the map to set the start/finish gate
        </div>
      )}
      <div
        ref={containerRef}
        className={styles.map}
        style={{ cursor: gateMode ? 'crosshair' : 'default' }}
      />
    </div>
  );
}
