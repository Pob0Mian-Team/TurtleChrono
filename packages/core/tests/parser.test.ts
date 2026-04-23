import { describe, it, expect } from 'vitest';
import { parseLog, ParseError } from '../src/parser';
import { LogBuilder } from './helpers';

describe('parseLog', () => {
  it('parses a log with header + mixed records', () => {
    const buf = new LogBuilder()
      .addLogHeader({ devUuid: 0xabcd, version: 2, utcYear: 2025, utcMonth: 6, utcDay: 15, utcHour: 8 })
      .addGPSLocation({ timestampMs: 2000, latitude: 31.2304, longitude: 121.4737, speedKmh: 60.0, courseDeg: 90.0 })
      .addGPSQuality({ timestampMs: 2000, hdop: 0.9, vdop: 1.1, fixQuality: 1, satellites: 12, fixType: 3 })
      .addIMU({ timestampMs: 2000, accel: [0.1, 0.2, 9.81], gyro: [0.01, 0.02, 0.03] })
      .addGPSLocation({ timestampMs: 2040, latitude: 31.2305, longitude: 121.4740, speedKmh: 62.0, courseDeg: 92.0 })
      .addGPSQuality({ timestampMs: 2040, hdop: 0.8, vdop: 1.0, fixQuality: 1, satellites: 12, fixType: 3 })
      .build();

    const log = parseLog(buf);

    expect(log.header).not.toBeNull();
    expect(log.header!.devUuid).toBe(0xabcd);
    expect(log.header!.version).toBe(2);
    expect(log.header!.utcYear).toBe(2025);
    expect(log.header!.utcMonth).toBe(6);
    expect(log.header!.utcDay).toBe(15);
    expect(log.header!.utcHour).toBe(8);

    expect(log.gpsLocation).toHaveLength(2);
    expect(log.gpsLocation[0].latitude).toBeCloseTo(31.2304, 5);
    expect(log.gpsLocation[0].longitude).toBeCloseTo(121.4737, 5);
    expect(log.gpsLocation[0].speedKmh).toBeCloseTo(60.0, 1);
    expect(log.gpsLocation[0].courseDeg).toBeCloseTo(90.0, 1);
    expect(log.gpsLocation[1].timestampMs).toBe(2040);

    expect(log.gpsQuality).toHaveLength(2);
    expect(log.gpsQuality[0].hdop).toBeCloseTo(0.9, 2);
    expect(log.gpsQuality[0].fixType).toBe(3);
    expect(log.gpsQuality[0].satellites).toBe(12);

    expect(log.imu).toHaveLength(1);
    expect(log.imu[0].accel[0]).toBeCloseTo(0.1, 2);
    expect(log.imu[0].accel[2]).toBeCloseTo(9.81, 2);
    expect(log.imu[0].gyro[1]).toBeCloseTo(0.02, 3);
  });

  it('parses a legacy headerless log', () => {
    const buf = new LogBuilder()
      .addGPSLocation({ timestampMs: 100, latitude: 39.9, longitude: 116.4, speedKmh: 30, courseDeg: 0 })
      .build();

    const log = parseLog(buf);

    expect(log.header).toBeNull();
    expect(log.gpsLocation).toHaveLength(1);
    expect(log.gpsLocation[0].latitude).toBeCloseTo(39.9, 5);
  });

  it('parses an empty buffer', () => {
    const log = parseLog(new ArrayBuffer(0));
    expect(log.header).toBeNull();
    expect(log.gpsLocation).toHaveLength(0);
    expect(log.imu).toHaveLength(0);
    expect(log.gpsQuality).toHaveLength(0);
  });

  it('throws on truncated IMU payload', () => {
    // 1 byte tag + 10 bytes (truncated from 28)
    const buf = new ArrayBuffer(11);
    const v = new DataView(buf);
    v.setUint8(0, 0x01); // IMU tag
    expect(() => parseLog(buf)).toThrow(ParseError);
  });

  it('throws on unknown tag', () => {
    const buf = new ArrayBuffer(2);
    const v = new DataView(buf);
    v.setUint8(0, 0xff); // unknown tag
    expect(() => parseLog(buf)).toThrow(/unknown tag/i);
  });

  it('parses real device log fixture', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const buf = readFileSync(resolve(__dirname, 'fixtures/test_log_0.bin'));
    const log = parseLog(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    expect(log.header).not.toBeNull();
    expect(log.gpsLocation.length).toBeGreaterThan(0);
    for (const rec of log.gpsLocation) {
      expect(Math.abs(rec.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(rec.longitude)).toBeLessThanOrEqual(180);
    }
    expect(log.imu.length).toBeGreaterThan(0);
    expect(log.gpsQuality.length).toBeGreaterThan(0);
  });
});
