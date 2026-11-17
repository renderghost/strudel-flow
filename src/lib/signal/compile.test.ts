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

  it('gives scopes a per-node id', () =>
    expect(
      c([A, node('s', 'scope-node'), O], [edge('a', 's'), edge('s', 'o')]),
    ).toBe('setcpm(120/4)\n$: note("c").analyze("flow-scope-s")'));

  it('survives a cycle', () =>
    expect(() =>
      c(
        [A, F, G, O],
        [edge('a', 'f'), edge('f', 'g'), edge('g', 'f'), edge('g', 'o')],
      ),
    ).not.toThrow());

  it('returns identical engine and portable code', () => {
    const r = compilePatch([A, O], [edge('a', 'o')], t, definitions);
    expect(r.engine).toBe(r.portable);
  });
});
