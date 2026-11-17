import { describe, expect, it } from 'vitest';
import { traceWaveform } from './scope-render';

const sine = (amplitude: number, length = 256, phase = 0) =>
  Float32Array.from(
    { length },
    (_, i) => amplitude * Math.sin(phase + (i / 32) * 2 * Math.PI),
  );
const flat = [
  [0, 25],
  [100, 25],
];

describe('traceWaveform', () => {
  it('draws a flat line without data', () =>
    expect(traceWaveform(undefined, 100, 50, 1)).toEqual(flat));

  it('draws a flat line for silence', () =>
    expect(traceWaveform(new Float32Array(256), 100, 50, 1)).toEqual(flat));

  it('centres and scales a sine, starting on a rising zero crossing', () => {
    const points = traceWaveform(sine(0.5, 256, 1), 100, 50, 1);
    for (const [, y] of points) {
      expect(y).toBeGreaterThanOrEqual(12.5 - 0.01);
      expect(y).toBeLessThanOrEqual(37.5 + 0.01);
    }
    // Within one sample step (0.5 × sin(2π/32) × 25 ≈ 2.4px) of the centre,
    // and heading up the canvas: a rising crossing.
    expect(Math.abs(points[0][1] - 25)).toBeLessThan(2.5);
    expect(points[1][1]).toBeLessThan(points[0][1]);
  });

  it('clamps to the canvas', () => {
    for (const [, y] of traceWaveform(sine(2), 100, 50, 2)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(50);
    }
  });

  it('treats NaN samples as silence', () => {
    const samples = sine(0.5);
    samples[10] = Number.NaN;
    for (const [x, y] of traceWaveform(samples, 100, 50, 1)) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});
