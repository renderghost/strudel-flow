import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  echoCode,
  rateCycles,
  rateSeconds,
  readEcho,
  repeatsPerHead,
  type EchoData,
} from './echo';

// Run generated code with real Strudel (core only: no audio, no mini-notation).
const require = createRequire(import.meta.url);
const core: Record<string, unknown> = await import(
  createRequire(require.resolve('@strudel/web/package.json')).resolve(
    '@strudel/core',
  )
);
const names = Object.keys(core).filter((name) =>
  /^[A-Za-z_$][\w$]*$/.test(name),
);
type Hap = { whole: { begin: { valueOf(): number } }; value: unknown };
const run = (code: string): Hap[] =>
  (
    new Function(...names, `return ${code}`)(
      ...names.map((name) => core[name]),
    ) as { queryArc(a: number, b: number): Hap[] }
  ).queryArc(0, 1);
type Played = { at: number } & Record<string, number>;
const values = (haps: Hap[]): Played[] =>
  haps
    .map((hap): Played => ({
      at: Number(hap.whole.begin.valueOf().toFixed(4)),
      ...(hap.value as Record<string, number>),
    }))
    // Keep notes that start in this cycle, not last cycle's repeats.
    .filter((hap) => hap.at >= 0)
    .sort((a, b) => a.at - b.at);

const tempo = { bpm: 120, bpc: 4 };
const echo = (overrides: Partial<EchoData> = {}): EchoData => ({
  ...readEcho({}),
  ...overrides,
});

describe('readEcho', () => {
  it('starts as a dotted-eighth tape echo on head 1', () =>
    expect(readEcho({})).toEqual({
      mode: 'tape',
      sync: true,
      division: '1/8.',
      ms: 300,
      intensity: 0.5,
      volume: 0.6,
      tone: 0.4,
      saturation: 0.3,
      heads: [true, false, false],
    }));

  it('repairs hand-edited values', () => {
    const data = readEcho({
      mode: 'warp',
      division: '1/3',
      ms: 5,
      intensity: 9,
      heads: [false, false, false],
    });
    expect(data.mode).toBe('tape');
    expect(data.division).toBe('1/8.');
    expect(data.ms).toBe(40);
    expect(data.intensity).toBe(1.25);
    expect(data.heads).toEqual([true, false, false]);
  });
});

describe('rate', () => {
  it('turns beat divisions into cycles', () => {
    expect(rateCycles(echo({ division: '1/8' }), tempo)).toBe(0.125);
    expect(rateCycles(echo({ division: '1/8.' }), tempo)).toBe(0.1875);
    expect(
      rateCycles(echo({ division: '1/4' }), { bpm: 90, bpc: 3 }),
    ).toBeCloseTo(1 / 3);
  });

  it('turns free time into cycles at the current tempo', () => {
    // 120 bpm, 4 beats a cycle: a cycle lasts 2 s.
    expect(rateCycles(echo({ sync: false, ms: 500 }), tempo)).toBe(0.25);
    expect(
      rateCycles(echo({ sync: false, ms: 500 }), { bpm: 60, bpc: 4 }),
    ).toBe(0.125);
  });

  it('gives seconds for the stock delay', () => {
    expect(rateSeconds(echo({ division: '1/4' }), tempo)).toBe(0.5);
    expect(rateSeconds(echo({ sync: false, ms: 300 }), tempo)).toBe(0.3);
  });
});

describe('repeatsPerHead', () => {
  it('stops below −60 dB', () =>
    expect(repeatsPerHead(echo({ volume: 0.5, intensity: 0.5 }))).toBe(8));

  it('swells for 12 repeats at intensity 1 and above', () =>
    expect(repeatsPerHead(echo({ intensity: 1.2 }))).toBe(12));

  it('shares 24 repeats between three heads', () =>
    expect(
      repeatsPerHead(echo({ intensity: 1, heads: [true, true, true] })),
    ).toBe(8));

  it('has none with no feedback or no volume', () => {
    expect(repeatsPerHead(echo({ intensity: 0 }))).toBe(0);
    expect(repeatsPerHead(echo({ volume: 0 }))).toBe(0);
  });
});

describe('tape echo', () => {
  const base = { division: '1/8' as const, volume: 0.5, intensity: 0.5 };

  it('keeps the dry note and adds darker, quieter, driven repeats', () => {
    // One note every 4 cycles, so earlier repeats don't land in this cycle.
    const haps = values(run(echoCode(echo(base), 'note("c").slow(4)', tempo)));
    expect(haps[0]).toEqual({ at: 0, note: 'c' });
    expect(haps.slice(1, 4).map((hap) => hap.at)).toEqual([0.125, 0.25, 0.375]);
    expect(haps[1].velocity).toBeCloseTo(0.25);
    expect(haps[2].velocity).toBeCloseTo(0.125);
    expect(haps[2].cutoff).toBeLessThan(haps[1].cutoff);
    expect(haps[2].shape).toBeGreaterThan(haps[1].shape);
  });

  it('never makes a repeat brighter than its source', () => {
    const haps = values(run(echoCode(echo(base), 'note("c").lpf(600)', tempo)));
    for (const hap of haps) expect(hap.cutoff).toBeLessThanOrEqual(600);
  });

  it('runs one repeat train per head, spaced by the head', () => {
    const code = echoCode(
      echo({ ...base, heads: [true, false, true] }),
      'note("c")',
      tempo,
    );
    const times = values(run(code)).map((hap) => hap.at);
    expect(times).toContain(0.125);
    expect(times).toContain(0.375);
    expect(times).toContain(0.75);
  });

  it('caps a swelling repeat at +3.5 dB', () => {
    const haps = values(
      run(
        echoCode(
          echo({ ...base, intensity: 1.25, volume: 1 }),
          'note("c")',
          tempo,
        ),
      ),
    );
    for (const hap of haps) expect(hap.velocity ?? 1).toBeLessThanOrEqual(1.5);
  });

  it('leaves out drive when saturation is off', () =>
    expect(echoCode(echo({ saturation: 0 }), 'note("c")', tempo)).not.toContain(
      'shape',
    ));

  it('passes the input through with nothing to repeat', () => {
    expect(echoCode(echo({ volume: 0 }), 'note("c")', tempo)).toBe('note("c")');
    expect(echoCode(echo({ intensity: 0 }), 'note("c")', tempo)).toBe(
      'note("c")',
    );
  });

  it('survives bare values', () =>
    expect(() => run(echoCode(echo(base), 'pure("c")', tempo))).not.toThrow());

  it('produces nothing with nothing wired in', () =>
    expect(echoCode(echo(), '', tempo)).toBe(''));
});

describe('clean echo', () => {
  it('uses the stock delay, with feedback capped at 0.98', () =>
    expect(
      echoCode(
        echo({ mode: 'clean', division: '1/4', volume: 0.6, intensity: 1.2 }),
        'note("c")',
        tempo,
      ),
    ).toBe('note("c").delay(0.6).delaytime(0.5).delayfeedback(0.98)'));
});
