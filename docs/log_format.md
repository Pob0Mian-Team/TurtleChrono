# SD Log Format

Binary file. Records are written sequentially. Every record is:

```text
[tag: 1 byte] [payload: N bytes]
```

All payload structs are `__attribute__((packed))` and use the exact field order from `User/inc/sd_types.h`.

## Record tags

| Tag  | Type | Payload size | Notes |
|------|------|--------------|-------|
| 0x88 | LogHeader | 32 bytes | File/session header record |
| 0x01 | IMU | 28 bytes | IMU sample |
| 0x02 | GPS location | 16 bytes | Position / speed / course |
| 0x03 | GPS quality | 16 bytes | DOP / fix metadata |

## File layout

Recommended format definition:

```text
[0x88][LogHeader]
[tag][payload]
[tag][payload]
...
```

Current implementation status:

- `sd_types.h` already defines `LogHeader` and `LOG_HEADER = 0x88`.
- `User/src/sd_task.cpp` currently writes `0x01`, `0x02`, `0x03` records only.
- `User/src/sd_task.cpp` still opens the file in append mode (`FA_OPEN_ALWAYS` + `f_lseek(..., f_size(...))`).
- That means older/current logs may legitimately have no header record at file start yet.

Decoder guidance:

- If the first byte is `0x88`, parse one `LogHeader` first, then continue with normal records.
- Otherwise, treat the file as a legacy headerless log and start decoding from byte 0.

Flush policy:

- File is batch-flushed every 500 ms, or earlier when ring buffers hit thresholds.
- Thresholds are currently IMU `>= 32`, GPS location `>= 16`, GPS quality `>= 16`.

---

## LogHeader Record — 32 bytes

Tag: `0x88`

| Offset | Size | Type     | Field            | Units / Notes |
|--------|------|----------|------------------|---------------|
| 0      | 4    | uint32_t | dev_uuid         | Device identifier |
| 4      | 2    | uint16_t | version          | Log format version; increment when `LogHeader` changes |
| 6      | 4    | uint32_t | start_time_ms    | `HAL_GetTick()` at log start |
| 10     | 4    | uint32_t | tick_on_utc_sync | Local `HAL_GetTick()` when valid UTC time was received |
| 14     | 1    | uint8_t  | hour             | UTC hour from RMC |
| 15     | 1    | uint8_t  | minute           | UTC minute from RMC |
| 16     | 1    | uint8_t  | second           | UTC second from RMC |
| 17     | 1    | uint8_t  | day              | UTC day |
| 18     | 1    | uint8_t  | month            | UTC month |
| 19     | 2    | uint16_t | year             | UTC year, e.g. 2025 |
| 21     | 11   | uint8_t[11] | reserved      | Reserved for future use |

UTC reconstruction hint:

- When `tick_on_utc_sync` and the UTC calendar fields are valid, later sample UTC can be estimated as:
- `sample_utc ~= header_utc + (sample.timestamp_ms - tick_on_utc_sync)`

---

## IMU Record — 28 bytes

Tag: `0x01`

| Offset | Size | Type     | Field        | Units |
|--------|------|----------|--------------|-------|
| 0      | 4    | uint32_t | timestamp_ms | `HAL_GetTick()` |
| 4      | 12   | float[3] | accel        | m/s^2, x/y/z |
| 16     | 12   | float[3] | gyro         | rad/s, x/y/z |

Current implementation note:

- `writeIMU()` exists, but no active IMU producer is wired in the current code path yet.

---

## GPS Location Record — 16 bytes

Tag: `0x02`

| Offset | Size | Type     | Field         | Units / Notes |
|--------|------|----------|---------------|---------------|
| 0      | 4    | uint32_t | timestamp_ms  | Local `HAL_GetTick()` at sample time |
| 4      | 4    | int32_t  | latitude      | `1e-7` degrees, `+ = North` |
| 8      | 4    | int32_t  | longitude     | `1e-7` degrees, `+ = East` |
| 12     | 2    | int16_t  | speed_kmh     | `0.1 km/h`, divide by `10.0` |
| 14     | 2    | int16_t  | course_deg    | `0.1 deg`, divide by `10.0` |

Source mapping from GPS runtime data:

- `timestamp_ms` comes from `GPS::Fix::timestamp_ms`
- `speed_kmh` is quantized from float km/h to signed `int16_t` in `0.1 km/h`
- `course_deg` is quantized from float degrees to signed `int16_t` in `0.1 deg`

Coordinate precision:

- `1e-7` degrees is about `1.1 cm` at the equator.
- Parser comment in `gps.cpp` documents conversion from NMEA `DDMM.mmmmmmm` to signed `1e-7` degree integers.

---

## GPS Quality Record — 16 bytes

Tag: `0x03`

| Offset | Size | Type     | Field         | Units / Notes |
|--------|------|----------|---------------|---------------|
| 0      | 4    | uint32_t | timestamp_ms  | Local `HAL_GetTick()` at sample time |
| 4      | 4    | float    | hdop          | Horizontal dilution of precision |
| 8      | 4    | float    | vdop          | Vertical dilution of precision |
| 12     | 1    | int8_t   | fix_quality   | `0=none 1=GPS 2=DGPS 4=RTK-fix 5=RTK-float`; `0` when invalid |
| 13     | 1    | int8_t   | satellites    | Satellites used; `0` when invalid |
| 14     | 1    | int8_t   | fix_type      | `1=none 2=2D 3=3D`; `0` when invalid |
| 15     | 1    | int8_t   | reserved      | Reserved / padding for future use |

Current implementation note:

- The record type is defined and SD task supports `writeGPSQuality()`.
- No current producer is calling `writeGPSQuality()`, so `0x03` records may not appear yet in generated logs.

---

## Compatibility notes

- Endianness is little-endian on STM32H7.
- Because structs are packed, decoders should not apply host-side alignment assumptions.

---

## Python decoder

```python
import struct
import sys

LOG_HEADER_TAG = 0x88
IMU_TAG = 0x01
GPS_LOCATION_TAG = 0x02
GPS_QUALITY_TAG = 0x03

LOG_HEADER_FMT = '<IHIIBBBBBH11s'  # 32 bytes
IMU_FMT = '<Iffffff'              # 28 bytes
GPS_LOCATION_FMT = '<Iiihh'       # 16 bytes
GPS_QUALITY_FMT = '<Iffbbbb'      # 16 bytes

TAG_INFO = {
    LOG_HEADER_TAG: ('LOG_HEADER', LOG_HEADER_FMT, struct.calcsize(LOG_HEADER_FMT)),
    IMU_TAG: ('IMU', IMU_FMT, struct.calcsize(IMU_FMT)),
    GPS_LOCATION_TAG: ('GPS_LOCATION', GPS_LOCATION_FMT, struct.calcsize(GPS_LOCATION_FMT)),
    GPS_QUALITY_TAG: ('GPS_QUALITY', GPS_QUALITY_FMT, struct.calcsize(GPS_QUALITY_FMT)),
}


def decode(path):
    with open(path, 'rb') as f:
        data = f.read()

    pos = 0
    while pos < len(data):
        tag = data[pos]
        pos += 1

        if tag not in TAG_INFO:
            print(f'unknown tag 0x{tag:02x} at offset {pos - 1}')
            break

        name, fmt, size = TAG_INFO[tag]
        if pos + size > len(data):
            print(f'truncated {name} payload at offset {pos - 1}')
            break

        fields = struct.unpack_from(fmt, data, pos)
        pos += size

        if tag == LOG_HEADER_TAG:
            dev_uuid, version, start_ms, sync_tick, hh, mm, ss, dd, mon, year, reserved = fields
            print(
                f'HEADER  dev=0x{dev_uuid:08x}  ver={version}  start={start_ms}ms  '
                f'utc_sync_tick={sync_tick}  utc={year:04d}-{mon:02d}-{dd:02d} '
                f'{hh:02d}:{mm:02d}:{ss:02d}'
            )
        elif tag == GPS_LOCATION_TAG:
            ts, lat, lon, spd, crs = fields
            print(
                f'GPS-LOC  t={ts}ms  lat={lat / 1e7:.7f}  lon={lon / 1e7:.7f}  '
                f'spd={spd / 10.0:.1f}km/h  crs={crs / 10.0:.1f}deg'
            )
        elif tag == GPS_QUALITY_TAG:
            ts, hdop, vdop, fq, sv, ft, reserved = fields
            print(
                f'GPS-QLT  t={ts}ms  hdop={hdop:.1f}  vdop={vdop:.1f}  '
                f'sats={sv}  fix_quality={fq}  fix_type={ft}  reserved={reserved}'
            )
        elif tag == IMU_TAG:
            ts, ax, ay, az, gx, gy, gz = fields
            print(
                f'IMU  t={ts}ms  a=[{ax:.2f},{ay:.2f},{az:.2f}]m/s^2  '
                f'g=[{gx:.3f},{gy:.3f},{gz:.3f}]rad/s'
            )


if __name__ == '__main__':
    decode(sys.argv[1])
```

Usage:

```bash
python decode.py /path/to/log.bin
```
