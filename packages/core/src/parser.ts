import type { RawLog, LogHeader, IMURecord, GPSLocationRecord, GPSQualityRecord } from './types';

const TAG_LOG_HEADER = 0x88;
const TAG_IMU = 0x01;
const TAG_GPS_LOCATION = 0x02;
const TAG_GPS_QUALITY = 0x03;

const LOG_HEADER_SIZE = 32;
const IMU_SIZE = 28;
const GPS_LOCATION_SIZE = 16;
const GPS_QUALITY_SIZE = 16;

export class ParseError extends Error {
  constructor(
    message: string,
    public offset: number,
  ) {
    super(`Parse error at offset ${offset}: ${message}`);
    this.name = 'ParseError';
  }
}

export function parseLog(buffer: ArrayBuffer): RawLog {
  const view = new DataView(buffer);
  const log: RawLog = {
    header: null,
    imu: [],
    gpsLocation: [],
    gpsQuality: [],
  };

  let pos = 0;

  // Check for LogHeader at start
  if (view.byteLength > 0 && view.getUint8(0) === TAG_LOG_HEADER) {
    if (view.byteLength < 1 + LOG_HEADER_SIZE) {
      throw new ParseError('Truncated LogHeader', 0);
    }
    log.header = parseLogHeader(view, 1);
    pos = 1 + LOG_HEADER_SIZE;
  }

  while (pos < view.byteLength) {
    const tag = view.getUint8(pos);
    pos += 1;

    switch (tag) {
      case TAG_IMU: {
        if (pos + IMU_SIZE > view.byteLength) {
          throw new ParseError('Truncated IMU record', pos - 1);
        }
        log.imu.push(parseIMU(view, pos));
        pos += IMU_SIZE;
        break;
      }
      case TAG_GPS_LOCATION: {
        if (pos + GPS_LOCATION_SIZE > view.byteLength) {
          throw new ParseError('Truncated GPS Location record', pos - 1);
        }
        log.gpsLocation.push(parseGPSLocation(view, pos));
        pos += GPS_LOCATION_SIZE;
        break;
      }
      case TAG_GPS_QUALITY: {
        if (pos + GPS_QUALITY_SIZE > view.byteLength) {
          throw new ParseError('Truncated GPS Quality record', pos - 1);
        }
        log.gpsQuality.push(parseGPSQuality(view, pos));
        pos += GPS_QUALITY_SIZE;
        break;
      }
      case TAG_LOG_HEADER: {
        // Duplicate header — skip
        if (pos + LOG_HEADER_SIZE > view.byteLength) {
          throw new ParseError('Truncated LogHeader', pos - 1);
        }
        pos += LOG_HEADER_SIZE;
        break;
      }
      default:
        throw new ParseError(
          `Unknown tag 0x${tag.toString(16).padStart(2, '0')}`,
          pos - 1,
        );
    }
  }

  return log;
}

function parseLogHeader(view: DataView, offset: number): LogHeader {
  return {
    devUuid: view.getUint32(offset, true),
    version: view.getUint16(offset + 4, true),
    startTimeMs: view.getUint32(offset + 6, true),
    tickOnUtcSync: view.getUint32(offset + 10, true),
    utcHour: view.getUint8(offset + 14),
    utcMinute: view.getUint8(offset + 15),
    utcSecond: view.getUint8(offset + 16),
    utcDay: view.getUint8(offset + 17),
    utcMonth: view.getUint8(offset + 18),
    utcYear: view.getUint16(offset + 19, true),
  };
}

function parseIMU(view: DataView, offset: number): IMURecord {
  return {
    timestampMs: view.getUint32(offset, true),
    accel: [
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
      view.getFloat32(offset + 12, true),
    ],
    gyro: [
      view.getFloat32(offset + 16, true),
      view.getFloat32(offset + 20, true),
      view.getFloat32(offset + 24, true),
    ],
  };
}

function parseGPSLocation(view: DataView, offset: number): GPSLocationRecord {
  return {
    timestampMs: view.getUint32(offset, true),
    latitude: view.getInt32(offset + 4, true) / 1e7,
    longitude: view.getInt32(offset + 8, true) / 1e7,
    speedKmh: view.getInt16(offset + 12, true) / 10,
    courseDeg: view.getInt16(offset + 14, true) / 10,
  };
}

function parseGPSQuality(view: DataView, offset: number): GPSQualityRecord {
  return {
    timestampMs: view.getUint32(offset, true),
    hdop: view.getFloat32(offset + 4, true),
    vdop: view.getFloat32(offset + 8, true),
    fixQuality: view.getInt8(offset + 12),
    satellites: view.getInt8(offset + 13),
    fixType: view.getInt8(offset + 14),
  };
}
