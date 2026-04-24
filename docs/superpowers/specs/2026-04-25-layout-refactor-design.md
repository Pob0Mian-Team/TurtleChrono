# Layout Refactor Design

## Goal

Refactor the overall layout from the current stacked arrangement to a three-column design: Sidebar | Left Column (Map, G-Force, Lap Info) | Right Column (Charts). Split the combined speed+delta chart into two separate charts and make the number of visible charts user-configurable via sidebar toggle chips.

## Layout Structure

### Outer Grid

```
| Sidebar (220px) | Left Column (auto) | Right Column (1fr) |
|                  |                    |                    |
|                  |                    |                    |
|                  +--------------------+--------------------+
|                  |         Playback Bar (spans both)       |
```

CSS Grid: `grid-template-columns: 220px auto 1fr`, `grid-template-rows: 1fr auto`.

The left column width is driven by the square constraint on the map/g-force panels (each 30vh tall, so width = 30vh due to `aspect-ratio: 1`). The right column fills remaining space.

### Left Column

Flex column, top to bottom:

1. **Map** — forced square, `height: 30vh; aspect-ratio: 1`. Wrapped in FocusWrapper (click-to-expand, Esc to collapse).
2. **G-Force** — forced square, `height: 30vh; aspect-ratio: 1`. Wrapped in FocusWrapper.
3. **Lap Info** — `flex: 1`, fills remaining vertical space below the two squares.

Total fixed height: 60vh for map + g-force. Remaining ~40vh (minus playback bar) for lap info.

### Right Column

Flex column of chart panels:

- Each visible chart gets `flex: 1`, so they split available height equally.
- No scrolling — all charts fit within the viewport.
- Each chart has a small header label (e.g., "Speed (km/h)", "Time Delta (s)").

### Playback Bar

Spans columns 2-3 at the bottom of the outer grid, unchanged from current behavior.

## Chart System

### Split Charts

The current `ChartPanel` (single uPlot with speed + delta on different y-axes) is replaced by independent chart components:

- **SpeedChart** — uPlot with distance x-axis, speed y-axis, current lap speed line, optional reference lap speed line.
- **DeltaChart** — uPlot with distance x-axis, delta y-axis (centered on zero, symmetric range), delta line.

Each chart is a standalone React component with its own uPlot instance. They share the same distance-based x-axis scale and scrub interaction pattern.

### Chart Registry

A `CHART_REGISTRY` maps chart type keys to component definitions. All chart components receive the same `ChartProps`:

```ts
interface ChartProps {
  containerRef: React.RefObject<HTMLDivElement>;
}
```

Each chart component manages its own uPlot instance, data subscriptions, and interaction internally.

```ts
type ChartType = 'speed' | 'delta';

const CHART_REGISTRY: Record<ChartType, { label: string; component: React.ComponentType<ChartProps> }> = {
  speed: { label: 'Speed', component: SpeedChart },
  delta: { label: 'Delta', component: DeltaChart },
};
```

New chart types are added by extending the union and registry entry. Only implemented types appear in the registry and sidebar.

### State

Zustand store additions:

```ts
enabledCharts: ChartType[];        // default: ['speed', 'delta']
toggleChart: (type: ChartType) => void;
```

`toggleChart` removes the type if present, adds it if absent. At least one chart must remain enabled — toggle is a no-op if it would leave the array empty.

### Sidebar Chart Toggles

A "Charts" section at the bottom of the sidebar with toggle chips:

- One chip per `ChartType` from the registry.
- Enabled charts show highlighted (accent color background).
- Disabled charts show muted (dark background, gray text).
- Click toggles the chart on/off.

### Cross-Chart Sync

Both charts share the same playback scrubbing behavior (click/drag to seek). The playback vertical line and tooltip render independently in each chart. When playback time changes, all visible charts update their crosshair position.

## Component Changes

### Files to Create

- `packages/web/src/components/SpeedChart.tsx` — speed chart component (extracted from ChartPanel logic)
- `packages/web/src/components/SpeedChart.module.css` — styles
- `packages/web/src/components/DeltaChart.tsx` — delta chart component (extracted from ChartPanel logic)
- `packages/web/src/components/DeltaChart.module.css` — styles
- `packages/web/src/components/ChartContainer.tsx` — wrapper that renders the right column of enabled charts
- `packages/web/src/components/ChartContainer.module.css` — styles

### Files to Modify

- `packages/web/src/App.tsx` — new layout structure
- `packages/web/src/App.module.css` — new grid layout CSS
- `packages/web/src/store/session-store.ts` — add `enabledCharts`, `toggleChart`, `ChartType`
- `packages/web/src/components/Sidebar.tsx` — add chart toggle chips section
- `packages/web/src/components/Sidebar.module.css` — chip styles

### Files to Remove

- `packages/web/src/components/ChartPanel.tsx` — replaced by SpeedChart + DeltaChart
- `packages/web/src/components/ChartPanel.module.css` — replaced

## Migration Notes

- The `buildChartData` helper and distance formatting are shared between SpeedChart and DeltaChart. Extract into a shared utility (e.g., `packages/web/src/utils/chart-helpers.ts`).
- Scrub interaction (pointerdown/move/up on uPlot overlay) is identical across charts — extract into a custom hook (e.g., `useChartScrub`).
- Playback crosshair positioning is similar — extract into `usePlaybackCrosshair` hook.
- FocusWrapper behavior is preserved for map and g-force panels only. Charts do not use FocusWrapper.

## Open Items

- Future chart types (Throttle, Brake, RPM, etc.) will be added by: extending `ChartType`, adding a registry entry, creating the component, and updating the sidebar chips automatically.
