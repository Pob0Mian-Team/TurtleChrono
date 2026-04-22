// packages/core/tests/helpers.ts

const TAG_LOG_HEADER = 0x88;
const TAG_IMU = 0x01;
const TAG_GPS_LOCATION = 0x02;
const TAG_GPS_QUALITY = 0x03;

export class LogBuilder {
  private parts: ArrayBuffer[] = [];

  addLogHeader(opts: {
    devUuid?: number;
    version?: number;
    startTimeMs?: number;
    tickOnUtcSync?: number;
    utcHour?: number;
    utcMinute?: number;
    utcSecond?: number;
    utcDay?: number;
    utcMonth?: number;
    utcYear?: number;
  } = {}): this {
    const buf = new ArrayBuffer(1 + 32);
    const v = new DataView(buf);
    v.setUint8(0, TAG_LOG_HEADER);
    v.setUint32(1, opts.devUuid ?? 0x12345678, true);
    v.setUint16(5, opts.version ?? 1, true);
    v.setUint32(7, opts.startTimeMs ?? 0, true);
    v.setUint32(11, opts.tickOnUtcSync ?? 1000, true);
    v.setUint8(15, opts.utcHour ?? 12);
    v.setUint8(16, opts.utcMinute ?? 0);
    v.setUint8(17, opts.utcSecond ?? 0);
    v.setUint8(18, opts.utcDay ?? 1);
    v.setUint8(19, opts.utcMonth ?? 1);
    v.setUint16(20, opts.utcYear ?? 2025, true);
    this.parts.push(buf);
    return this;
  }

  addIMU(record: {
    timestampMs: number;
    accel?: [number, number, number];
    gyro?: [number, number, number];
  }): this {
    const buf = new ArrayBuffer(1 + 28);
    const v = new DataView(buf);
    v.setUint8(0, TAG_IMU);
    v.setUint32(1, record.timestampMs, true);
    const a = record.accel ?? [0, 0, 9.81];
    v.setFloat32(5, a[0], true);
    v.setFloat32(9, a[1], true);
    v.setFloat32(13, a[2], true);
    const g = record.gyro ?? [0, 0, 0];
    v.setFloat32(17, g[0], true);
    v.setFloat32(21, g[1], true);
    v.setFloat32(25, g[2], true);
    this.parts.push(buf);
    return this;
  }

  addGPSLocation(record: {
    timestampMs: number;
    latitude: number;
    longitude: number;
    speedKmh?: number;
    courseDeg?: number;
  }): this {
    const buf = new ArrayBuffer(1 + 16);
    const v = new DataView(buf);
    v.setUint8(0, TAG_GPS_LOCATION);
    v.setUint32(1, record.timestampMs, true);
    v.setInt32(5, Math.round(record.latitude * 1e7), true);
    v.setInt32(9, Math.round(record.longitude * 1e7), true);
    v.setInt16(13, Math.round((record.speedKmh ?? 0) * 10), true);
    v.setInt16(15, Math.round((record.courseDeg ?? 0) * 10), true);
    this.parts.push(buf);
    return this;
  }

  addGPSQuality(record: {
    timestampMs: number;
    hdop?: number;
    vdop?: number;
    fixQuality?: number;
    satellites?: number;
    fixType?: number;
  }): this {
    const buf = new ArrayBuffer(1 + 16);
    const v = new DataView(buf);
    v.setUint8(0, TAG_GPS_QUALITY);
    v.setUint32(1, record.timestampMs, true);
    v.setFloat32(5, record.hdop ?? 1.0, true);
    v.setFloat32(9, record.vdop ?? 1.0, true);
    v.setInt8(13, record.fixQuality ?? 1);
    v.setInt8(14, record.satellites ?? 8);
    v.setInt8(15, record.fixType ?? 3);
    this.parts.push(buf);
    return this;
  }

  build(): ArrayBuffer {
    const total = this.parts.reduce((s, p) => s + p.byteLength, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of this.parts) {
      result.set(new Uint8Array(part), offset);
      offset += part.byteLength;
    }
    return result.buffer;
  }
}
