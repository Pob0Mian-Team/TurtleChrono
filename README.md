# TurtleChrono

Karting telemetry log viewer for the [TurtleChrono](https://github.com/nicholasgasior/turtlechrono) wearable GPS/IMU device. Web-first single-page dashboard built with React, TypeScript, and Vite.

![Dark theme dashboard](docs/superpowers/specs/2026-04-21-turtlechrono-web-app-design.md)

## Features

- **Binary log parser** — reads `.bin` files from the device SD card (TLV format with LogHeader, GPS, IMU, and GPS Quality records)
- **Satellite map** — Gaode (AMap) satellite tiles with track overlay and animated position marker
- **Start/finish gate editor** — click two points on the map to define the gate; laps are auto-detected from gate crossings
- **Lap comparison** — select a reference lap to see time delta at every point on track
- **G-force ball** — real-time lateral and longitudinal G visualization with fading trail
- **Speed and delta charts** — TradingView Lightweight Charts with crosshair synced to playback
- **Animated playback** — play/pause, scrub, and speed control (1x / 2x / 4x)

## Quick Start

```bash
# Install dependencies
npm install

# Set up AMap API key (required for map)
cp packages/web/.env.example packages/web/.env
# Edit .env with your key from https://lbs.amap.com

# Start dev server
npm run dev
```

Open `http://localhost:5173` in your browser. Load a `.bin` log file, set a start/finish gate on the map, and explore your laps.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build core library and web app for production |
| `npm test` | Run core library tests (Vitest) |

## Project Structure

```
TurtleChrono/
├── packages/
│   ├── core/                   # @turtlechrono/core — shared logic, no DOM
│   │   ├── src/
│   │   │   ├── types.ts        # Shared TypeScript interfaces
│   │   │   ├── parser.ts       # Binary TLV log parser
│   │   │   ├── processor.ts    # GPS filtering, IMU interpolation, lap detection, delta
│   │   │   ├── time-utils.ts   # UTC reconstruction from device ticks
│   │   │   └── index.ts        # Barrel export
│   │   └── tests/
│   │       ├── helpers.ts      # LogBuilder for synthetic test fixtures
│   │       ├── parser.test.ts
│   │       ├── processor.test.ts
│   │       └── fixtures/
│   │           └── test_log_0.bin # Real device log for integration testing
│   └── web/                    # @turtlechrono/web — React SPA
│       └── src/
│           ├── store/          # Zustand session store
│           ├── hooks/          # useLogLoader, usePlayback
│           └── components/     # MapPanel, ChartPanel, GForcePanel, etc.
├── docs/
│   └── log_format.md           # Binary log format reference
└── packages/web/.env.example   # Vite env template (copy to .env)
```

## Tech Stack

| Category | Choice | Why |
|----------|--------|-----|
| Framework | React 18 | Shared with future React Native iOS app |
| Bundler | Vite | Fast dev server, native TS |
| Language | TypeScript | Type safety for binary parsing |
| State | Zustand | Lightweight, works in React Native |
| Map | AMap JS API 2.0 | Best satellite imagery for China |
| Charts | uPlot | Fast time-series rendering |
| G-force | HTML Canvas | No extra dependency needed |
| Styling | CSS Modules | Scoped per component |
| Testing | Vitest | Native Vite integration |

## Configuration

Create a `packages/web/.env` file with your Gaode Maps API credentials:

```
VITE_AMAP_KEY=your_amap_key_here
VITE_AMAP_SECRET=your_amap_secret_here
```

Apply for a key at [lbs.amap.com](https://lbs.amap.com). The app works without a key — only the map panel won't render satellite tiles.

## Data Pipeline

1. **Parse** — binary `.bin` file into typed record arrays via `DataView`
2. **Filter** — remove GPS samples with poor fix quality (fixType < 3, HDOP > 5.0)
3. **Interpolate** — IMU data interpolated to GPS timestamps for synchronized visualization
4. **Split** — user-defined start/finish gate on map; gate crossings detected via segment intersection
5. **Compare** — delta computed by mapping cumulative distance between current and reference laps

## License

Private
