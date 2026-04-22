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
