// --- Raw record types (from binary parser) ---

export interface LogHeader {
  devUuid: number;
  version: number;
  startTimeMs: number;
  tickOnUtcSync: number;
  utcHour: number;
  utcMinute: number;
  utcSecond: number;
  utcDay: number;
  utcMonth: number;
  utcYear: number;
}

export interface IMURecord {
  timestampMs: number;
  accel: [number, number, number]; // m/s², x/y/z
  gyro: [number, number, number]; // rad/s, x/y/z
}

export interface GPSLocationRecord {
  timestampMs: number;
  latitude: number;  // degrees (converted from 1e-7)
  longitude: number; // degrees (converted from 1e-7)
  speedKmh: number;  // km/h (converted from 0.1)
  courseDeg: number; // degrees (converted from 0.1)
}

export interface GPSQualityRecord {
  timestampMs: number;
  hdop: number;
  vdop: number;
  fixQuality: number; // 0=none 1=GPS 2=DGPS 4=RTK-fix 5=RTK-float
  satellites: number;
  fixType: number; // 1=none 2=2D 3=3D
}

export interface RawLog {
  header: LogHeader | null;
  imu: IMURecord[];
  gpsLocation: GPSLocationRecord[];
  gpsQuality: GPSQualityRecord[];
}

// --- Processed data types ---

export interface GPSPoint {
  timestampMs: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  courseDeg: number;
  accel: [number, number, number]; // interpolated from IMU
  gyro: [number, number, number]; // interpolated from IMU
  hdop: number;
  fixType: number;
  satellites: number;
  distanceFromStart: number; // cumulative meters from first point
}

export interface Gate {
  pointA: { latitude: number; longitude: number };
  pointB: { latitude: number; longitude: number };
}

export interface Lap {
  startIndex: number;
  endIndex: number;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  points: GPSPoint[];
}

export interface ProcessedSession {
  points: GPSPoint[];     // filtered + interpolated, sorted by time
  laps: Lap[];            // split by gate crossings
  totalDistance: number;   // meters
  bestLapIndex: number;   // index into laps[], or -1
}

export interface DeltaPoint {
  distance: number;   // meters from lap start
  deltaMs: number;    // time difference vs reference (negative = ahead)
  speedKmh: number;
}

export interface LapDelta {
  points: DeltaPoint[];
  totalTimeDeltaMs: number;
}
