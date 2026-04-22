import { useState, useEffect, useRef, useCallback } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { useSessionStore } from '../store/session-store';
import { useLogLoader } from '../hooks/useLogLoader';
import { wgs84ToGcj02, gcj02ToWgs84 } from '../utils/coords';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gateMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gateLineRef = useRef<any>(null);
  const gateClickPoints = useRef<{ latitude: number; longitude: number }[]>([]);

  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const session = useSessionStore((s) => s.session);
  const rawLog = useSessionStore((s) => s.rawLog);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const playback = useSessionStore((s) => s.playback);
  const gateMode = useSessionStore((s) => s.gateMode);
  const setGateMode = useSessionStore((s) => s.setGateMode);
  const { setGateAndProcess } = useLogLoader();

  // Load AMap once
  useEffect(() => {
    const key = import.meta.env.VITE_AMAP_KEY as string;
    if (!key) {
      setMapError('VITE_AMAP_KEY is not set');
      return;
    }
    AMapLoader.load({
      key,
      version: '2.0',
    }).then((amap: unknown) => {
      AMap = amap;
    }).catch((e: unknown) => {
      setMapError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  // Initialize map when AMap is ready and container exists
  useEffect(() => {
    if (mapError) return;
    if (!AMap || !containerRef.current || mapRef.current) return;

    try {
      mapRef.current = new AMap.Map(containerRef.current, {
        viewMode: '3D',
        layers: [new AMap.TileLayer.Satellite()],
        zoom: 15,
      });

      mapRef.current.on('complete', () => {
        setMapReady(true);
      });

      mapRef.current.on('click', (e: { lnglat: { getLat: () => number; getLng: () => number } }) => {
        if (!useSessionStore.getState().gateMode) return;
        const gcjLat = e.lnglat.getLat();
        const gcjLng = e.lnglat.getLng();
        const [wgsLat, wgsLng] = gcj02ToWgs84(gcjLat, gcjLng);
        gateClickPoints.current.push({ latitude: wgsLat, longitude: wgsLng });

        // Draw marker for this gate point (in GCJ-02 for AMap)
        const gateMarker = new AMap.CircleMarker({
          center: [gcjLng, gcjLat],
          radius: 6,
          fillColor: '#e94560',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        });
        mapRef.current.add(gateMarker);
        gateMarkersRef.current.push(gateMarker);

        if (gateClickPoints.current.length === 2) {
          // Draw gate line
          const [gcjA_lat, gcjA_lng] = wgs84ToGcj02(gateClickPoints.current[0].latitude, gateClickPoints.current[0].longitude);
          const [gcjB_lat, gcjB_lng] = wgs84ToGcj02(gateClickPoints.current[1].latitude, gateClickPoints.current[1].longitude);
          gateLineRef.current = new AMap.Polyline({
            path: [
              new AMap.LngLat(gcjA_lng, gcjA_lat),
              new AMap.LngLat(gcjB_lng, gcjB_lat),
            ],
            strokeColor: '#e94560',
            strokeWeight: 3,
            strokeOpacity: 0.9,
            strokeStyle: 'dashed',
          });
          mapRef.current.add(gateLineRef.current);

          setGateMode(false);
          setGateAndProcess({
            pointA: gateClickPoints.current[0],
            pointB: gateClickPoints.current[1],
          });
          gateClickPoints.current = [];
        }
      });
    } catch (e: unknown) {
      setMapError(e instanceof Error ? e.message : String(e));
    }
  }, [AMap, mapError, setGateMode, setGateAndProcess]);

  // Center map on raw GPS data
  useEffect(() => {
    if (!mapRef.current || !AMap || !rawLog) return;
    if (rawLog.gpsLocation.length === 0) return;

    const first = rawLog.gpsLocation[0];
    const [gcjLat, gcjLng] = wgs84ToGcj02(first.latitude, first.longitude);
    mapRef.current.setCenter([gcjLng, gcjLat]);
    mapRef.current.setZoom(15);
  }, [rawLog]);

  // Draw raw GPS trace before session is processed
  useEffect(() => {
    if (!mapRef.current || !AMap || !rawLog) return;
    if (session) {
      if (polylineRef.current) {
        mapRef.current.remove(polylineRef.current);
        polylineRef.current = null;
      }
      return;
    }

    if (polylineRef.current) {
      mapRef.current.remove(polylineRef.current);
    }

    const path = rawLog.gpsLocation.map(
      (p) => { const [lat, lng] = wgs84ToGcj02(p.latitude, p.longitude); return new AMap.LngLat(lng, lat); },
    );

    if (path.length > 0) {
      polylineRef.current = new AMap.Polyline({
        path,
        strokeColor: '#fff',
        strokeWeight: 2,
        strokeOpacity: 0.7,
      });
      mapRef.current.add(polylineRef.current);
      mapRef.current.setFitView([polylineRef.current]);
    }
  }, [rawLog, session]);

  // Draw track polyline colored by delta
  useEffect(() => {
    if (!mapRef.current || !AMap || !session) return;

    if (polylineRef.current) {
      mapRef.current.remove(polylineRef.current);
    }

    const lap = session.laps[currentLapIndex];
    if (!lap) return;

    const path = lap.points.map(
      (p) => { const [lat, lng] = wgs84ToGcj02(p.latitude, p.longitude); return new AMap.LngLat(lng, lat); },
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

    const [gcjLat, gcjLng] = wgs84ToGcj02(closest.latitude, closest.longitude);
    markerRef.current.setCenter([gcjLng, gcjLat]);
  }, [session, currentLapIndex, playback.currentTime]);

  // Draw unsplit trace when no laps
  useEffect(() => {
    if (!mapRef.current || !AMap || !session) return;
    if (session.laps.length > 0) return;

    if (polylineRef.current) {
      mapRef.current.remove(polylineRef.current);
    }

    const path = session.points.map(
      (p) => { const [lat, lng] = wgs84ToGcj02(p.latitude, p.longitude); return new AMap.LngLat(lng, lat); },
    );

    if (path.length > 0) {
      polylineRef.current = new AMap.Polyline({
        path,
        strokeColor: '#fff',
        strokeWeight: 2,
        strokeOpacity: 0.7,
      });
      mapRef.current.add(polylineRef.current);
      mapRef.current.setFitView([polylineRef.current]);
    }
  }, [session, session?.laps.length]);

  if (mapError) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>Map error: {mapError}</div>
      </div>
    );
  }

  if (!rawLog) {
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
        className={`${styles.map} ${mapReady ? styles.mapReady : ''}`}
        style={{ cursor: gateMode ? 'crosshair' : 'default' }}
      />
    </div>
  );
}
