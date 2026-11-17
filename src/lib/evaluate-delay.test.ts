import { describe, expect, it } from 'vitest';
import { evaluateDelay } from './evaluate-delay';

describe('evaluateDelay', () => {
  it('waits briefly after a single change', () =>
    expect(evaluateDelay(1000, 1000)).toBe(40));

  it('never lets a drag postpone playback beyond 100 ms', () => {
    expect(evaluateDelay(1000, 1080)).toBe(20);
    expect(evaluateDelay(1000, 1150)).toBe(0);
  });
});
