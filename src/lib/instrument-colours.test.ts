import { describe, expect, it } from 'vitest';
import presets from '@/data/css/tweakcn-themes.json';
import {
  contrastRatio,
  parseOklch,
  swatchesFor,
  SWATCH_COUNT,
} from './instrument-colours';

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe('parseOklch', () => {
  it('parses plain and percentage lightness', () => {
    expect(parseOklch('oklch(0.5 0.1 200)')).toEqual({
      l: 0.5,
      c: 0.1,
      h: 200,
    });
    expect(parseOklch('oklch(50% 0.1 200)').l).toBe(0.5);
  });
});

describe('contrastRatio', () => {
  it('rates black on white at 21:1', () =>
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(21, 1));
});

describe('swatchesFor', () => {
  for (const preset of presets) {
    for (const mode of ['light', 'dark'] as const) {
      it(`gives ${preset.name} (${mode}) ${SWATCH_COUNT} legible, distinct swatches`, () => {
        const { card } = preset[mode];
        const swatches = swatchesFor(preset.light.primary, card, mode);
        expect(swatches).toHaveLength(SWATCH_COUNT);
        for (const swatch of swatches)
          expect(contrastRatio(swatch, card)).toBeGreaterThanOrEqual(3);
        const hues = swatches.map((swatch) => parseOklch(swatch).h);
        hues.forEach((a, i) =>
          hues
            .slice(i + 1)
            .forEach((b) => expect(hueGap(a, b)).toBeGreaterThanOrEqual(40)),
        );
      });
    }
  }

  it('still gives the mono theme real colours', () => {
    const mono = presets.find((preset) => preset.name === 'mono')!;
    for (const swatch of swatchesFor(
      mono.light.primary,
      mono.light.card,
      'light',
    ))
      expect(parseOklch(swatch).c).toBeGreaterThanOrEqual(0.1);
  });
});
