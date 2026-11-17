import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Guards the pnpm patch on @strudel/web (pnpm-patches/). If the package is
// upgraded and the patch no longer applies, CI's frozen install fails first;
// these tests catch a patch that applies but no longer hooks the right spots.
const bundle = readFileSync(
  createRequire(import.meta.url)
    .resolve('@strudel/web/package.json')
    .replace(/package\.json$/, 'dist/index.mjs'),
  'utf8',
);

const has = (snippet: string) => bundle.includes(snippet);

describe('patched superdough', () => {
  it('silent taps skip the speakers', () =>
    expect(has('e.flowtap || qi(pn, _r)')).toBe(true));

  it('silent taps skip reverb and delay sends', () => {
    expect(has('!e.flowtap && ut > 0')).toBe(true);
    expect(has('!e.flowtap && Kt > 0')).toBe(true);
  });

  it('exports the master output', () =>
    expect(/as getMasterOutput\b/.test(bundle)).toBe(true));
});
