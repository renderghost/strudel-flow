import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { compilePatch } from './compile';
import { A, B, F, G, O, definitions, edge, node } from './test-fixtures';

const t = { cpm: '120', bpc: '4' };
const c = (nodes: AppNode[], edges: Edge[]) =>
  compilePatch(nodes, edges, t, definitions).portable;
const muted = (n: AppNode): AppNode => ({
  ...n,
  data: { ...n.data, state: 'paused' },
});

describe('compilePatch', () => {
  it('compiles a chain', () =>
    expect(c([A, F, O], [edge('a', 'f'), edge('f', 'o')])).toBe(
      'setcpm(120/4)\n$: note("c").fx(2)',
    ));

  it('follows wires, not node order', () => {
    expect(
      c([G, O, F, A], [edge('a', 'f'), edge('f', 'g'), edge('g', 'o')]),
    ).toBe('setcpm(120/4)\n$: note("c").fx(2).fx(3)');
    expect(
      c([F, G, A, O], [edge('a', 'g'), edge('g', 'f'), edge('f', 'o')]),
    ).toBe('setcpm(120/4)\n$: note("c").fx(3).fx(2)');
  });

  it('splits into independent copies', () =>
    expect(
      c(
        [A, F, G, O],
        [edge('a', 'f'), edge('a', 'g'), edge('f', 'o'), edge('g', 'o')],
      ),
    ).toBe('setcpm(120/4)\n$: note("c").fx(2)\n$: note("c").fx(3)'));

  it('merges with stack', () =>
    expect(
      c([A, B, F, O], [edge('a', 'f'), edge('b', 'f'), edge('f', 'o')]),
    ).toBe('setcpm(120/4)\n$: stack(note("c"), note("e")).fx(2)'));

  it('handles a diamond', () =>
    expect(
      c(
        [A, F, G, O],
        [edge('a', 'f'), edge('f', 'g'), edge('a', 'g'), edge('g', 'o')],
      ),
    ).toBe('setcpm(120/4)\n$: stack(note("c").fx(2), note("c")).fx(3)'));

  it('mutes one instrument only', () =>
    expect(
      c([muted(A), B, F, O], [edge('a', 'f'), edge('b', 'f'), edge('f', 'o')]),
    ).toBe('setcpm(120/4)\n$: note("e").fx(2)'));

  it('emits nothing when every instrument is muted', () =>
    expect(c([muted(A), O], [edge('a', 'o')])).toBe(''));

  it('emits nothing without an Output path', () =>
    expect(c([A, F], [edge('a', 'f')])).toBe(''));

  it('emits nothing for an unfed processor', () =>
    expect(c([F, O], [edge('f', 'o')])).toBe(''));

  it('wires an instrument straight to Output', () =>
    expect(c([A, O], [edge('a', 'o')])).toBe('setcpm(120/4)\n$: note("c")'));

  describe('scopes', () => {
    const S = node('s', 'scope-node');
    const S1 = node('s1', 'scope-node');
    const S2 = node('s2', 'scope-node');
    const e = (nodes: AppNode[], edges: Edge[]) =>
      compilePatch(nodes, edges, t, definitions).engine;
    // A tap that throws falls back to silence, so a Scope can never stop
    // the patch from playing.
    const tap = (expr: string, id: string) =>
      `$: (() => { try { return ${expr}; } catch { return silence; } })().analyze("flow-scope-${id}").flowtap(1)`;

    it('are pass-through in portable code', () =>
      expect(c([A, S, O], [edge('a', 's'), edge('s', 'o')])).toBe(
        'setcpm(120/4)\n$: note("c")',
      ));

    const heard = (expr: string) => `$: ${expr}`;

    it('are tapped silently in engine code', () =>
      expect(e([A, S, O], [edge('a', 's'), edge('s', 'o')])).toBe(
        ['setcpm(120/4)', heard('note("c")'), tap('note("c")', 's')].join('\n'),
      ));

    it('tap a dead-end scope', () =>
      expect(e([A, S, O], [edge('a', 's'), edge('a', 'o')])).toBe(
        ['setcpm(120/4)', heard('note("c")'), tap('note("c")', 's')].join('\n'),
      ));

    it('tap a scope with no Output path', () => {
      const r = compilePatch([A, S], [edge('a', 's')], t, definitions);
      expect(r.portable).toBe('');
      expect(r.engine).toBe(`setcpm(120/4)\n${tap('note("c")', 's')}`);
    });

    it('do not tap a silenced scope', () =>
      expect(e([muted(A), S, O], [edge('a', 's'), edge('s', 'o')])).toBe(''));

    it('tap each scope at its own position', () => {
      const nodes = [A, S1, F, S2, O];
      const edges = [
        edge('a', 's1'),
        edge('s1', 'f'),
        edge('f', 's2'),
        edge('s2', 'o'),
      ];
      expect(c(nodes, edges)).toBe('setcpm(120/4)\n$: note("c").fx(2)');
      expect(e(nodes, edges)).toBe(
        [
          'setcpm(120/4)',
          heard('note("c").fx(2)'),
          tap('note("c")', 's1'),
          tap('note("c").fx(2)', 's2'),
        ].join('\n'),
      );
    });

    it('tap a merged scope with stack', () =>
      expect(
        e([A, B, S, O], [edge('a', 's'), edge('b', 's'), edge('s', 'o')]),
      ).toContain(tap('stack(note("c"), note("e"))', 's')));
  });

  it('plays the same notes in engine and portable code', () => {
    const nodes = [A, B, F, G, node('s', 'scope-node'), O];
    const edges = [
      edge('a', 'f'),
      edge('b', 'f'),
      edge('a', 'g'),
      edge('f', 's'),
      edge('s', 'o'),
      edge('g', 'o'),
    ];
    const r = compilePatch(nodes, edges, t, definitions);
    const audible = r.engine
      .split('\n')
      .filter((line) => !line.includes('flowtap'))
      .join('\n');
    expect(audible).toBe(r.portable);
  });

  it('survives a cycle', () =>
    expect(() =>
      c(
        [A, F, G, O],
        [edge('a', 'f'), edge('f', 'g'), edge('g', 'f'), edge('g', 'o')],
      ),
    ).not.toThrow());

  it('returns identical engine and portable code without scopes', () => {
    const r = compilePatch([A, O], [edge('a', 'o')], t, definitions);
    expect(r.engine).toBe(r.portable);
  });
});
