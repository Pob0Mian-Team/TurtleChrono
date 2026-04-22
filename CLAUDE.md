# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm install              # Install all dependencies (workspaces)
npm run dev              # Start Vite dev server (web app, port 5173)
npm run build            # Build core then web for production
npm test                 # Run core library tests (Vitest)
npm run test:web         # Run web app tests (Vitest)
```

Running a single test file:
```bash
npx vitest run packages/core/tests/parser.test.ts
```

## Architecture

This is a **npm workspaces** monorepo with two packages:

- **`packages/core`** (`@turtlechrono/core`) — Pure TypeScript, no DOM. Binary log parser, GPS filtering, IMU interpolation, lap detection, and delta computation. Exported via `src/index.ts` barrel. Tests in `tests/` use a `LogBuilder` helper (`tests/helpers.ts`) for synthetic binary fixtures plus a real device log (`tests/fixtures/log_002.bin`).
- **`packages/web`** (`@turtlechrono/web`) — React 18 SPA. Imports `@turtlechrono/core` via Vite alias (resolves directly to `core/src/index.ts`, no build step needed). State is a single Zustand store (`src/store/session-store.ts`). Components are CSS Modules (`.module.css`).

### Data Pipeline

1. `parser.ts` — binary `.bin` file → `RawLog` (typed record arrays via `DataView`, little-endian TLV format)
2. `processor.ts` — `processSession()` orchestrates: `filterGPS` (fixType < 3 or HDOP > 5.0 rejected) → `interpolateIMU` (binary search + linear interp) → `computeCumulativeDistance` (haversine) → `splitLaps` (segment-intersection gate crossing detection) → `computeLapDelta` (distance-mapped time comparison)

### Key Web Components

- `FocusWrapper` — click-to-expand panel wrapper (Esc to collapse)
- `MapPanel` — AMap satellite tiles, track overlay, gate editor
- `ChartPanel` — Lightweight Charts speed/delta with crosshair synced to playback
- `GForcePanel` — Canvas-rendered G-force ball with fading trail
- `PlaybackBar` — play/pause, scrub, 1x/2x/4x speed
- `Sidebar` — file load, lap selection, reference lap picker

## Configuration

Map requires AMap API credentials in `.env`:
```
VITE_AMAP_KEY=...
VITE_AMAP_SECRET=...
```
The app works without these — only satellite tiles won't render.

## Binary Log Format

See `docs/log_format.md` for the complete TLV specification. Tag `0x88` = LogHeader (32B), `0x01` = IMU (28B), `0x02` = GPS Location (16B), `0x03` = GPS Quality (16B). All little-endian, packed structs. Legacy headerless logs supported (parser checks first byte).
