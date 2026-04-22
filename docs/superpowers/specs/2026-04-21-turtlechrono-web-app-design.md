# TurtleChrono Web App Design

Karting telemetry log viewer for the TurtleChrono wearable GPS/IMU device. Web-first (React + Vite + TypeScript), with iOS (React Native) planned as a follow-up.

## Scope

### In scope (v1)

- Load local `.bin` log files (device SD card export)
- Binary log parser for the TurtleChrono format (tag-length-value records)
- Satellite map with track overlay (Gaode / AMap)
- G-force ball visualization (longitudinal + lateral)
- Speed and delta line charts vs distance
- Delta comparison to a user-selected reference lap
- Manual start/finish line placement on map for lap splitting
- Animated playback with configurable speed (1x / 2x / 4x)
- Single-page dashboard with click-to-focus panel expansion

### Out of scope (future)

- Bluetooth log download (iOS app)
- Video alignment (GoPro / DJI OSMO)
- Device settings configuration via Bluetooth
- Elevation / altitude features (no altitude in GPS record)
- Multi-lap overlay (only single reference lap comparison)

---

## Layout

Single-page dashboard. All visuals visible simultaneously. Click any panel to expand it to full view; Esc or click-back returns to dashboard.

```
┌──────────┬─────────────────────────────────────────┐
│          │                                         │
│ Sidebar  │         Map Panel (Gaode satellite)     │
│          │     Track overlay colored by delta      │
│ Session  │     Moving position marker (playback)   │
│ list     │     Start/finish gate editor            │
│          │                                         │
│ Lap list ├──────────────┬──────────────────────────┤
│          │  G-Force     │  Lap Info                 │
│ Load     │  Ball        │  time / best / delta      │
│ File     │  (canvas)    │  speed                    │
│          ├──────────────┴──────────────────────────┤
│ Set      │  Chart Panel                            │
│ S/F Line │  Speed vs Distance + Delta bar          │
│          │  Reference lap overlay (faint line)     │
│          ├─────────────────────────────────────────┤
│          │  Playback Bar                           │
│          │  ◀ ▶ |━━━━━━━━━━━░░░░░░| 0:20/0:58 2x  │
└──────────┴─────────────────────────────────────────┘
```

**Click-to-focus behavior:** Clicking a panel (map, G-force, chart) expands it to fill the main area. Other panels collapse to a minimal strip or hide entirely. Esc key or clicking the collapse icon returns to the full dashboard.

---

## Data Architecture

### Log binary format

Tag-length-value binary. One session per file. Little-endian (STM32H7), packed structs.

| Tag  | Type          | Payload |
|------|---------------|---------|
| 0x88 | LogHeader     | 32 bytes |
| 0x01 | IMU           | 28 bytes |
| 0x02 | GPS Location  | 16 bytes |
| 0x03 | GPS Quality   | 16 bytes |

Full field definitions in `docs/log_format.md`.

**LogHeader** provides UTC reconstruction: `sample_utc ≈ header_utc + (sample.tick - sync_tick)`.

**Backward compatibility:** If first byte is not `0x88`, treat as legacy headerless log and start decoding from byte 0.

### Two data streams, different rates

- **GPS stream** (default 25 Hz): lat, lon, speed, course — per sample
- **IMU stream** (default 100 Hz): accel[3], gyro[3] — per sample
- **GPS Quality** (same rate as GPS): hdop, vdop, fix quality, satellites — for filtering bad samples

Rates are configurable on the device. The app must handle any rate.

### Processing pipeline

1. **Parse:** Binary `.bin` file → typed record arrays (via `DataView`)
2. **Filter:** Remove GPS samples with poor fix quality (fix_type < 3, hdop > threshold)
3. **Interpolate:** IMU data interpolated to GPS timestamps for synchronized visualization
4. **Split laps:** User defines start/finish gate on map (two clicks). App detects gate crossings in GPS trace and splits into laps.
5. **Compute delta:** User selects reference lap. For each GPS sample, compare cumulative distance-based time to reference lap. Haversine distance for position-to-position mapping.

### Timestamps

- All record timestamps are `HAL_GetTick()` millisecond tick counts (device uptime)
- LogHeader provides UTC fields + sync tick for wall-clock reconstruction
- Within-session: relative time from session start (first GPS timestamp)
- Video alignment (future): UTC reconstruction enables syncing to camera timestamps

---

## Component Architecture

### Core libraries (`@turtlechrono/core` — no React dependency, reusable in React Native)

- **`parser.ts`**: Binary log parser. Input: `ArrayBuffer`. Output: `RawLog` (header + typed record arrays). Uses `DataView` for little-endian packed struct reads.
- **`processor.ts`**: Takes `RawLog` → derived data. Functions: filter GPS by quality, interpolate IMU to GPS timestamps, detect lap gate crossings, compute delta vs reference lap. Pure functions, no side effects.
- **`time-utils.ts`**: UTC reconstruction from LogHeader, relative time math.
- **`types.ts`**: Shared TypeScript interfaces — `RawLog`, `ProcessedSession`, `Lap`, `Gate`, record types, etc.

### React components

- **`App`**: Layout manager. Dashboard grid + focus mode state.
- **`FocusWrapper`**: Wraps each panel. Handles click-to-expand, Esc-to-collapse, animated transitions.
- **`Sidebar`**: Session metadata display, lap list with selection, "Load File" button, "Set Start/Finish" toggle.
- **`MapPanel`**: Gaode (AMap) satellite tiles. Track polyline colored by delta (green = ahead, red = behind). Position marker animated during playback. Start/finish gate editor (two-click placement on map).
- **`GForcePanel`**: HTML Canvas circle. Longitudinal G (accel/brake) on Y axis, lateral G (cornering) on X axis. Dot + fading trail. Animates during playback.
- **`ChartPanel`**: Lightweight Charts instances. Speed vs distance (primary), delta bar chart (secondary). Reference lap shown as faint overlay. Crosshair synced with playback position.
- **`PlaybackBar`**: Timeline scrubber (range input), play/pause toggle, speed selector (1x/2x/4x). Drives shared `currentTime` via playback animation loop.
- **`LapInfoPanel`**: Small read-only display of current lap time, best lap time, delta to reference, and current speed. Inline in the right column next to G-force.

### State management (Zustand)

Single store:

```typescript
interface SessionStore {
  rawLog: RawLog | null
  session: ProcessedSession | null
  currentLapIndex: number
  referenceLapIndex: number | null
  startFinishGate: Gate | null  // two lat/lon points
  playback: {
    currentTime: number   // ms from lap start
    isPlaying: boolean
    speed: 1 | 2 | 4
  }
  focusedPanel: string | null
}
```

### Data flow on file load

1. User drops/selects `.bin` file
2. `parser.ts` reads `ArrayBuffer` → `RawLog`
3. `processor.ts` takes `RawLog` → `ProcessedSession` (filtered GPS, interpolated IMU)
4. If no start/finish gate: user enters gate editor mode → clicks two points on map → gate stored
5. `processor.ts` splits laps at gate crossings → lap list appears in sidebar
6. User selects current lap + reference lap → delta computed → all visualizations update

---

## Project Structure

Monorepo with npm workspaces. Web and future mobile app share core libraries via local workspace package `@turtlechrono/core`.

```
TurtleChrono/
├── package.json                    # Root workspace config
├── .gitignore
├── docs/
│   └── log_format.md
├── packages/
│   ├── core/                       # @turtlechrono/core — shared by web + mobile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── parser.ts
│   │   │   ├── processor.ts
│   │   │   ├── time-utils.ts
│   │   │   └── types.ts            # RawLog, ProcessedSession, Lap, Gate, etc.
│   │   └── tests/
│   │       ├── fixtures/
│   │       │   └── log_002.bin
│   │       ├── parser.test.ts
│   │       └── processor.test.ts
│   ├── web/                        # @turtlechrono/web — React + Vite app
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── public/
│   │   │   └── favicon.ico
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── store/
│   │       │   └── session-store.ts
│   │       ├── components/
│   │       │   ├── MapPanel.tsx
│   │       │   ├── GForcePanel.tsx
│   │       │   ├── ChartPanel.tsx
│   │       │   ├── PlaybackBar.tsx
│   │       │   ├── Sidebar.tsx
│   │       │   ├── LapInfoPanel.tsx
│   │       │   └── FocusWrapper.tsx
│   │       └── hooks/
│   │           ├── usePlayback.ts
│   │           └── useLogLoader.ts
│   └── mobile/                     # @turtlechrono/mobile — React Native iOS (future)
│       ├── package.json
│       └── ...
└── .superpowers/                   # brainstorming artifacts (gitignored)
```

---

## Tech Stack

| Category       | Choice                      | Rationale |
|----------------|-----------------------------|-----------|
| Framework      | React 18                    | Shared with React Native for future iOS app |
| Bundler        | Vite                        | Fast dev server, native TS support |
| Language       | TypeScript                  | Type safety for binary parsing, shared with RN |
| State          | Zustand                     | Lightweight, works in RN |
| Map            | AMap JS API 2.0 (Gaode)     | Best satellite imagery for China |
| Charts         | Lightweight Charts (TradingView) | Performant time-series, zoom/pan, crosshair sync |
| G-force        | HTML Canvas                 | Simple 2D circle, no extra library |
| Styling        | CSS Modules                 | Scoped per component, no extra deps |
| Testing        | Vitest                      | Native Vite integration, fast |

No UI component library (MUI, Ant Design, etc.) — the dashboard is custom enough that a component library adds more constraints than value.

---

## Monorepo Strategy

npm workspaces monorepo. Both web and future mobile app live in this repository.

- `packages/core/` is published as `@turtlechrono/core` locally — both `packages/web/` and `packages/mobile/` import it directly via workspace protocol (`"@turtlechrono/core": "workspace:*"`)
- No npm publishing needed — workspace resolution handles it
- Core library changes are immediately available to both platforms
- `packages/mobile/` is a placeholder for now; created when iOS development begins

---

## Mobile Reuse Strategy

| Layer              | Web | iOS (React Native) | Reuse |
|--------------------|-----|--------------------|-------|
| Core libraries     | ✓   | ✓                  | 100% — pure TS, no DOM |
| State (Zustand)    | ✓   | ✓                  | 100% |
| Map                | AMap JS | AMap iOS SDK     | Rewrite (native SDK) |
| Charts             | Lightweight Charts | react-native-skia | Rewrite (canvas API) |
| G-force            | Canvas | react-native-skia | Rewrite (canvas API) |
| File loading       | Drag-drop / input | iOS file picker + Bluetooth | Rewrite (native APIs) |

Approximately 80% of code (core logic + state) is reusable. Only the rendering layer and native integrations need rewriting.

---

## Testing Strategy

- **Unit tests** for `parser.ts` and `processor.ts` using `log_002.bin` as a real integration test fixture
- **Synthetic fixtures** in `tests/fixtures/` for edge cases: empty log, headerless legacy log, single lap, GPS quality filtering
- **Component tests** for key interactions (file load, lap selection, playback) using Vitest + React Testing Library
- No E2E tests for v1 — the app is single-user, single-purpose

---

## Error Handling

- **Corrupt log file**: Parser validates each record (tag check, bounds check, size check). Unknown tags or truncated payloads surface a clear error to the user with the byte offset.
- **No GPS fix**: If all GPS quality records indicate no fix, show a message instead of an empty map.
- **Single lap / no lap splits**: If the GPS trace never crosses the start/finish gate, show the full trace as "Unsplit" and prompt the user to reposition the gate.
- **Large files**: Parse and process lazily. Show a progress indicator during initial parse for files over 10MB.
