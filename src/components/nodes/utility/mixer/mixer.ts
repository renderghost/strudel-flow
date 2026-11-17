import type { CarriedControl } from '../../define-node';

export const MIXER_TYPE = 'mixer-node';
export const CHANNELS = 8;
export const PORTS: readonly string[] = Array.from(
  { length: CHANNELS },
  (_, index) => `ch-${index + 1}`,
);

/** Input gain range in dB. */
export const GAIN_MIN = -24;
export const GAIN_MAX = 12;
/** Fader range in dB; the bottom of the travel is −∞ (silence). */
export const FADER_MIN = -60;
export const FADER_MAX = 6;

export type Channel = {
  gain: number;
  fader: number;
  pan: number;
  muted: boolean;
  solo: boolean;
};
export type MixerData = { channels: Channel[]; master: number; muted: boolean };

export const FLAT_CHANNEL: Channel = {
  gain: 0,
  fader: 0,
  pan: 0.5,
  muted: false,
  solo: false,
};

const clampNumber = (
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  const value = Number(raw);
  if (raw === null || raw === '' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

function readChannel(raw: unknown): Channel {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    gain: clampNumber(source.gain, GAIN_MIN, GAIN_MAX, FLAT_CHANNEL.gain),
    fader: clampNumber(source.fader, FADER_MIN, FADER_MAX, FLAT_CHANNEL.fader),
    pan: clampNumber(source.pan, 0, 1, FLAT_CHANNEL.pan),
    muted: source.muted === true,
    solo: source.solo === true,
  };
}

/** The mixer's settings from saved data, repairing anything missing or odd. */
export function readMixer(data: Record<string, unknown>): MixerData {
  const channels = Array.isArray(data.channels) ? data.channels : [];
  return {
    channels: Array.from({ length: CHANNELS }, (_, index) =>
      readChannel(channels[index]),
    ),
    master: clampNumber(data.master, FADER_MIN, FADER_MAX, 0),
    muted: data.muted === true,
  };
}

/** dB → amplitude factor; the fader floor is silence. */
export function factor(db: number): number {
  return db <= FADER_MIN ? 0 : 10 ** (db / 20);
}

const rounded = (value: number) => Number(value.toPrecision(3));

/** Anything at or under the −60 dB floor is silence. */
const SILENT_BELOW = 10 ** (FADER_MIN / 20);

const panOf = (channel: Channel) => Number(channel.pan.toFixed(2));
const levelOf = (channel: Channel) =>
  channel.fader <= FADER_MIN ? 0 : factor(channel.gain + channel.fader);

function isAudible(channel: Channel, input: string, anySolo: boolean) {
  return (
    Boolean(input) &&
    !channel.muted &&
    (!anySolo || channel.solo) &&
    levelOf(channel) > SILENT_BELOW
  );
}

/** `input` scaled by `level` (omitted at unity) and panned. */
function voice(input: string, level: number, pan: number): string {
  const velocity = rounded(level);
  const volume = velocity === 1 ? '' : `.mul(velocity(${velocity}))`;
  return `${input}${volume}.pan(${pan})`;
}

/** Stacks lines (one per line, for reading) and applies the master. */
function mix(lines: string[], data: MixerData): string {
  if (lines.length === 0) return '';
  const body =
    lines.length === 1
      ? lines[0]
      : `stack(\n${lines.map((line) => `  ${line},\n`).join('')})`;
  const master = rounded(factor(data.master));
  return master === 1 ? body : `${body}.mul(postgain(${master}))`;
}

type Strip = { port: string; input: string; channel: Channel };

function audibleChannels(
  data: MixerData,
  inputs: Record<string, string>,
): Strip[] {
  if (data.muted) return [];
  const anySolo = data.channels.some((channel) => channel.solo);
  return PORTS.flatMap((port, index) => {
    const input = inputs[port] ?? '';
    const channel = data.channels[index];
    return isAudible(channel, input, anySolo) ? [{ port, input, channel }] : [];
  });
}

/** The code at the mixer's output: one line per audible channel, master after. */
export function mixerCode(
  data: MixerData,
  inputs: Record<string, string>,
): string {
  if (data.master <= FADER_MIN) return '';
  return mix(
    audibleChannels(data, inputs).map(({ input, channel }) =>
      // Pan always wins: emitted even at centre, so the knob means what it says.
      voice(input, levelOf(channel), panOf(channel)),
    ),
    data,
  );
}

/** Equal-power pan gains for a mono voice, as superdough's panner applies. */
const sides = (pan: number) => ({
  left: Math.cos((pan * Math.PI) / 2),
  right: Math.sin((pan * Math.PI) / 2),
});

/**
 * An analyser averages left and right, so a hard-panned voice would read
 * 6 dB low. Meter taps are centred instead (each side × 1/√2) and lifted by
 * √2 times the side's pan gain, so the analyser reads that side exactly.
 */
const centredAt = (input: string, level: number) =>
  voice(input, level * Math.SQRT2, 0.5);

/**
 * What each meter measures, after fader and pan: every audible strip at its
 * louder side, and the master's left and right (one tap when they match).
 */
export function mixerMeters(
  data: MixerData,
  inputs: Record<string, string>,
): Record<string, string> {
  const strips = audibleChannels(data, inputs);
  const meters: Record<string, string> = Object.fromEntries(
    strips.map(({ port, input, channel }) => {
      const { left, right } = sides(panOf(channel));
      return [port, centredAt(input, levelOf(channel) * Math.max(left, right))];
    }),
  );
  if (data.master <= FADER_MIN) return meters;
  const side = (which: 'left' | 'right') =>
    mix(
      strips.flatMap(({ input, channel }) => {
        const level = levelOf(channel) * sides(panOf(channel))[which];
        return level * Math.SQRT2 > SILENT_BELOW
          ? [centredAt(input, level)]
          : [];
      }),
      data,
    );
  const left = side('left');
  const right = side('right');
  if (left) meters['master-l'] = left;
  if (right && right !== left) meters['master-r'] = right;
  return meters;
}

const FADER_SPAN = FADER_MAX - FADER_MIN;

/** Fader travel (0–1) → dB, with most of the travel near unity. */
export function positionToFader(position: number): number {
  const p = Math.min(1, Math.max(0, position));
  return FADER_MAX - FADER_SPAN * (1 - p) ** 2;
}

export function faderToPosition(db: number): number {
  const clamped = Math.min(FADER_MAX, Math.max(FADER_MIN, db));
  return 1 - Math.sqrt((FADER_MAX - clamped) / FADER_SPAN);
}

const MINUS = '−';

/** "−6.0 dB"; with `floor`, the fader's bottom reads "−∞ dB". */
export function formatDb(db: number, { floor = false } = {}): string {
  if (floor && db <= FADER_MIN) return `${MINUS}∞ dB`;
  const value = Math.round(db * 10) / 10;
  if (Math.abs(value) < 0.05) return '0.0 dB';
  return `${value > 0 ? '+' : MINUS}${Math.abs(value).toFixed(1)} dB`;
}

export function formatPan(pan: number): string {
  const amount = Math.round(Math.abs(pan - 0.5) * 200);
  if (amount === 0) return 'pan centre';
  return `pan ${amount}% ${pan < 0.5 ? 'left' : 'right'}`;
}

const CARRIED: CarriedControl[] = [
  { call: 'pan', label: 'Pan' },
  { call: 'velocity', label: 'Levels' },
  { call: 'postgain', label: 'Master' },
];

/** Everything about the mixer node except its controls component. */
export const mixerSpec = {
  id: MIXER_TYPE,
  title: 'Mixer',
  category: 'Utility' as const,
  icon: 'SlidersVertical' as const,
  order: 4,
  ports: PORTS,
  parameters: {},
  defaults: readMixer({}),
  mutable: true,
  read: (data: Record<string, unknown>) => ({ ...data, ...readMixer(data) }),
  generate: (
    values: MixerData,
    _input: string,
    { inputs }: { inputs: Record<string, string> },
  ) => mixerCode(values, inputs),
  meters: (values: MixerData, inputs: Record<string, string>) =>
    mixerMeters(values, inputs),
  // Channel volume and master multiply, so they never replace anything
  // upstream; each channel's pan does.
  overrides: {
    carries: () => CARRIED,
    replaces: () => ['pan'],
  },
};
