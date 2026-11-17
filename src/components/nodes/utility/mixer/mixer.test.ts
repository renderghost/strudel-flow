import { describe, expect, it } from 'vitest';
import {
  CHANNELS,
  FADER_MIN,
  PORTS,
  faderToPosition,
  formatDb,
  formatPan,
  mixerCode,
  mixerMeters,
  positionToFader,
  readMixer,
  type Channel,
  type MixerData,
} from './mixer';

const flat: Channel = {
  gain: 0,
  fader: 0,
  pan: 0.5,
  muted: false,
  solo: false,
};
const mixer = (
  channels: Partial<Channel>[] = [],
  rest: Partial<Omit<MixerData, 'channels'>> = {},
): MixerData => ({
  channels: Array.from({ length: CHANNELS }, (_, i) => ({
    ...flat,
    ...channels[i],
  })),
  master: 0,
  muted: false,
  ...rest,
});
const wired = (inputs: Record<number, string>) =>
  Object.fromEntries(PORTS.map((port, i) => [port, inputs[i + 1] ?? '']));

describe('readMixer', () => {
  it('fills a blank mixer with 8 flat channels', () => {
    const data = readMixer({});
    expect(data.channels).toHaveLength(8);
    expect(data.channels[7]).toEqual(flat);
    expect(data.master).toBe(0);
    expect(data.muted).toBe(false);
  });

  it('repairs hand-edited values', () => {
    const data = readMixer({
      channels: [{ gain: 'x', fader: 99, pan: -1, muted: 'yes', solo: true }],
      master: -500,
      muted: 1,
    });
    expect(data.channels[0]).toEqual({
      gain: 0,
      fader: 6,
      pan: 0,
      muted: false,
      solo: true,
    });
    expect(data.master).toBe(FADER_MIN);
    expect(data.muted).toBe(false);
  });
});

describe('mixerCode', () => {
  it('matches the readable layout from the spec', () =>
    expect(
      mixerCode(
        mixer([{ fader: -3, pan: 0.3 }, {}, { fader: -6 }], { master: -1 }),
        wired({ 1: 'n("0 2 4").sound("triangle")', 3: 's("bd sd")' }),
      ),
    ).toBe(
      'stack(\n' +
        '  n("0 2 4").sound("triangle").mul(velocity(0.708)).pan(0.3),\n' +
        '  s("bd sd").mul(velocity(0.501)).pan(0.5),\n' +
        ').mul(postgain(0.891))',
    ));

  it('needs no stack for one channel, and omits unity levels', () =>
    expect(mixerCode(mixer(), wired({ 2: 's("bd")' }))).toBe(
      's("bd").pan(0.5)',
    ));

  it('multiplies input gain and fader', () =>
    expect(mixerCode(mixer([{ gain: 6, fader: -6 }]), wired({ 1: 'a' }))).toBe(
      'a.pan(0.5)',
    ));

  it('leaves out a channel at −∞', () =>
    expect(
      mixerCode(mixer([{ fader: FADER_MIN }]), wired({ 1: 'a', 2: 'b' })),
    ).toBe('b.pan(0.5)'));

  it('leaves out a muted channel', () =>
    expect(mixerCode(mixer([{ muted: true }]), wired({ 1: 'a', 2: 'b' }))).toBe(
      'b.pan(0.5)',
    ));

  it('plays only soloed channels, additively', () =>
    expect(
      mixerCode(
        mixer([{ solo: true }, {}, { solo: true }]),
        wired({ 1: 'a', 2: 'b', 3: 'c' }),
      ),
    ).toBe('stack(\n  a.pan(0.5),\n  c.pan(0.5),\n)'));

  it('silences everything else when an empty channel is soloed', () =>
    expect(mixerCode(mixer([{}, { solo: true }]), wired({ 1: 'a' }))).toBe(''));

  it('lets a whole-mixer mute beat solo', () =>
    expect(
      mixerCode(mixer([{ solo: true }], { muted: true }), wired({ 1: 'a' })),
    ).toBe(''));

  it('plays nothing with the master at −∞', () =>
    expect(mixerCode(mixer([], { master: FADER_MIN }), wired({ 1: 'a' }))).toBe(
      '',
    ));

  it('plays nothing with nothing wired in', () =>
    expect(mixerCode(mixer(), wired({}))).toBe(''));
});

describe('mixerMeters', () => {
  it('measures each audible strip after its fader, and both master sides', () =>
    expect(
      mixerMeters(
        mixer([{ fader: -6 }, { muted: true }], { master: -1 }),
        wired({ 1: 'a', 2: 'b', 4: 'd' }),
      ),
    ).toEqual({
      'ch-1': 'a.mul(velocity(0.501)).pan(0.5)',
      'ch-4': 'd.pan(0.5)',
      // Centred: both sides are the same, so one tap serves both.
      'master-l':
        'stack(\n  a.mul(velocity(0.501)).pan(0.5),\n  d.pan(0.5),\n).mul(postgain(0.891))',
    }));

  it('reads a panned strip at its louder side, not the average', () =>
    // Hard left: left = full level; the analyser averages L and R, so the tap
    // is centred and lifted by √2 to read the left side exactly.
    expect(mixerMeters(mixer([{ pan: 0 }]), wired({ 1: 'a' }))).toEqual({
      'ch-1': 'a.mul(velocity(1.41)).pan(0.5)',
      'master-l': 'a.mul(velocity(1.41)).pan(0.5)',
    }));

  it('meters each master side from every channel', () =>
    expect(
      mixerMeters(mixer([{ pan: 0 }, { pan: 1 }]), wired({ 1: 'a', 2: 'b' })),
    ).toEqual({
      'ch-1': 'a.mul(velocity(1.41)).pan(0.5)',
      'ch-2': 'b.mul(velocity(1.41)).pan(0.5)',
      'master-l': 'a.mul(velocity(1.41)).pan(0.5)',
      'master-r': 'b.mul(velocity(1.41)).pan(0.5)',
    }));

  it('keeps strip meters when the master is at −∞', () =>
    expect(
      Object.keys(
        mixerMeters(mixer([], { master: FADER_MIN }), wired({ 1: 'a' })),
      ),
    ).toEqual(['ch-1']));

  it('flattens every meter when the mixer is muted', () =>
    expect(mixerMeters(mixer([], { muted: true }), wired({ 1: 'a' }))).toEqual(
      {},
    ));
});

describe('silent channels', () => {
  it('leaves out a channel whose gain and fader together reach −∞', () => {
    const data = mixer([{ gain: -24, fader: -40 }]);
    const inputs = wired({ 1: 'a', 2: 'b' });
    expect(mixerCode(data, inputs)).toBe('b.pan(0.5)');
    expect(Object.keys(mixerMeters(data, inputs))).not.toContain('ch-1');
  });
});

describe('fader taper', () => {
  it('spans −∞ to +6 dB', () => {
    expect(positionToFader(0)).toBe(FADER_MIN);
    expect(positionToFader(1)).toBe(6);
  });

  it('round-trips', () => {
    for (const db of [-60, -30, -12, -6, 0, 3, 6])
      expect(positionToFader(faderToPosition(db))).toBeCloseTo(db, 6);
  });

  it('gives 0 dB most of the travel', () => {
    expect(faderToPosition(0)).toBeGreaterThan(0.6);
    expect(faderToPosition(0)).toBeLessThan(0.8);
  });
});

describe('labels', () => {
  it('formats decibels', () => {
    expect(formatDb(-6)).toBe('−6.0 dB');
    expect(formatDb(3.25)).toBe('+3.3 dB');
    expect(formatDb(0)).toBe('0.0 dB');
    expect(formatDb(FADER_MIN, { floor: true })).toBe('−∞ dB');
  });

  it('formats pan', () => {
    expect(formatPan(0.5)).toBe('pan centre');
    expect(formatPan(0.35)).toBe('pan 30% left');
    expect(formatPan(1)).toBe('pan 100% right');
  });
});
