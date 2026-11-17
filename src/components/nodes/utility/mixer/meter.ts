/** Level meter scale and ballistics. Levels are dBFS; silence is −∞. */
export const SILENT = -Infinity;
export const METER_MIN = -60;
export const METER_MAX = 6;
/** Zone boundaries: green below −12 dB, amber up to 0 dB, red above. */
export const AMBER_FROM = -12;
export const RED_FROM = 0;
export const CLIP_DB = 0;

/** How fast the bar falls, and how long the peak line holds before falling. */
const FALL_DB_PER_SECOND = 24;
const HOLD_SECONDS = 1;
const HOLD_FALL_DB_PER_SECOND = 12;

export type MeterState = {
  level: number;
  hold: number;
  holdFor: number;
  clip: boolean;
};

export const QUIET: MeterState = {
  level: SILENT,
  hold: SILENT,
  holdFor: 0,
  clip: false,
};

/** Loudest sample in dBFS; silence for no samples or all zeros. */
export function peakDb(samples: Float32Array | undefined): number {
  if (!samples) return SILENT;
  let peak = 0;
  for (const sample of samples) {
    const size = Math.abs(sample);
    if (size > peak) peak = size;
  }
  return peak > 0 ? 20 * Math.log10(peak) : SILENT;
}

const floor = (db: number) => (db < METER_MIN ? SILENT : db);

/** Advances one frame: instant rise, slow fall, peak hold, latched clip. */
export function meterStep(
  state: MeterState,
  peak: number,
  seconds: number,
): MeterState {
  const level = floor(
    Math.max(peak, state.level - FALL_DB_PER_SECOND * seconds),
  );
  let hold = state.hold;
  let holdFor = state.holdFor - seconds;
  if (peak >= state.hold) {
    hold = peak;
    holdFor = HOLD_SECONDS;
  } else if (holdFor <= 0) {
    hold = floor(Math.max(level, hold - HOLD_FALL_DB_PER_SECOND * seconds));
  }
  return { level, hold, holdFor, clip: state.clip || peak > CLIP_DB };
}

/** Height on the meter, 0 (−60 dB or quieter) to 1 (+6 dB). */
export function meterPosition(db: number): number {
  if (!(db > METER_MIN)) return 0;
  return Math.min(1, (db - METER_MIN) / (METER_MAX - METER_MIN));
}
