// @vitest-environment happy-dom
import { vi } from 'vitest';

// The engine touches `window` on import; the menu only needs node metadata.
vi.mock('@strudel/web', () => ({
  Pattern: class {},
  analysers: {},
  drawTimeScope: () => {},
  transpiler: () => ({ output: '' }),
}));

import { describe, expect, it } from 'vitest';
import { radialMenuItems } from './radial-menu';

const slice = (label: string) =>
  radialMenuItems.find((item) => item.label === label);
const titles = (label: string) =>
  slice(label)?.items.map((node) => node.title) ?? [];

describe('radial menu', () => {
  it('has a Utility slice with Time, Level and Scope', () =>
    expect(titles('Utility').sort()).toEqual(['Level', 'Scope', 'Time']));

  it('no longer lists them under Effects', () => {
    const effects = titles('Effects');
    for (const title of ['Time', 'Level', 'Scope'])
      expect(effects).not.toContain(title);
  });

  it('keeps the other slices', () =>
    expect(radialMenuItems.map((item) => item.label)).toEqual([
      'Instruments',
      'Sounds',
      'Effects',
      'Utility',
    ]));
});
