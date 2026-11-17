import { describe, expect, it } from 'vitest';
import { themeStyles } from './themes';

describe('themeStyles', () => {
  it('declares instrument swatches for light and dark', () => {
    const [light, dark] = themeStyles['caffeine'].split('.dark{');
    for (const block of [light, dark]) {
      expect(block).toContain('--instrument-1:');
      expect(block).toContain('--instrument-8:');
    }
  });
});
