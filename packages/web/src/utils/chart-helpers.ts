export function buildSpeedData(
  points: { distanceFromStart: number; speedKmh: number }[],
): { distances: number[]; speeds: number[] } {
  if (points.length === 0) return { distances: [], speeds: [] };

  const distances: number[] = [];
  const speeds: number[] = [];
  let lastDist = -1;
  for (const p of points) {
    const d = Math.round(p.distanceFromStart - points[0].distanceFromStart);
    if (d <= lastDist) continue;
    lastDist = d;
    distances.push(d);
    speeds.push(p.speedKmh);
  }
  return { distances, speeds };
}

export function buildDeltaData(
  distances: number[],
  deltaPoints: { distance: number; deltaMs: number }[] | null | undefined,
): (number | null)[] {
  const deltas: (number | null)[] = new Array(distances.length).fill(null);
  if (!deltaPoints || deltaPoints.length === 0) return deltas;

  let deltaIdx = 0;
  let deltaLastDist = -1;
  const filtered: { d: number; v: number }[] = [];
  for (const dp of deltaPoints) {
    const d = Math.round(dp.distance);
    if (d <= deltaLastDist) continue;
    deltaLastDist = d;
    filtered.push({ d, v: dp.deltaMs });
  }

  for (let i = 0; i < distances.length; i++) {
    while (
      deltaIdx < filtered.length - 1 &&
      Math.abs(filtered[deltaIdx + 1].d - distances[i]) <=
        Math.abs(filtered[deltaIdx].d - distances[i])
    ) {
      deltaIdx++;
    }
    if (deltaIdx < filtered.length) {
      const diff = Math.abs(filtered[deltaIdx].d - distances[i]);
      if (diff <= 5) {
        deltas[i] = filtered[deltaIdx].v;
      }
    }
  }
  return deltas;
}

export function buildRefSpeedData(
  distances: number[],
  refPoints: { distanceFromStart: number; speedKmh: number }[],
): (number | null)[] {
  const refBase = refPoints[0].distanceFromStart;
  const refMap = new Map<number, number>();
  let refLastDist = -1;
  for (const p of refPoints) {
    const d = Math.round(p.distanceFromStart - refBase);
    if (d <= refLastDist) continue;
    refLastDist = d;
    refMap.set(d, p.speedKmh);
  }
  return distances.map((d) => refMap.get(d) ?? null);
}

export function formatDistance(d: number): string {
  return d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${d.toFixed(0)}m`;
}
