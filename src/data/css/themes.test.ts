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

describe('instrument swatches across light and dark', () => {
  const hues = (block: string) =>
    [...block.matchAll(/--instrument-\d:oklch\([\d.]+ [\d.]+ ([\d.]+)\)/g)].map(
      (match) => Number(match[1]),
    );

  for (const [name, css] of Object.entries(themeStyles)) {
    it(`keeps ${name}'s hues when switching mode`, () => {
      const [light, dark] = css.split('.dark{').map(hues);
      expect(light).toHaveLength(8);
      light.forEach((hue, i) => {
        const gap = Math.abs(hue - dark[i]) % 360;
        expect(Math.min(gap, 360 - gap)).toBeLessThanOrEqual(1);
      });
    });
  }
});
