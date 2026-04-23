import { describe, it, expect } from 'vitest';
import {
  filterGPS,
  interpolateIMU,
  haversineDistance,
  computeCumulativeDistance,
  detectGateCrossings,
  splitLaps,
  computeLapDelta,
} from '../src/processor';
import type { GPSLocationRecord, GPSQualityRecord, IMURecord, GPSPoint, Gate, Lap } from '../src/types';

describe('filterGPS', () => {
  const locations: GPSLocationRecord[] = [
    { timestampMs: 1000, latitude: 31.23, longitude: 121.47, speedKmh: 50, courseDeg: 0 },
    { timestampMs: 2000, latitude: 31.24, longitude: 121.48, speedKmh: 60, courseDeg: 90 },
    { timestampMs: 3000, latitude: 31.25, longitude: 121.49, speedKmh: 70, courseDeg: 180 },
    { timestampMs: 4000, latitude: 31.26, longitude: 121.50, speedKmh: 80, courseDeg: 270 },
  ];

  const qualities: GPSQualityRecord[] = [
    { timestampMs: 1000, hdop: 1.0, vdop: 1.0, fixQuality: 1, satellites: 10, fixType: 3 },
    { timestampMs: 2000, hdop: 6.0, vdop: 8.0, fixQuality: 1, satellites: 4, fixType: 2 },
    { timestampMs: 3000, hdop: 0.9, vdop: 1.0, fixQuality: 2, satellites: 12, fixType: 3 },
    { timestampMs: 4000, hdop: 2.0, vdop: 2.0, fixQuality: 1, satellites: 8, fixType: 3 },
  ];

  it('keeps only 3D fix with hdop <= threshold', () => {
    const result = filterGPS(locations, qualities, 5.0);
    expect(result).toHaveLength(3);
    expect(result[0].timestampMs).toBe(1000);
    expect(result[1].timestampMs).toBe(3000);
    expect(result[2].timestampMs).toBe(4000);
  });

  it('applies hdop threshold', () => {
    const result = filterGPS(locations, qualities, 1.5);
    expect(result).toHaveLength(2);
  });

  it('passes all locations through when no quality records exist', () => {
    const noQualities: GPSQualityRecord[] = [];
    const result = filterGPS(locations, noQualities);
    expect(result).toHaveLength(4);
    expect(result[0].fixType).toBe(3);
    expect(result[0].hdop).toBe(1.0);
  });

  it('matches quality by nearest timestamp when timestamps differ', () => {
    const locs: GPSLocationRecord[] = [
      { timestampMs: 1000, latitude: 31.23, longitude: 121.47, speedKmh: 50, courseDeg: 0 },
      { timestampMs: 2000, latitude: 31.24, longitude: 121.48, speedKmh: 60, courseDeg: 90 },
      { timestampMs: 3000, latitude: 31.25, longitude: 121.49, speedKmh: 70, courseDeg: 180 },
    ];
    const quals: GPSQualityRecord[] = [
      { timestampMs: 1050, hdop: 1.0, vdop: 1.0, fixQuality: 1, satellites: 10, fixType: 3 },
      { timestampMs: 2100, hdop: 6.0, vdop: 8.0, fixQuality: 1, satellites: 4, fixType: 2 },
      { timestampMs: 2950, hdop: 0.9, vdop: 1.0, fixQuality: 2, satellites: 12, fixType: 3 },
    ];

    const result = filterGPS(locs, quals, 5.0);
    expect(result).toHaveLength(2);
    expect(result[0].timestampMs).toBe(1000);
    expect(result[0].hdop).toBeCloseTo(1.0, 2);
    expect(result[1].timestampMs).toBe(3000);
    expect(result[1].hdop).toBeCloseTo(0.9, 2);
  });
});

describe('interpolateIMU', () => {
  const imuRecords: IMURecord[] = [
    { timestampMs: 1000, accel: [1, 0, 9.8], gyro: [0.1, 0, 0] },
    { timestampMs: 2000, accel: [2, 0, 9.8], gyro: [0.2, 0, 0] },
    { timestampMs: 3000, accel: [3, 0, 9.8], gyro: [0.3, 0, 0] },
  ];

  it('interpolates IMU at GPS timestamps', () => {
    const points: GPSPoint[] = [
      {
        timestampMs: 1500, latitude: 0, longitude: 0, speedKmh: 0, courseDeg: 0,
        accel: [0, 0, 0], gyro: [0, 0, 0], hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
      },
      {
        timestampMs: 2500, latitude: 0, longitude: 0, speedKmh: 0, courseDeg: 0,
        accel: [0, 0, 0], gyro: [0, 0, 0], hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
      },
    ];

    const result = interpolateIMU(points, imuRecords);
    expect(result[0].accel[0]).toBeCloseTo(1.5, 5);
    expect(result[0].gyro[0]).toBeCloseTo(0.15, 5);
    expect(result[1].accel[0]).toBeCloseTo(2.5, 5);
    expect(result[1].gyro[0]).toBeCloseTo(0.25, 5);
  });

  it('clamps to nearest if GPS is outside IMU range', () => {
    const points: GPSPoint[] = [
      {
        timestampMs: 500, latitude: 0, longitude: 0, speedKmh: 0, courseDeg: 0,
        accel: [0, 0, 0], gyro: [0, 0, 0], hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
      },
    ];

    const result = interpolateIMU(points, imuRecords);
    expect(result[0].accel[0]).toBeCloseTo(1, 5);
  });

  it('returns points unchanged when no IMU records', () => {
    const points: GPSPoint[] = [
      {
        timestampMs: 1000, latitude: 0, longitude: 0, speedKmh: 0, courseDeg: 0,
        accel: [0, 0, 0], gyro: [0, 0, 0], hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
      },
    ];

    const result = interpolateIMU(points, []);
    expect(result[0].accel).toEqual([0, 0, 0]);
  });
});

describe('haversineDistance', () => {
  it('computes distance between two known points', () => {
    const dist = haversineDistance(31.2304, 121.4737, 31.2990, 120.5853);
    expect(dist).toBeGreaterThan(80_000);
    expect(dist).toBeLessThan(110_000);
  });

  it('returns 0 for same point', () => {
    expect(haversineDistance(31.23, 121.47, 31.23, 121.47)).toBeCloseTo(0, 1);
  });
});

describe('computeCumulativeDistance', () => {
  it('computes running distance sum', () => {
    const points: GPSPoint[] = [
      {
        timestampMs: 0, latitude: 31.2304, longitude: 121.4737, speedKmh: 50, courseDeg: 0,
        accel: [0, 0, 0], gyro: [0, 0, 0], hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
      },
      {
        timestampMs: 40, latitude: 31.2314, longitude: 121.4737, speedKmh: 50, courseDeg: 0,
        accel: [0, 0, 0], gyro: [0, 0, 0], hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
      },
      {
        timestampMs: 80, latitude: 31.2324, longitude: 121.4737, speedKmh: 50, courseDeg: 0,
        accel: [0, 0, 0], gyro: [0, 0, 0], hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
      },
    ];

    const result = computeCumulativeDistance(points);
    expect(result[0].distanceFromStart).toBe(0);
    expect(result[1].distanceFromStart).toBeGreaterThan(0);
    expect(result[2].distanceFromStart).toBeGreaterThan(result[1].distanceFromStart);
    expect(result[1].distanceFromStart).toBeGreaterThan(100);
    expect(result[1].distanceFromStart).toBeLessThan(120);
  });
});

describe('detectGateCrossings', () => {
  const gate: Gate = {
    pointA: { latitude: 31.232, longitude: 121.470 },
    pointB: { latitude: 31.232, longitude: 121.480 },
  };

  function makePoint(ts: number, lat: number): GPSPoint {
    return {
      timestampMs: ts, latitude: lat, longitude: 121.475,
      speedKmh: 50, courseDeg: 0,
      accel: [0, 0, 0], gyro: [0, 0, 0],
      hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
    };
  }

  it('detects a single gate crossing', () => {
    const points = [
      makePoint(0, 31.230),
      makePoint(40, 31.231),
      makePoint(80, 31.233),
      makePoint(120, 31.234),
    ];
    const crossings = detectGateCrossings(points, gate);
    expect(crossings).toEqual([2]);
  });

  it('detects multiple gate crossings (two laps)', () => {
    const points = [
      makePoint(0, 31.228),
      makePoint(40, 31.236),
      makePoint(80, 31.228),
      makePoint(120, 31.236),
    ];
    const crossings = detectGateCrossings(points, gate);
    expect(crossings).toEqual([1, 2, 3]);
  });

  it('returns empty if no crossings', () => {
    const points = [
      makePoint(0, 31.225),
      makePoint(40, 31.226),
      makePoint(80, 31.227),
    ];
    const crossings = detectGateCrossings(points, gate);
    expect(crossings).toEqual([]);
  });
});

describe('splitLaps', () => {
  const gate: Gate = {
    pointA: { latitude: 31.232, longitude: 121.470 },
    pointB: { latitude: 31.232, longitude: 121.480 },
  };

  function makePoint(ts: number, lat: number): GPSPoint {
    return {
      timestampMs: ts, latitude: lat, longitude: 121.475,
      speedKmh: 50, courseDeg: 0,
      accel: [0, 0, 0], gyro: [0, 0, 0],
      hdop: 1, fixType: 3, satellites: 8, distanceFromStart: 0,
    };
  }

  it('splits into three laps for four crossings', () => {
    const points = [
      makePoint(0, 31.228),
      makePoint(40, 31.236),
      makePoint(80, 31.236),
      makePoint(120, 31.228),
      makePoint(160, 31.228),
      makePoint(200, 31.236),
      makePoint(240, 31.236),
      makePoint(280, 31.228),
    ];
    const laps = splitLaps(points, gate);
    expect(laps).toHaveLength(3);
    expect(laps[0].startTimeMs).toBe(points[1].timestampMs);
    expect(laps[0].endTimeMs).toBe(points[3].timestampMs);
    expect(laps[1].startTimeMs).toBe(points[3].timestampMs);
    expect(laps[1].endTimeMs).toBe(points[5].timestampMs);
    expect(laps[2].startTimeMs).toBe(points[5].timestampMs);
    expect(laps[2].endTimeMs).toBe(points[7].timestampMs);
  });

  it('returns empty array for fewer than 2 crossings', () => {
    const points = [makePoint(0, 31.230), makePoint(40, 31.233)];
    const laps = splitLaps(points, gate);
    expect(laps).toHaveLength(0);
  });
});

describe('computeLapDelta', () => {
  function makeLap(times: number[], speeds: number[]): Lap {
    const points: GPSPoint[] = times.map((t, i) => ({
      timestampMs: t,
      latitude: 31.23 + i * 0.001,
      longitude: 121.47,
      speedKmh: speeds[i] ?? 50,
      courseDeg: 0,
      accel: [0, 0, 0] as [number, number, number],
      gyro: [0, 0, 0] as [number, number, number],
      hdop: 1, fixType: 3, satellites: 8,
      distanceFromStart: i * 11.1,
    }));
    return {
      startIndex: 0,
      endIndex: points.length - 1,
      startTimeMs: points[0].timestampMs,
      endTimeMs: points[points.length - 1].timestampMs,
      durationMs: points[points.length - 1].timestampMs - points[0].timestampMs,
      points,
    };
  }

  it('computes zero delta for identical laps', () => {
    const lap = makeLap([0, 1000, 2000, 3000], [50, 50, 50, 50]);
    const ref = makeLap([0, 1000, 2000, 3000], [50, 50, 50, 50]);
    const delta = computeLapDelta(lap, ref);
    expect(delta.points.length).toBe(4);
    for (const dp of delta.points) {
      expect(dp.deltaMs).toBeCloseTo(0, 1);
    }
  });

  it('shows positive delta when current lap is slower', () => {
    const current = makeLap([0, 1200, 2400, 3600], [50, 50, 50, 50]);
    const reference = makeLap([0, 1000, 2000, 3000], [50, 50, 50, 50]);
    const delta = computeLapDelta(current, reference);
    expect(delta.totalTimeDeltaMs).toBeGreaterThan(0);
  });

  it('shows negative delta when current lap is faster', () => {
    const current = makeLap([0, 800, 1600, 2400], [50, 50, 50, 50]);
    const reference = makeLap([0, 1000, 2000, 3000], [50, 50, 50, 50]);
    const delta = computeLapDelta(current, reference);
    expect(delta.totalTimeDeltaMs).toBeLessThan(0);
  });

  it('handles empty laps', () => {
    const empty: Lap = {
      startIndex: 0, endIndex: 0, startTimeMs: 0, endTimeMs: 0, durationMs: 0, points: [],
    };
    const lap = makeLap([0, 1000], [50, 50]);
    const delta = computeLapDelta(empty, lap);
    expect(delta.points).toHaveLength(0);
    expect(delta.totalTimeDeltaMs).toBe(0);
  });
});
