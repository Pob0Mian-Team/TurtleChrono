# TurtleChrono Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a karting telemetry log viewer for the TurtleChrono wearable GPS/IMU device as a web app with binary log parsing, satellite map, G-force visualization, speed/delta charts, lap splitting, and animated playback.

**Architecture:** Monorepo with npm workspaces — `@turtlechrono/core` (pure TypeScript, no DOM) handles binary parsing and data processing, `@turtlechrono/web` is a React + Vite SPA consuming the core library. Zustand for state. Single-page dashboard with click-to-focus panel expansion.

**Tech Stack:** React 18, Vite, TypeScript, Zustand, AMap JS API 2.0 (Gaode), Lightweight Charts (TradingView), HTML Canvas, CSS Modules, Vitest

---

## File Structure

### Created files

| File | Responsibility |
|------|---------------|
| `package.json` | Root workspace config |
| `.gitignore` | Ignore node_modules, dist, .env |
| `.env.example` | Template for AMap API key |
| `packages/core/package.json` | Core library manifest |
| `packages/core/tsconfig.json` | Core TS config |
| `packages/core/src/types.ts` | All shared TypeScript interfaces |
| `packages/core/src/parser.ts` | Binary TLV log parser (DataView) |
| `packages/core/src/processor.ts` | Filtering, interpolation, lap detection, delta |
| `packages/core/src/time-utils.ts` | UTC reconstruction, relative time |
| `packages/core/src/index.ts` | Barrel export |
| `packages/core/tests/parser.test.ts` | Parser unit + integration tests |
| `packages/core/tests/processor.test.ts` | Processor unit tests |
| `packages/core/tests/helpers.ts` | Binary fixture builder utilities |
| `packages/core/tests/fixtures/log_002.bin` | Real device log (moved from root) |
| `packages/web/package.json` | Web app manifest |
| `packages/web/tsconfig.json` | Web TS config |
| `packages/web/vite.config.ts` | Vite config with workspace alias |
| `packages/web/index.html` | HTML entry point |
| `packages/web/src/main.tsx` | React mount point |
| `packages/web/src/App.tsx` | Layout manager + focus mode |
| `packages/web/src/App.module.css` | Dashboard grid styles |
| `packages/web/src/store/session-store.ts` | Zustand store |
| `packages/web/src/hooks/useLogLoader.ts` | File read → parse → populate store |
| `packages/web/src/hooks/usePlayback.ts` | requestAnimationFrame playback loop |
| `packages/web/src/components/FocusWrapper.tsx` | Click-to-expand + Esc-to-collapse |
| `packages/web/src/components/FocusWrapper.module.css` | Focus transition styles |
| `packages/web/src/components/Sidebar.tsx` | File load, session info, lap list |
| `packages/web/src/components/Sidebar.module.css` | Sidebar styles |
| `packages/web/src/components/MapPanel.tsx` | AMap satellite + track + gate editor |
| `packages/web/src/components/MapPanel.module.css` | Map container styles |
| `packages/web/src/components/GForcePanel.tsx` | Canvas G-force ball |
| `packages/web/src/components/GForcePanel.module.css` | Canvas container styles |
| `packages/web/src/components/ChartPanel.tsx` | Lightweight Charts speed + delta |
| `packages/web/src/components/ChartPanel.module.css` | Chart container styles |
| `packages/web/src/components/PlaybackBar.tsx` | Timeline scrubber, play/pause, speed |
| `packages/web/src/components/PlaybackBar.module.css` | Playback bar styles |
| `packages/web/src/components/LapInfoPanel.tsx` | Current lap time, best, delta, speed |
| `packages/web/src/components/LapInfoPanel.module.css` | Info panel styles |

### Modified files

| File | Change |
|------|--------|
| `docs/log_format.md` | Move from root (binary format reference) |

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Move: `log_002.bin` → `packages/core/tests/fixtures/log_002.bin`
- Move: `log_format.md` → `docs/log_format.md`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "turtlechrono",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=@turtlechrono/web",
    "build": "npm run build --workspace=@turtlechrono/core && npm run build --workspace=@turtlechrono/web",
    "test": "npm run test --workspace=@turtlechrono/core",
    "test:web": "npm run test --workspace=@turtlechrono/web"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.env
*.local
.DS_Store
```

- [ ] **Step 3: Create .env.example**

```
VITE_AMAP_KEY=your_amap_key_here
VITE_AMAP_SECRET=your_amap_secret_here
```

- [ ] **Step 4: Create packages/core/package.json**

```json
{
  "name": "@turtlechrono/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 5: Create packages/core/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create packages/web/package.json**

```json
{
  "name": "@turtlechrono/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@turtlechrono/core": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "lightweight-charts": "^4.1.0",
    "@amap/amap-jsapi-loader": "^1.0.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 7: Create packages/web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 8: Create packages/web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@turtlechrono/core': '/packages/core/src/index.ts',
    },
  },
});
```

- [ ] **Step 9: Create packages/web/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TurtleChrono</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Create placeholder packages/core/src/index.ts**

```typescript
export {};
```

- [ ] **Step 11: Create placeholder packages/web/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div>TurtleChrono</div>
  </React.StrictMode>,
);
```

- [ ] **Step 12: Move test fixture and docs**

```bash
mkdir -p packages/core/tests/fixtures
mv log_002.bin packages/core/tests/fixtures/log_002.bin
mv log_format.md docs/log_format.md
```

- [ ] **Step 13: Install dependencies**

```bash
npm install
```

Expected: All packages install without errors. Workspace links resolved.

- [ ] **Step 14: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
```

Expected: No errors.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with core and web packages"
```

---

### Task 2: Core Types + Barrel Export

**Files:**
- Create: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// packages/core/src/types.ts

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
```

- [ ] **Step 2: Update barrel export**

Replace `packages/core/src/index.ts`:

```typescript
export type {
  LogHeader,
  IMURecord,
  GPSLocationRecord,
  GPSQualityRecord,
  RawLog,
  GPSPoint,
  Gate,
  Lap,
  ProcessedSession,
  DeltaPoint,
  LapDelta,
} from './types';
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): add shared type definitions"
```

---

### Task 3: Binary Test Helpers

**Files:**
- Create: `packages/core/tests/helpers.ts`

These helpers let tests build synthetic `.bin` data without touching real files.

- [ ] **Step 1: Create test helper — LogBuilder**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/tests/helpers.ts
git commit -m "test(core): add binary fixture builder for parser tests"
```

---

### Task 4: Parser + Tests

**Files:**
- Create: `packages/core/src/parser.ts`
- Create: `packages/core/tests/parser.test.ts`

- [ ] **Step 1: Write parser tests**

```typescript
// packages/core/tests/parser.test.ts
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
    const log = parseLog(new LogBuilder().addIMU({ timestampMs: 100 }).build());
    // This should work; now test truncation:
    const truncated = buf;
    expect(() => parseLog(truncated)).toThrow(ParseError);
  });

  it('throws on unknown tag', () => {
    const buf = new ArrayBuffer(2);
    const v = new DataView(buf);
    v.setUint8(0, 0xff); // unknown tag
    expect(() => parseLog(buf)).toThrow(/unknown tag/i);
  });

  it('parses real log_002.bin fixture without error', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const buf = readFileSync(resolve(__dirname, 'fixtures/log_002.bin'));
    const log = parseLog(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    expect(log.gpsLocation.length).toBeGreaterThan(0);
    // All GPS records should have valid coordinates
    for (const rec of log.gpsLocation) {
      expect(Math.abs(rec.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(rec.longitude)).toBeLessThanOrEqual(180);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/tests/parser.test.ts`
Expected: FAIL — `parser.ts` does not exist yet.

- [ ] **Step 3: Implement parser.ts**

```typescript
// packages/core/src/parser.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/tests/parser.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Update barrel export**

Append to `packages/core/src/index.ts`:

```typescript
export { parseLog, ParseError } from './parser';
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parser.ts packages/core/tests/parser.test.ts packages/core/src/index.ts
git commit -m "feat(core): binary TLV log parser with tests"
```

---

### Task 5: Time Utils

**Files:**
- Create: `packages/core/src/time-utils.ts`

No separate test file — time utils are simple enough to verify by inspection. Used by processor.

- [ ] **Step 1: Create time-utils.ts**

```typescript
// packages/core/src/time-utils.ts
import type { LogHeader } from './types';

export function reconstructUtc(header: LogHeader, sampleTickMs: number): Date {
  const headerUtcMs = Date.UTC(
    header.utcYear,
    header.utcMonth - 1,
    header.utcDay,
    header.utcHour,
    header.utcMinute,
    header.utcSecond,
  );
  const deltaMs = sampleTickMs - header.tickOnUtcSync;
  return new Date(headerUtcMs + deltaMs);
}

export function relativeTimeMs(timestampMs: number, sessionStartMs: number): number {
  return timestampMs - sessionStartMs;
}
```

- [ ] **Step 2: Update barrel export**

Append to `packages/core/src/index.ts`:

```typescript
export { reconstructUtc, relativeTimeMs } from './time-utils';
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/time-utils.ts packages/core/src/index.ts
git commit -m "feat(core): UTC reconstruction and relative time utilities"
```

---

### Task 6: Processor — Filter + Interpolate + Distance + Tests

**Files:**
- Create: `packages/core/src/processor.ts`
- Create: `packages/core/tests/processor.test.ts`

- [ ] **Step 1: Write processor tests for filtering, interpolation, and distance**

```typescript
// packages/core/tests/processor.test.ts
import { describe, it, expect } from 'vitest';
import {
  filterGPS,
  interpolateIMU,
  haversineDistance,
  computeCumulativeDistance,
} from '../src/processor';
import type { GPSLocationRecord, GPSQualityRecord, IMURecord, GPSPoint } from '../src/types';

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
    // Timestamp 2000 excluded (fixType=2), others kept
    expect(result).toHaveLength(3);
    expect(result[0].timestampMs).toBe(1000);
    expect(result[1].timestampMs).toBe(3000);
    expect(result[2].timestampMs).toBe(4000);
  });

  it('applies hdop threshold', () => {
    const result = filterGPS(locations, qualities, 1.5);
    // 1000 kept (hdop 1.0), 2000 excluded (fixType), 3000 kept (hdop 0.9), 4000 excluded (hdop 2.0)
    expect(result).toHaveLength(2);
  });

  it('skips locations without matching quality', () => {
    const noQualities: GPSQualityRecord[] = [];
    const result = filterGPS(locations, noQualities);
    expect(result).toHaveLength(0);
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
    // Before first IMU, should clamp to first record
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
    // Shanghai to Suzhou ~100km
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
    // ~11m per 0.001 degree latitude
    expect(result[1].distanceFromStart).toBeGreaterThan(100);
    expect(result[1].distanceFromStart).toBeLessThan(120);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/tests/processor.test.ts`
Expected: FAIL — `processor.ts` does not exist yet.

- [ ] **Step 3: Implement processor.ts (filter, interpolate, distance)**

```typescript
// packages/core/src/processor.ts
import type {
  GPSLocationRecord,
  GPSQualityRecord,
  GPSPoint,
  IMURecord,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/tests/processor.test.ts`
Expected: All tests PASS (filterGPS: 3, interpolateIMU: 3, haversineDistance: 2, computeCumulativeDistance: 1 = 9 total).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/processor.ts packages/core/tests/processor.test.ts
git commit -m "feat(core): GPS filtering, IMU interpolation, haversine distance"
```

---

### Task 7: Processor — Lap Detection + Delta + Tests

**Files:**
- Modify: `packages/core/src/processor.ts` (append functions)
- Modify: `packages/core/tests/processor.test.ts` (append test blocks)

- [ ] **Step 1: Write tests for lap detection and delta**

Append to `packages/core/tests/processor.test.ts`:

```typescript
import type { Gate, Lap } from '../src/types';

// (Add to existing imports at top: Gate, Lap, LapDelta)
// (Add to existing imports at top: detectGateCrossings, splitLaps, computeLapDelta, processSession)
```

Then append these describe blocks:

```typescript
describe('detectGateCrossings', () => {
  // Straight line going north, gate across at latitude 31.232
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
      makePoint(0, 31.230),
      makePoint(40, 31.233),   // crossing 1 (between index 0-1)
      makePoint(80, 31.234),
      makePoint(120, 31.230),
      makePoint(160, 31.233),  // crossing 2 (between index 3-4)
    ];
    const crossings = detectGateCrossings(points, gate);
    expect(crossings).toEqual([1, 4]);
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

  it('splits into two laps for three crossings', () => {
    const points = [
      makePoint(0, 31.230),
      makePoint(40, 31.233),   // crossing 1
      makePoint(80, 31.236),
      makePoint(120, 31.230),
      makePoint(160, 31.233),  // crossing 2
      makePoint(200, 31.236),
      makePoint(240, 31.230),
      makePoint(280, 31.233),  // crossing 3
    ];
    const laps = splitLaps(points, gate);
    expect(laps).toHaveLength(2);
    expect(laps[0].startTimeMs).toBe(points[1].timestampMs);
    expect(laps[0].endTimeMs).toBe(points[4].timestampMs);
    expect(laps[1].startTimeMs).toBe(points[4].timestampMs);
    expect(laps[1].endTimeMs).toBe(points[7].timestampMs);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/tests/processor.test.ts`
Expected: New tests FAIL — `detectGateCrossings`, `splitLaps`, `computeLapDelta` not exported yet.

- [ ] **Step 3: Append lap detection and delta functions to processor.ts**

Append to `packages/core/src/processor.ts`:

```typescript
import type { Gate, Lap, ProcessedSession, RawLog, LapDelta, DeltaPoint } from './types';

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/tests/processor.test.ts`
Expected: All tests PASS (previous 9 + detectGateCrossings: 3, splitLaps: 2, computeLapDelta: 4 = 18 total).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/processor.ts packages/core/tests/processor.test.ts
git commit -m "feat(core): lap gate detection, lap splitting, delta computation"
```

---

### Task 8: processSession Orchestrator + Barrel Export

**Files:**
- Modify: `packages/core/src/processor.ts` (append `processSession`)
- Modify: `packages/core/src/index.ts` (add processor exports)

- [ ] **Step 1: Append processSession to processor.ts**

```typescript
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
```

- [ ] **Step 2: Update barrel export**

Replace `packages/core/src/index.ts` with full exports:

```typescript
export type {
  LogHeader,
  IMURecord,
  GPSLocationRecord,
  GPSQualityRecord,
  RawLog,
  GPSPoint,
  Gate,
  Lap,
  ProcessedSession,
  DeltaPoint,
  LapDelta,
} from './types';

export { parseLog, ParseError } from './parser';
export { reconstructUtc, relativeTimeMs } from './time-utils';
export {
  filterGPS,
  interpolateIMU,
  haversineDistance,
  computeCumulativeDistance,
  detectGateCrossings,
  splitLaps,
  computeLapDelta,
  processSession,
} from './processor';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p packages/core/tsconfig.json`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/processor.ts packages/core/src/index.ts
git commit -m "feat(core): processSession orchestrator + full barrel export"
```

---

### Task 9: Zustand Store

**Files:**
- Create: `packages/web/src/store/session-store.ts`

- [ ] **Step 1: Create the Zustand store**

```typescript
// packages/web/src/store/session-store.ts
import { create } from 'zustand';
import type { RawLog, ProcessedSession, Gate, LapDelta } from '@turtlechrono/core';

interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  speed: 1 | 2 | 4;
}

interface SessionStore {
  rawLog: RawLog | null;
  session: ProcessedSession | null;
  currentLapIndex: number;
  referenceLapIndex: number | null;
  startFinishGate: Gate | null;
  playback: PlaybackState;
  focusedPanel: string | null;
  lapDelta: LapDelta | null;
  gateMode: boolean;
  error: string | null;

  setRawLog: (log: RawLog) => void;
  setSession: (session: ProcessedSession) => void;
  setCurrentLapIndex: (index: number) => void;
  setReferenceLapIndex: (index: number | null) => void;
  setStartFinishGate: (gate: Gate | null) => void;
  setPlayback: (partial: Partial<PlaybackState>) => void;
  setFocusedPanel: (panel: string | null) => void;
  setLapDelta: (delta: LapDelta | null) => void;
  setGateMode: (mode: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  rawLog: null,
  session: null,
  currentLapIndex: 0,
  referenceLapIndex: null as number | null,
  startFinishGate: null as Gate | null,
  playback: {
    currentTime: 0,
    isPlaying: false,
    speed: 1 as const,
  },
  focusedPanel: null as string | null,
  lapDelta: null as LapDelta | null,
  gateMode: false,
  error: null as string | null,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setRawLog: (rawLog) => set({ rawLog }),
  setSession: (session) => set({ session }),
  setCurrentLapIndex: (currentLapIndex) => set({ currentLapIndex }),
  setReferenceLapIndex: (referenceLapIndex) => set({ referenceLapIndex }),
  setStartFinishGate: (startFinishGate) => set({ startFinishGate }),
  setPlayback: (partial) =>
    set((state) => ({ playback: { ...state.playback, ...partial } })),
  setFocusedPanel: (focusedPanel) => set({ focusedPanel }),
  setLapDelta: (lapDelta) => set({ lapDelta }),
  setGateMode: (gateMode) => set({ gateMode }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/store/session-store.ts
git commit -m "feat(web): Zustand session store"
```

---

### Task 10: App Shell + FocusWrapper + Layout CSS

**Files:**
- Modify: `packages/web/src/main.tsx`
- Modify: `packages/web/src/App.tsx` (replace placeholder)
- Create: `packages/web/src/App.module.css`
- Create: `packages/web/src/components/FocusWrapper.tsx`
- Create: `packages/web/src/components/FocusWrapper.module.css`

- [ ] **Step 1: Create FocusWrapper.module.css**

```css
/* packages/web/src/components/FocusWrapper.module.css */
.wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.wrapper.expanded {
  position: fixed;
  inset: 0;
  z-index: 100;
  border-radius: 0;
  cursor: default;
}

.collapseBtn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 101;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 14px;
}
```

- [ ] **Step 2: Create FocusWrapper.tsx**

```tsx
// packages/web/src/components/FocusWrapper.tsx
import { type ReactNode, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/session-store';
import styles from './FocusWrapper.module.css';

interface FocusWrapperProps {
  panelId: string;
  children: ReactNode;
  className?: string;
}

export function FocusWrapper({ panelId, children, className }: FocusWrapperProps) {
  const focusedPanel = useSessionStore((s) => s.focusedPanel);
  const setFocusedPanel = useSessionStore((s) => s.setFocusedPanel);
  const isExpanded = focusedPanel === panelId;

  const handleClick = useCallback(() => {
    if (!isExpanded) {
      setFocusedPanel(panelId);
    }
  }, [isExpanded, panelId, setFocusedPanel]);

  const handleCollapse = useCallback(() => {
    setFocusedPanel(null);
  }, [setFocusedPanel]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusedPanel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, setFocusedPanel]);

  return (
    <div
      className={`${styles.wrapper} ${isExpanded ? styles.expanded : ''} ${className ?? ''}`}
      onClick={handleClick}
    >
      {children}
      {isExpanded && (
        <button className={styles.collapseBtn} onClick={handleCollapse}>
          ✕ Esc
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create App.module.css**

```css
/* packages/web/src/App.module.css */
.app {
  display: grid;
  grid-template-columns: 220px 1fr;
  grid-template-rows: 1fr auto auto auto;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.sidebar {
  grid-column: 1;
  grid-row: 1 / 5;
}

.mapPanel {
  grid-column: 2;
  grid-row: 1;
  min-height: 300px;
}

.middleRow {
  grid-column: 2;
  grid-row: 2;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 4px;
  min-height: 200px;
}

.chartPanel {
  grid-column: 2;
  grid-row: 3;
  min-height: 180px;
}

.playbackBar {
  grid-column: 2;
  grid-row: 4;
}

.gap {
  gap: 4px;
  padding: 4px;
}
```

- [ ] **Step 4: Create App.tsx**

```tsx
// packages/web/src/App.tsx
import { FocusWrapper } from './components/FocusWrapper';
import { Sidebar } from './components/Sidebar';
import { MapPanel } from './components/MapPanel';
import { GForcePanel } from './components/GForcePanel';
import { ChartPanel } from './components/ChartPanel';
import { PlaybackBar } from './components/PlaybackBar';
import { LapInfoPanel } from './components/LapInfoPanel';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.app}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>
      <FocusWrapper panelId="map" className={`${styles.mapPanel} ${styles.gap}`}>
        <MapPanel />
      </FocusWrapper>
      <div className={`${styles.middleRow} ${styles.gap}`}>
        <FocusWrapper panelId="gforce">
          <GForcePanel />
        </FocusWrapper>
        <LapInfoPanel />
      </div>
      <FocusWrapper panelId="chart" className={`${styles.chartPanel} ${styles.gap}`}>
        <ChartPanel />
      </FocusWrapper>
      <div className={`${styles.playbackBar} ${styles.gap}`}>
        <PlaybackBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update main.tsx**

```tsx
// packages/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 6: Create placeholder components**

Each component will be fully implemented in later tasks. For now create minimal stubs so App compiles.

Create `packages/web/src/components/Sidebar.tsx`:

```tsx
export function Sidebar() {
  return <div>Sidebar</div>;
}
```

Create `packages/web/src/components/MapPanel.tsx`:

```tsx
export function MapPanel() {
  return <div>Map</div>;
}
```

Create `packages/web/src/components/GForcePanel.tsx`:

```tsx
export function GForcePanel() {
  return <div>G-Force</div>;
}
```

Create `packages/web/src/components/ChartPanel.tsx`:

```tsx
export function ChartPanel() {
  return <div>Chart</div>;
}
```

Create `packages/web/src/components/PlaybackBar.tsx`:

```tsx
export function PlaybackBar() {
  return <div>Playback</div>;
}
```

Create `packages/web/src/components/LapInfoPanel.tsx`:

```tsx
export function LapInfoPanel() {
  return <div>Lap Info</div>;
}
```

- [ ] **Step 7: Verify dev server starts**

Run: `npm run dev`
Expected: Vite dev server starts without errors. Page renders "TurtleChrono" dashboard shell.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/
git commit -m "feat(web): app shell with dashboard grid, FocusWrapper, stub components"
```

---

### Task 11: useLogLoader Hook + Sidebar Component

**Files:**
- Create: `packages/web/src/hooks/useLogLoader.ts`
- Modify: `packages/web/src/components/Sidebar.tsx` (replace stub)
- Create: `packages/web/src/components/Sidebar.module.css`

- [ ] **Step 1: Create useLogLoader hook**

```typescript
// packages/web/src/hooks/useLogLoader.ts
import { useCallback } from 'react';
import { parseLog, processSession, computeLapDelta } from '@turtlechrono/core';
import type { Gate } from '@turtlechrono/core';
import { useSessionStore } from '../store/session-store';

export function useLogLoader() {
  const store = useSessionStore;

  const loadFile = useCallback(async (file: File) => {
    store.getState().reset();
    try {
      const buffer = await file.arrayBuffer();
      const rawLog = parseLog(buffer);
      store.getState().setRawLog(rawLog);
      store.getState().setError(null);
    } catch (e) {
      store.getState().setError(e instanceof Error ? e.message : 'Failed to parse log file');
    }
  }, []);

  const setGateAndProcess = useCallback((gate: Gate) => {
    const { rawLog } = store.getState();
    if (!rawLog) return;

    store.getState().setStartFinishGate(gate);
    const session = processSession(rawLog, gate);
    store.getState().setSession(session);

    if (session.laps.length > 0) {
      store.getState().setCurrentLapIndex(0);
      const bestIdx = session.bestLapIndex >= 0 ? session.bestLapIndex : 0;
      store.getState().setReferenceLapIndex(bestIdx);

      // Compute initial delta (first lap vs best)
      if (bestIdx !== 0) {
        const delta = computeLapDelta(session.laps[0], session.laps[bestIdx]);
        store.getState().setLapDelta(delta);
      } else {
        store.getState().setLapDelta(null);
      }
    }
  }, []);

  const selectCurrentLap = useCallback((index: number) => {
    const { session, referenceLapIndex } = store.getState();
    store.getState().setCurrentLapIndex(index);
    if (session && referenceLapIndex !== null && referenceLapIndex !== index) {
      const delta = computeLapDelta(session.laps[index], session.laps[referenceLapIndex]);
      store.getState().setLapDelta(delta);
    } else {
      store.getState().setLapDelta(null);
    }
    store.getState().setPlayback({ currentTime: 0, isPlaying: false });
  }, []);

  const selectReferenceLap = useCallback((index: number | null) => {
    const { session, currentLapIndex } = store.getState();
    store.getState().setReferenceLapIndex(index);
    if (session && index !== null && index !== currentLapIndex) {
      const delta = computeLapDelta(session.laps[currentLapIndex], session.laps[index]);
      store.getState().setLapDelta(delta);
    } else {
      store.getState().setLapDelta(null);
    }
  }, []);

  return { loadFile, setGateAndProcess, selectCurrentLap, selectReferenceLap };
}
```

- [ ] **Step 2: Create Sidebar.module.css**

```css
/* packages/web/src/components/Sidebar.module.css */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #16213e;
  height: 100%;
  overflow-y: auto;
}

.sectionTitle {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
  margin: 0;
}

.loadBtn {
  padding: 8px 16px;
  background: #0f3460;
  color: #e0e0e0;
  border: 1px solid #1a1a5e;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.loadBtn:hover {
  background: #1a4a8a;
}

.gateBtn {
  padding: 8px 16px;
  background: #533483;
  color: #e0e0e0;
  border: 1px solid #7b2d8e;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.gateBtn:hover {
  background: #6b44a8;
}

.gateBtn.active {
  background: #e94560;
  border-color: #e94560;
}

.lapList {
  list-style: none;
  padding: 0;
  margin: 0;
}

.lapItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.lapItem:hover {
  background: rgba(255, 255, 255, 0.05);
}

.lapItem.current {
  background: #0f3460;
}

.lapItem.reference {
  border: 1px solid #e94560;
}

.lapItem.best {
  color: #4ecca3;
}

.lapTime {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.refBtn {
  padding: 2px 6px;
  font-size: 10px;
  background: #533483;
  color: #e0e0e0;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.empty {
  color: #666;
  font-size: 12px;
  font-style: italic;
}

.error {
  color: #e94560;
  font-size: 12px;
  background: rgba(233, 69, 96, 0.1);
  padding: 8px;
  border-radius: 4px;
  margin: 0;
}
```

- [ ] **Step 3: Implement Sidebar.tsx**

Replace the stub `packages/web/src/components/Sidebar.tsx`:

```tsx
// packages/web/src/components/Sidebar.tsx
import { useRef } from 'react';
import { useSessionStore } from '../store/session-store';
import { useLogLoader } from '../hooks/useLogLoader';
import styles from './Sidebar.module.css';

function formatLapTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

export function Sidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);
  const rawLog = useSessionStore((s) => s.rawLog);
  const gateMode = useSessionStore((s) => s.gateMode);
  const setGateMode = useSessionStore((s) => s.setGateMode);
  const error = useSessionStore((s) => s.error);
  const { loadFile, selectCurrentLap, selectReferenceLap } = useLogLoader();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.bin')) loadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const laps = session?.laps ?? [];

  return (
    <div
      className={styles.sidebar}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <button className={styles.loadBtn} onClick={() => fileInputRef.current?.click()}>
        Load .bin File
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {error && <p className={styles.error}>{error}</p>}

      {rawLog && !session && (
        <button
          className={`${styles.gateBtn} ${gateMode ? styles.active : ''}`}
          onClick={() => setGateMode(!gateMode)}
        >
          {gateMode ? 'Cancel Gate' : 'Set S/F Gate'}
        </button>
      )}

      <p className={styles.sectionTitle}>Laps</p>
      {laps.length === 0 ? (
        <p className={styles.empty}>
          {rawLog
            ? 'Set start/finish gate to split laps'
            : 'Load a file to begin'}
        </p>
      ) : (
        <ul className={styles.lapList}>
          {laps.map((lap, i) => (
            <li
              key={i}
              className={`${styles.lapItem} ${
                i === currentLapIndex ? styles.current : ''
              } ${
                i === referenceLapIndex ? styles.reference : ''
              } ${
                i === session!.bestLapIndex ? styles.best : ''
              }`}
              onClick={() => selectCurrentLap(i)}
            >
              <span>
                L{i + 1}
                {i === session!.bestLapIndex ? ' ★' : ''}
              </span>
              <span className={styles.lapTime}>{formatLapTime(lap.durationMs)}</span>
              <button
                className={styles.refBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  selectReferenceLap(i === referenceLapIndex ? null : i);
                }}
              >
                {i === referenceLapIndex ? 'Unref' : 'Ref'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/hooks/useLogLoader.ts packages/web/src/components/Sidebar.tsx packages/web/src/components/Sidebar.module.css
git commit -m "feat(web): useLogLoader hook and Sidebar with lap selection"
```

---

### Task 12: usePlayback Hook + PlaybackBar Component

**Files:**
- Create: `packages/web/src/hooks/usePlayback.ts`
- Modify: `packages/web/src/components/PlaybackBar.tsx` (replace stub)
- Create: `packages/web/src/components/PlaybackBar.module.css`

- [ ] **Step 1: Create usePlayback hook**

```typescript
// packages/web/src/hooks/usePlayback.ts
import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../store/session-store';

export function usePlayback() {
  const playback = useSessionStore((s) => s.playback);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const session = useSessionStore((s) => s.session);
  const setPlayback = useSessionStore((s) => s.setPlayback);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const lap = session?.laps[currentLapIndex];
  const lapDuration = lap?.durationMs ?? 0;

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaMs = (timestamp - lastTimeRef.current) * playback.speed;
      lastTimeRef.current = timestamp;

      const newTime = playback.currentTime + deltaMs;

      if (newTime >= lapDuration) {
        setPlayback({ currentTime: lapDuration, isPlaying: false });
        return;
      }

      setPlayback({ currentTime: newTime });
      rafRef.current = requestAnimationFrame(animate);
    },
    [playback.currentTime, playback.speed, lapDuration, setPlayback],
  );

  useEffect(() => {
    if (playback.isPlaying) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [playback.isPlaying, animate]);

  const play = useCallback(() => setPlayback({ isPlaying: true }), [setPlayback]);
  const pause = useCallback(() => setPlayback({ isPlaying: false }), [setPlayback]);
  const seek = useCallback(
    (time: number) => setPlayback({ currentTime: time }),
    [setPlayback],
  );
  const setSpeed = useCallback(
    (speed: 1 | 2 | 4) => setPlayback({ speed }),
    [setPlayback],
  );

  return { play, pause, seek, setSpeed };
}
```

- [ ] **Step 2: Create PlaybackBar.module.css**

```css
/* packages/web/src/components/PlaybackBar.module.css */
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #16213e;
  border-radius: 4px;
}

.playBtn {
  background: none;
  border: none;
  color: #e0e0e0;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
}

.scrubber {
  flex: 1;
  accent-color: #4ecca3;
}

.timeLabel {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  min-width: 100px;
  text-align: center;
}

.speedBtn {
  padding: 4px 10px;
  background: #0f3460;
  color: #e0e0e0;
  border: 1px solid #1a1a5e;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.speedBtn.active {
  background: #4ecca3;
  color: #1a1a2e;
}
```

- [ ] **Step 3: Implement PlaybackBar.tsx**

Replace the stub `packages/web/src/components/PlaybackBar.tsx`:

```tsx
// packages/web/src/components/PlaybackBar.tsx
import { useSessionStore } from '../store/session-store';
import { usePlayback } from '../hooks/usePlayback';
import styles from './PlaybackBar.module.css';

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(1).padStart(4, '0')}`;
}

export function PlaybackBar() {
  const playback = useSessionStore((s) => s.playback);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const session = useSessionStore((s) => s.session);
  const { play, pause, seek, setSpeed } = usePlayback();

  const lapDuration = session?.laps[currentLapIndex]?.durationMs ?? 0;
  const speeds: (1 | 2 | 4)[] = [1, 2, 4];

  return (
    <div className={styles.bar}>
      <button
        className={styles.playBtn}
        onClick={playback.isPlaying ? pause : play}
      >
        {playback.isPlaying ? '⏸' : '▶'}
      </button>
      <input
        className={styles.scrubber}
        type="range"
        min={0}
        max={lapDuration || 1}
        value={playback.currentTime}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <span className={styles.timeLabel}>
        {formatTime(playback.currentTime)} / {formatTime(lapDuration)}
      </span>
      {speeds.map((s) => (
        <button
          key={s}
          className={`${styles.speedBtn} ${playback.speed === s ? styles.active : ''}`}
          onClick={() => setSpeed(s)}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/hooks/usePlayback.ts packages/web/src/components/PlaybackBar.tsx packages/web/src/components/PlaybackBar.module.css
git commit -m "feat(web): usePlayback hook and PlaybackBar with speed controls"
```

---

### Task 13: MapPanel (AMap)

**Files:**
- Modify: `packages/web/src/components/MapPanel.tsx` (replace stub)
- Create: `packages/web/src/components/MapPanel.module.css`

The MapPanel uses AMap JS API 2.0 loaded via `@amap/amap-jsapi-loader`. It renders satellite tiles, the track polyline colored by delta, a moving position marker, and a gate editor (two-click placement).

- [ ] **Step 1: Create MapPanel.module.css**

```css
/* packages/web/src/components/MapPanel.module.css */
.container {
  width: 100%;
  height: 100%;
  min-height: 300px;
}

.map {
  width: 100%;
  height: 100%;
}

.gateHint {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(233, 69, 96, 0.9);
  color: white;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  z-index: 10;
  pointer-events: none;
}

.noData {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 14px;
}
```

- [ ] **Step 2: Implement MapPanel.tsx**

Replace the stub `packages/web/src/components/MapPanel.tsx`:

```tsx
// packages/web/src/components/MapPanel.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [gateMode, setGateMode] = useState(false);
  const [gatePoints, setGatePoints] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const playback = useSessionStore((s) => s.playback);
  const lapDelta = useSessionStore((s) => s.lapDelta);
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
      if (!gateMode) return;
      const lat = e.lnglat.getLat();
      const lng = e.lnglat.getLng();
      setGatePoints((prev) => {
        const next = [...prev, { latitude: lat, longitude: lng }];
        if (next.length === 2) {
          setGateMode(false);
          setGateAndProcess({
            pointA: next[0],
            pointB: next[1],
          });
          setGatePoints([]);
        }
        return next;
      });
    });
  }, [AMap, gateMode, setGateAndProcess]);

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

    // Simple single-color polyline; delta coloring can be added with AMap.PolylineEditor
    // For v1, use a single color with 2px width
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

    // Find the point closest to playback.currentTime
    const targetTime = lap.points[0].timestampMs + playback.currentTime;
    let closest = lap.points[0];
    for (const p of lap.points) {
      if (Math.abs(p.timestampMs - targetTime) < Math.abs(closest.timestampMs - targetTime)) {
        closest = p;
      }
    }

    markerRef.current.setCenter([closest.longitude, closest.latitude]);
  }, [session, currentLapIndex, playback.currentTime]);

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
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/MapPanel.tsx packages/web/src/components/MapPanel.module.css
git commit -m "feat(web): MapPanel with AMap satellite, track overlay, gate editor"
```

---

### Task 14: GForcePanel + LapInfoPanel

**Files:**
- Modify: `packages/web/src/components/GForcePanel.tsx` (replace stub)
- Create: `packages/web/src/components/GForcePanel.module.css`
- Modify: `packages/web/src/components/LapInfoPanel.tsx` (replace stub)
- Create: `packages/web/src/components/LapInfoPanel.module.css`

- [ ] **Step 1: Create GForcePanel.module.css**

```css
/* packages/web/src/components/GForcePanel.module.css */
.container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #16213e;
  border-radius: 4px;
}

.noData {
  color: #666;
  font-size: 12px;
}
```

- [ ] **Step 2: Implement GForcePanel.tsx**

Replace the stub `packages/web/src/components/GForcePanel.tsx`:

```tsx
// packages/web/src/components/GForcePanel.tsx
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

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Accel', cx, 18);
    ctx.fillText('Brake', cx, size - 4);
    ctx.textAlign = 'left';
    ctx.fillText('L', 8, cy + 4);
    ctx.textAlign = 'right';
    ctx.fillText('R', size - 8, cy + 4);

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
        // lateral = accel x (left/right), longitudinal = accel y (forward/back)
        lateralG = closest.accel[0] / 9.81;
        longitudinalG = -closest.accel[1] / 9.81; // invert so accel is up
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
```

- [ ] **Step 3: Create LapInfoPanel.module.css**

```css
/* packages/web/src/components/LapInfoPanel.module.css */
.panel {
  padding: 12px 16px;
  background: #16213e;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}

.value {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 18px;
  font-weight: bold;
}

.value.best {
  color: #4ecca3;
}

.value.deltaPos {
  color: #e94560;
}

.value.deltaNeg {
  color: #4ecca3;
}

.speed {
  font-size: 28px;
  color: #4ecca3;
}

.noData {
  color: #666;
  font-size: 12px;
}
```

- [ ] **Step 4: Implement LapInfoPanel.tsx**

Replace the stub `packages/web/src/components/LapInfoPanel.tsx`:

```tsx
// packages/web/src/components/LapInfoPanel.tsx
import { useSessionStore } from '../store/session-store';
import styles from './LapInfoPanel.module.css';

function formatLapTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

function formatDelta(ms: number): string {
  const prefix = ms >= 0 ? '+' : '';
  return `${prefix}${(ms / 1000).toFixed(3)}s`;
}

export function LapInfoPanel() {
  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const bestLapIndex = useSessionStore((s) => s.session?.bestLapIndex ?? -1);
  const lapDelta = useSessionStore((s) => s.lapDelta);
  const playback = useSessionStore((s) => s.playback);

  if (!session || session.laps.length === 0) {
    return (
      <div className={styles.panel}>
        <span className={styles.noData}>No lap data</span>
      </div>
    );
  }

  const lap = session.laps[currentLapIndex];
  if (!lap) return null;

  const bestLap = session.laps[bestLapIndex];

  // Find current speed at playback position
  let currentSpeed = 0;
  if (lap.points.length > 0) {
    const targetTime = lap.points[0].timestampMs + playback.currentTime;
    let closest = lap.points[0];
    for (const p of lap.points) {
      if (Math.abs(p.timestampMs - targetTime) < Math.abs(closest.timestampMs - targetTime)) {
        closest = p;
      }
    }
    currentSpeed = closest.speedKmh;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.label}>Current</span>
        <span className={styles.value}>
          {formatLapTime(playback.currentTime)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Lap Time</span>
        <span className={styles.value}>
          {formatLapTime(lap.durationMs)}
        </span>
      </div>
      {bestLap && bestLapIndex !== currentLapIndex && (
        <div className={styles.row}>
          <span className={styles.label}>Best</span>
          <span className={`${styles.value} ${styles.best}`}>
            {formatLapTime(bestLap.durationMs)}
          </span>
        </div>
      )}
      {lapDelta && (
        <div className={styles.row}>
          <span className={styles.label}>Delta</span>
          <span
            className={`${styles.value} ${
              lapDelta.totalTimeDeltaMs >= 0 ? styles.deltaPos : styles.deltaNeg
            }`}
          >
            {formatDelta(lapDelta.totalTimeDeltaMs)}
          </span>
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.label}>Speed</span>
        <span className={`${styles.value} ${styles.speed}`}>
          {currentSpeed.toFixed(0)}
          <span style={{ fontSize: 14, fontWeight: 'normal' }}> km/h</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/GForcePanel.tsx packages/web/src/components/GForcePanel.module.css packages/web/src/components/LapInfoPanel.tsx packages/web/src/components/LapInfoPanel.module.css
git commit -m "feat(web): GForcePanel canvas and LapInfoPanel with delta display"
```

---

### Task 15: ChartPanel (Lightweight Charts)

**Files:**
- Modify: `packages/web/src/components/ChartPanel.tsx` (replace stub)
- Create: `packages/web/src/components/ChartPanel.module.css`

Uses TradingView Lightweight Charts to render speed vs distance (line) and delta (histogram). The reference lap is shown as a faint overlay. Crosshair syncs with playback position.

- [ ] **Step 1: Create ChartPanel.module.css**

```css
/* packages/web/src/components/ChartPanel.module.css */
.container {
  width: 100%;
  height: 100%;
  min-height: 160px;
  background: #16213e;
  border-radius: 4px;
  overflow: hidden;
}

.chart {
  width: 100%;
  height: 100%;
}

.noData {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 12px;
}
```

- [ ] **Step 2: Implement ChartPanel.tsx**

Replace the stub `packages/web/src/components/ChartPanel.tsx`:

```tsx
// packages/web/src/components/ChartPanel.tsx
import { useRef, useEffect } from 'react';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useSessionStore } from '../store/session-store';
import styles from './ChartPanel.module.css';

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const speedSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const deltaSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const refSpeedSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const session = useSessionStore((s) => s.session);
  const currentLapIndex = useSessionStore((s) => s.currentLapIndex);
  const referenceLapIndex = useSessionStore((s) => s.referenceLapIndex);
  const lapDelta = useSessionStore((s) => s.lapDelta);
  const playback = useSessionStore((s) => s.playback);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#16213e' },
        textColor: '#888',
      },
      grid: {
        vertLines: { color: '#1a3a6a' },
        horzLines: { color: '#1a3a6a' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#1a3a6a' },
      timeScale: { borderColor: '#1a3a6a', timeVisible: false },
    });

    chartRef.current = chart;

    const speedSeries = chart.addAreaSeries({
      lineColor: '#4ecca3',
      topColor: 'rgba(78, 204, 163, 0.3)',
      bottomColor: 'rgba(78, 204, 163, 0.0)',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (p: number) => `${p.toFixed(0)} km/h` },
    });
    speedSeriesRef.current = speedSeries;

    const deltaSeries = chart.addHistogramSeries({
      priceFormat: { type: 'custom', formatter: (p: number) => `${(p / 1000).toFixed(2)}s` },
      priceScaleId: 'delta',
    });

    chart.priceScale('delta').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    });
    deltaSeriesRef.current = deltaSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update data when lap/delta changes
  useEffect(() => {
    if (!chartRef.current || !speedSeriesRef.current || !session) return;

    const lap = session.laps[currentLapIndex];
    if (!lap || lap.points.length === 0) return;

    // Speed vs distance (use distance as x-axis via "time" field workaround)
    const speedData = lap.points.map((p, i) => ({
      time: i as unknown as string,
      value: p.speedKmh,
    }));
    speedSeriesRef.current.setData(speedData as never);

    // Reference lap overlay
    if (refSpeedSeriesRef.current) {
      chartRef.current.removeSeries(refSpeedSeriesRef.current);
      refSpeedSeriesRef.current = null;
    }

    if (referenceLapIndex !== null && referenceLapIndex !== currentLapIndex) {
      const refLap = session.laps[referenceLapIndex];
      if (refLap) {
        const refSeries = chartRef.current.addLineSeries({
          lineColor: 'rgba(233, 69, 96, 0.3)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const refData = refLap.points.map((p, i) => ({
          time: i as unknown as string,
          value: p.speedKmh,
        }));
        refSeries.setData(refData as never);
        refSpeedSeriesRef.current = refSeries;
      }
    }

    // Delta histogram
    if (deltaSeriesRef.current) {
      if (lapDelta && lapDelta.points.length > 0) {
        const deltaData = lapDelta.points.map((dp, i) => ({
          time: i as unknown as string,
          value: dp.deltaMs,
          color: dp.deltaMs <= 0 ? 'rgba(78, 204, 163, 0.6)' : 'rgba(233, 69, 96, 0.6)',
        }));
        deltaSeriesRef.current.setData(deltaData as never);
      } else {
        deltaSeriesRef.current.setData([]);
      }
    }
  }, [session, currentLapIndex, referenceLapIndex, lapDelta]);

  // Move crosshair to playback position
  useEffect(() => {
    if (!chartRef.current || !session) return;
    const lap = session.laps[currentLapIndex];
    if (!lap || lap.points.length === 0) return;

    // Find index closest to playback time
    const targetTime = lap.points[0].timestampMs + playback.currentTime;
    let closestIdx = 0;
    for (let i = 0; i < lap.points.length; i++) {
      if (Math.abs(lap.points[i].timestampMs - targetTime) < Math.abs(lap.points[closestIdx].timestampMs - targetTime)) {
        closestIdx = i;
      }
    }

    chartRef.current.setCrosshairPosition(
      undefined,
      closestIdx as unknown as string,
      speedSeriesRef.current!,
    );
  }, [session, currentLapIndex, playback.currentTime]);

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>Load a log file to view charts</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.chart} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/ChartPanel.tsx packages/web/src/components/ChartPanel.module.css
git commit -m "feat(web): ChartPanel with speed line, delta histogram, reference overlay"
```

---

### Task 16: MapPanel Gate Mode Integration + Unsplit Handling + Final Verification

**Files:**
- Modify: `packages/web/src/components/MapPanel.tsx` (use store gateMode, add unsplit trace)

The Sidebar (Task 11) and store (Task 9) already include `gateMode` state. This task wires MapPanel to use the store's `gateMode` and adds "Unsplit" trace display.

- [ ] **Step 1: Update MapPanel to use store gateMode**

In `packages/web/src/components/MapPanel.tsx`, replace the local `gateMode`/`setGatePoints` state with store values:

```tsx
// Remove these local states:
// const [gateMode, setGateMode] = useState(false);
// const [gatePoints, setGatePoints<...>([]);

// Add store access:
const gateMode = useSessionStore((s) => s.gateMode);
const setGateMode = useSessionStore((s) => s.setGateMode);
```

Update the map click handler to use `setGateMode(false)` instead of local state, and use a local ref for the two gate points:

```tsx
const gateClickPoints = useRef<{ latitude: number; longitude: number }[]>([]);

// In map click handler:
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
```

- [ ] **Step 2: Add Unsplit trace display**

When `splitLaps` returns an empty array (fewer than 2 gate crossings), display the full GPS trace on the map as a single "Unsplit" line. In the Sidebar, show a message prompting the user to reposition the gate.

In `MapPanel.tsx`, after the lap polyline drawing `useEffect`, add handling for the unsplit case:

```tsx
// After the lap polyline effect, add:
useEffect(() => {
  if (!mapRef.current || !AMap || !session) return;
  if (session.laps.length > 0) return; // laps exist, no unsplit needed

  // Draw full trace as unsplit
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
```

- [ ] **Step 3: Verify full flow**

Run: `npm run dev`

Manual test:
1. Click "Load .bin File" → select `log_002.bin`
2. Unsplit trace appears on map (dashed gray line)
3. Click "Set S/F Gate" → sidebar button turns red
4. Click two points on map → gate set, laps computed, lap list appears, dashed line replaced with solid green
5. Click a lap → chart/map/g-force update
6. Click "Ref" on another lap → delta appears
7. Press play → position marker moves, G-force ball animates, chart crosshair tracks
8. Click a panel → expands to full view
9. Press Esc → returns to dashboard

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Both `@turtlechrono/core` and `@turtlechrono/web` build without errors.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All parser and processor tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(web): integrate gate editor, finalize dashboard wiring"
```
