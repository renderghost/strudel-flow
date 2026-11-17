import type { Tempo } from '../../define-node';

export const ECHO_TYPE = 'echo-node';

/** Synced repeat rates, in beats (a beat is a quarter note). */
export const DIVISIONS = {
  '1/16': 0.25,
  '1/8T': 1 / 3,
  '1/8': 0.5,
  '1/8.': 0.75,
  '1/4T': 2 / 3,
  '1/4': 1,
  '1/4.': 1.5,
  '1/2': 2,
} as const;
export type Division = keyof typeof DIVISIONS;

export const MS_MIN = 40;
export const MS_MAX = 1000;
export const TAPE_INTENSITY_MAX = 1.25;
/** The stock delay's own feedback limit. */
export const CLEAN_INTENSITY_MAX = 0.98;
export const HEADS = 3;

/** Repeats stop below −60 dB, after 12 per head, or 24 in all. */
const QUIETEST = 0.001;
const MAX_PER_HEAD = 12;
const MAX_REPEATS = 24;
/** A swelling repeat never goes above +3.5 dB. */
const LOUDEST = 1.5;
/** Tape bandwidth at the first repeat; Tone lowers it further each repeat. */
const TAPE_CUTOFF = 8000;

export type EchoData = {
  mode: 'tape' | 'clean';
  sync: boolean;
  division: Division;
  ms: number;
  intensity: number;
  volume: number;
  tone: number;
  saturation: number;
  heads: boolean[];
};

const clamp = (raw: unknown, min: number, max: number, fallback: number) => {
  const value = Number(raw);
  if (raw === null || raw === '' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

/** The echo's settings from saved data, repairing anything missing or odd. */
export function readEcho(data: Record<string, unknown>): EchoData {
  const heads = Array.from({ length: HEADS }, (_, index) =>
    Array.isArray(data.heads) ? data.heads[index] === true : index === 0,
  );
  return {
    mode: data.mode === 'clean' ? 'clean' : 'tape',
    sync: data.sync !== false,
    division:
      typeof data.division === 'string' && data.division in DIVISIONS
        ? (data.division as Division)
        : '1/8.',
    ms: clamp(data.ms, MS_MIN, MS_MAX, 300),
    intensity: clamp(data.intensity, 0, TAPE_INTENSITY_MAX, 0.5),
    volume: clamp(data.volume, 0, 1, 0.6),
    tone: clamp(data.tone, 0, 1, 0.4),
    saturation: clamp(data.saturation, 0, 1, 0.3),
    heads: heads.some(Boolean) ? heads : [true, false, false],
  };
}

const round = (value: number) => Number(value.toPrecision(4));

/** One repeat interval, in seconds. */
export function rateSeconds(data: EchoData, tempo: Tempo): number {
  return data.sync
    ? round((DIVISIONS[data.division] * 60) / tempo.bpm)
    : data.ms / 1000;
}

/** One repeat interval, in cycles (a cycle is `bpc` beats). */
export function rateCycles(data: EchoData, tempo: Tempo): number {
  return data.sync
    ? round(DIVISIONS[data.division] / tempo.bpc)
    : round(((data.ms / 1000) * tempo.bpm) / (60 * tempo.bpc));
}

/** How many repeats each enabled head plays. */
export function repeatsPerHead(data: EchoData): number {
  const { volume, intensity } = data;
  if (volume <= QUIETEST || intensity <= 0) return 0;
  const audible =
    intensity >= 1
      ? MAX_PER_HEAD
      : Math.floor(Math.log(QUIETEST / volume) / Math.log(intensity));
  const heads = data.heads.filter(Boolean).length;
  return Math.max(
    0,
    Math.min(audible, MAX_PER_HEAD, Math.floor(MAX_REPEATS / heads)),
  );
}

/**
 * Repeat `k = i + 1`: quieter by intensity^k (capped), filtered no brighter
 * than its source, and driven harder each time. Bare (non-object) values pass
 * through untouched.
 */
function repeatValue(data: EchoData): string {
  const fields = [
    `velocity: (v.velocity ?? 1) * Math.min(${LOUDEST}, ${round(data.volume)} * ${round(data.intensity)} ** (i + 1))`,
    // `lpf` is stored as `cutoff`.
    `cutoff: Math.min(v.cutoff ?? 20000, ${TAPE_CUTOFF} * ${round(1 - 0.5 * data.tone)} ** (i + 1))`,
    ...(data.saturation > 0
      ? [`shape: Math.min(0.9, ${round(data.saturation / 6)} * (i + 1))`]
      : []),
  ];
  return `(v) => typeof v !== 'object' ? v : { ...v, ${fields.join(', ')} }`;
}

/** The echo's code around its input: tape repeats or the stock delay. */
export function echoCode(data: EchoData, input: string, tempo: Tempo): string {
  if (!input) return '';
  if (data.mode === 'clean') {
    const feedback = Math.min(data.intensity, CLEAN_INTENSITY_MAX);
    return `${input}.delay(${round(data.volume)}).delaytime(${rateSeconds(data, tempo)}).delayfeedback(${round(feedback)})`;
  }
  const count = repeatsPerHead(data);
  if (count === 0) return input;
  const rate = rateCycles(data, tempo);
  const value = repeatValue(data);
  const trains = data.heads.flatMap((on, index) => {
    if (!on) return [];
    const spacing = round(rate * (index + 1));
    return [
      `(p) => p.late(${spacing}).echoWith(${count}, ${spacing}, (q, i) => q.withValue(${value}))`,
    ];
  });
  return `${input}.superimpose(\n${trains.map((train) => `  ${train},\n`).join('')})`;
}

/** Everything about the Echo node except its controls component. */
export const echoSpec = {
  id: ECHO_TYPE,
  title: 'Echo',
  category: 'Audio Effects' as const,
  icon: 'Repeat' as const,
  order: 13,
  parameters: {},
  defaults: readEcho({}),
  read: (data: Record<string, unknown>) => ({ ...data, ...readEcho(data) }),
  generate: (values: EchoData, input: string, { tempo }: { tempo: Tempo }) =>
    echoCode(values, input, tempo),
};
