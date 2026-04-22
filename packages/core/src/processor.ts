import type {
  GPSLocationRecord,
  GPSQualityRecord,
  GPSPoint,
  IMURecord,
  Gate,
  Lap,
  LapDelta,
  DeltaPoint,
  RawLog,
  ProcessedSession,
} from './types';

// --- GPS Quality Filtering ---

export function filterGPS(
  locations: GPSLocationRecord[],
  qualities: GPSQualityRecord[],
  maxHdop: number = 5.0,
): GPSPoint[] {
  const qualityByTime = new Map<
    number,
    { hdop: number; fixType: number; satellites: number }
  >();
  for (const q of qualities) {
    qualityByTime.set(q.timestampMs, {
      hdop: q.hdop,
      fixType: q.fixType,
      satellites: q.satellites,
    });
  }

  const points: GPSPoint[] = [];
  for (const loc of locations) {
    const q = qualityByTime.get(loc.timestampMs);
    if (!q) continue;
    if (q.fixType < 3) continue;
    if (q.hdop > maxHdop) continue;

    points.push({
      timestampMs: loc.timestampMs,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speedKmh: loc.speedKmh,
      courseDeg: loc.courseDeg,
      accel: [0, 0, 0],
      gyro: [0, 0, 0],
      hdop: q.hdop,
      fixType: q.fixType,
      satellites: q.satellites,
      distanceFromStart: 0,
    });
  }

  return points;
}

// --- IMU Interpolation ---

export function interpolateIMU(
  points: GPSPoint[],
  imuRecords: IMURecord[],
): GPSPoint[] {
  if (imuRecords.length === 0) return points;

  const sorted = [...imuRecords].sort((a, b) => a.timestampMs - b.timestampMs);

  return points.map((point) => {
    let lo = 0;
    let hi = sorted.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid].timestampMs < point.timestampMs) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    let accel: [number, number, number];
    let gyro: [number, number, number];

    if (lo === 0 && sorted[0].timestampMs >= point.timestampMs) {
      accel = [...sorted[0].accel];
      gyro = [...sorted[0].gyro];
    } else if (lo >= sorted.length) {
      accel = [...sorted[sorted.length - 1].accel];
      gyro = [...sorted[sorted.length - 1].gyro];
    } else {
      const a = sorted[lo - 1];
      const b = sorted[lo];
      const t =
        (point.timestampMs - a.timestampMs) /
        (b.timestampMs - a.timestampMs);
      accel = [
        a.accel[0] + t * (b.accel[0] - a.accel[0]),
        a.accel[1] + t * (b.accel[1] - a.accel[1]),
        a.accel[2] + t * (b.accel[2] - a.accel[2]),
      ];
      gyro = [
        a.gyro[0] + t * (b.gyro[0] - a.gyro[0]),
        a.gyro[1] + t * (b.gyro[1] - a.gyro[1]),
        a.gyro[2] + t * (b.gyro[2] - a.gyro[2]),
      ];
    }

    return { ...point, accel, gyro };
  });
}

// --- Distance ---

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeCumulativeDistance(points: GPSPoint[]): GPSPoint[] {
  let total = 0;
  return points.map((point, i) => {
    if (i > 0) {
      total += haversineDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        point.latitude,
        point.longitude,
      );
    }
    return { ...point, distanceFromStart: total };
  });
}

// --- Gate Crossing Detection ---

function crossProduct2D(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsIntersect(
  a1lat: number, a1lon: number, a2lat: number, a2lon: number,
  b1lat: number, b1lon: number, b2lat: number, b2lon: number,
): boolean {
  const d1 = crossProduct2D(b1lat, b1lon, b2lat, b2lon, a1lat, a1lon);
  const d2 = crossProduct2D(b1lat, b1lon, b2lat, b2lon, a2lat, a2lon);
  const d3 = crossProduct2D(a1lat, a1lon, a2lat, a2lon, b1lat, b1lon);
  const d4 = crossProduct2D(a1lat, a1lon, a2lat, a2lon, b2lat, b2lon);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

export function detectGateCrossings(points: GPSPoint[], gate: Gate): number[] {
  const crossings: number[] = [];
  for (let i = 1; i < points.length; i++) {
    if (
      segmentsIntersect(
        points[i - 1].latitude, points[i - 1].longitude,
        points[i].latitude, points[i].longitude,
        gate.pointA.latitude, gate.pointA.longitude,
        gate.pointB.latitude, gate.pointB.longitude,
      )
    ) {
      crossings.push(i);
    }
  }
  return crossings;
}

export function splitLaps(points: GPSPoint[], gate: Gate): Lap[] {
  const crossings = detectGateCrossings(points, gate);
  if (crossings.length < 2) return [];

  const laps: Lap[] = [];
  for (let i = 0; i < crossings.length - 1; i++) {
    const start = crossings[i];
    const end = crossings[i + 1];
    laps.push({
      startIndex: start,
      endIndex: end,
      startTimeMs: points[start].timestampMs,
      endTimeMs: points[end].timestampMs,
      durationMs: points[end].timestampMs - points[start].timestampMs,
      points: points.slice(start, end + 1),
    });
  }
  return laps;
}

// --- Delta Computation ---

export function computeLapDelta(currentLap: Lap, referenceLap: Lap): LapDelta {
  const refPoints = referenceLap.points;
  const curPoints = currentLap.points;

  if (curPoints.length === 0 || refPoints.length === 0) {
    return { points: [], totalTimeDeltaMs: 0 };
  }

  const refDistances = refPoints.map(
    (p) => p.distanceFromStart - refPoints[0].distanceFromStart,
  );

  const deltaPoints: DeltaPoint[] = [];
  let refIdx = 0;

  for (const curPoint of curPoints) {
    const curDist = curPoint.distanceFromStart - curPoints[0].distanceFromStart;

    while (
      refIdx < refDistances.length - 1 &&
      refDistances[refIdx + 1] < curDist
    ) {
      refIdx++;
    }

    let refTimeOffset: number;
    if (
      refIdx >= refDistances.length - 1 ||
      refDistances[refIdx + 1] === refDistances[refIdx]
    ) {
      refTimeOffset = refPoints[refIdx].timestampMs - refPoints[0].timestampMs;
    } else {
      const t =
        (curDist - refDistances[refIdx]) /
        (refDistances[refIdx + 1] - refDistances[refIdx]);
      const refTimeA = refPoints[refIdx].timestampMs - refPoints[0].timestampMs;
      const refTimeB =
        refPoints[refIdx + 1].timestampMs - refPoints[0].timestampMs;
      refTimeOffset = refTimeA + t * (refTimeB - refTimeA);
    }

    const curTimeOffset = curPoint.timestampMs - curPoints[0].timestampMs;

    deltaPoints.push({
      distance: curDist,
      deltaMs: curTimeOffset - refTimeOffset,
      speedKmh: curPoint.speedKmh,
    });
  }

  const totalTimeDeltaMs =
    deltaPoints.length > 0 ? deltaPoints[deltaPoints.length - 1].deltaMs : 0;

  return { points: deltaPoints, totalTimeDeltaMs };
}

// --- Session Orchestrator ---

export function processSession(rawLog: RawLog, gate: Gate): ProcessedSession {
  let points = filterGPS(rawLog.gpsLocation, rawLog.gpsQuality);
  points = interpolateIMU(points, rawLog.imu);
  points = computeCumulativeDistance(points);

  const laps = splitLaps(points, gate);

  let bestLapIndex = -1;
  if (laps.length > 0) {
    bestLapIndex = 0;
    for (let i = 1; i < laps.length; i++) {
      if (laps[i].durationMs < laps[bestLapIndex].durationMs) {
        bestLapIndex = i;
      }
    }
  }

  const totalDistance =
    points.length > 0 ? points[points.length - 1].distanceFromStart : 0;

  return { points, laps, totalDistance, bestLapIndex };
}
