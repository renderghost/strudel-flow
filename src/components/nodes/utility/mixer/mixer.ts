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

function isAudible(channel: Channel, input: string, anySolo: boolean) {
  return (
    Boolean(input) &&
    !channel.muted &&
    (!anySolo || channel.solo) &&
    channel.fader > FADER_MIN
  );
}

function channelCode(input: string, channel: Channel): string {
  const level = rounded(factor(channel.gain + channel.fader));
  const volume = level === 1 ? '' : `.mul(velocity(${level}))`;
  // Pan always wins: emitted even at centre, so the knob means what it says.
  return `${input}${volume}.pan(${Number(channel.pan.toFixed(2))})`;
}

/** Each audible channel's code, keyed by port. */
function audibleChannels(
  data: MixerData,
  inputs: Record<string, string>,
): [string, string][] {
  if (data.muted) return [];
  const anySolo = data.channels.some((channel) => channel.solo);
  return PORTS.flatMap((port, index) => {
    const input = inputs[port] ?? '';
    const channel = data.channels[index];
    return isAudible(channel, input, anySolo)
      ? [[port, channelCode(input, channel)] as [string, string]]
      : [];
  });
}

/** The code at the mixer's output: one line per audible channel, master after. */
export function mixerCode(
  data: MixerData,
  inputs: Record<string, string>,
): string {
  if (data.master <= FADER_MIN) return '';
  const lines = audibleChannels(data, inputs).map(([, code]) => code);
  if (lines.length === 0) return '';
  const body =
    lines.length === 1
      ? lines[0]
      : `stack(\n${lines.map((line) => `  ${line},\n`).join('')})`;
  const master = rounded(factor(data.master));
  return master === 1 ? body : `${body}.mul(postgain(${master}))`;
}

/** What each meter measures: every audible strip after its fader, and the master. */
export function mixerMeters(
  data: MixerData,
  inputs: Record<string, string>,
): Record<string, string> {
  const meters = Object.fromEntries(audibleChannels(data, inputs));
  const master = mixerCode(data, inputs);
  return master ? { ...meters, master } : meters;
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
