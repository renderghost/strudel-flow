import { describe, expect, it } from 'vitest';
import { keyStep, quantise, wheelSteps, type SliderRange } from './slider';

const db: SliderRange = { min: -60, max: 6, step: 1, fine: 0.1 };
const pan: SliderRange = { min: 0, max: 1, step: 0.05, fine: 0.01 };

describe('keyStep', () => {
  it('steps by 1 dB, or 0.1 dB with Shift', () => {
    expect(keyStep(-6, 'ArrowUp', false, db)).toBe(-5);
    expect(keyStep(-6, 'ArrowDown', true, db)).toBe(-6.1);
    expect(keyStep(-6, 'ArrowRight', false, db)).toBe(-5);
  });

  it('steps pan by 0.05', () =>
    expect(keyStep(0.5, 'ArrowLeft', false, pan)).toBe(0.45));

  it('jumps with Page keys, Home and End', () => {
    expect(keyStep(0, 'PageDown', false, db)).toBe(-10);
    expect(keyStep(0, 'Home', false, db)).toBe(-60);
    expect(keyStep(0, 'End', false, db)).toBe(6);
  });

  it('stays in range and ignores other keys', () => {
    expect(keyStep(5.5, 'ArrowUp', false, db)).toBe(6);
    expect(keyStep(0, 'a', false, db)).toBeNull();
  });
});

describe('wheelSteps', () => {
  it('turns one mouse notch into one step', () =>
    expect(wheelSteps(0, -100)).toEqual({ steps: 1, rest: 0 }));

  it('collects small trackpad deltas', () => {
    const first = wheelSteps(0, 30);
    expect(first.steps).toBe(0);
    expect(wheelSteps(first.rest, 80)).toEqual({ steps: -1, rest: 10 });
  });
});

describe('quantise', () => {
  it('rounds to the fine step without float noise', () => {
    expect(quantise(-6.04999, db)).toBe(-6);
    expect(quantise(0.1 + 0.2, pan)).toBe(0.3);
  });
});
