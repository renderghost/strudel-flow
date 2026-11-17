import { describe, expect, it } from 'vitest';
import {
  CLIP_DB,
  METER_MAX,
  METER_MIN,
  SILENT,
  meterPosition,
  meterStep,
  peakDb,
  type MeterState,
} from './meter';

const quiet: MeterState = {
  level: SILENT,
  hold: SILENT,
  holdFor: 0,
  clip: false,
};

describe('peakDb', () => {
  it('reads the loudest sample in dBFS', () => {
    expect(peakDb(new Float32Array([0, -0.5, 0.25]))).toBeCloseTo(-6.02, 2);
    expect(peakDb(new Float32Array([1]))).toBe(0);
  });

  it('is silent for nothing or zeros', () => {
    expect(peakDb(undefined)).toBe(SILENT);
    expect(peakDb(new Float32Array(4))).toBe(SILENT);
  });
});

describe('meterStep', () => {
  it('rises at once and falls slowly', () => {
    const up = meterStep(quiet, -6, 1 / 60);
    expect(up.level).toBe(-6);
    const down = meterStep(up, SILENT, 0.5);
    expect(down.level).toBeLessThan(-6);
    expect(down.level).toBeGreaterThan(-30);
  });

  it('holds the peak, then lets it fall', () => {
    const peak = meterStep(quiet, -3, 0.01);
    const held = meterStep(peak, -20, 0.5);
    expect(held.hold).toBe(-3);
    const falling = meterStep(meterStep(held, -20, 0.6), -20, 0.5);
    expect(falling.hold).toBeLessThan(-3);
    expect(falling.hold).toBeGreaterThanOrEqual(falling.level);
  });

  it('latches the clip light above 0 dBFS', () => {
    const clipped = meterStep(quiet, CLIP_DB + 0.5, 0.01);
    expect(clipped.clip).toBe(true);
    expect(meterStep(clipped, -40, 5).clip).toBe(true);
    expect(meterStep(quiet, 0, 0.01).clip).toBe(false);
  });

  it('settles to silence', () => {
    let state = meterStep(quiet, 0, 0.01);
    for (let i = 0; i < 600; i++) state = meterStep(state, SILENT, 1 / 60);
    expect(meterPosition(state.level)).toBe(0);
    expect(meterPosition(state.hold)).toBe(0);
  });
});

describe('meterPosition', () => {
  it('maps −60…+6 dB onto the meter', () => {
    expect(meterPosition(METER_MIN)).toBe(0);
    expect(meterPosition(METER_MAX)).toBe(1);
    expect(meterPosition(SILENT)).toBe(0);
    expect(meterPosition(20)).toBe(1);
    expect(meterPosition(-27)).toBeCloseTo(0.5, 6);
  });
});
