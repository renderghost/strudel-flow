import { describe, expect, it } from 'vitest';
import type { AppNode } from '@/components/nodes/types';
import { audibility, isNotHeard } from './audibility';
import { A, B, F, G, O, definitions, edge, node } from './test-fixtures';

const muted = (n: AppNode): AppNode => ({
  ...n,
  data: { ...n.data, state: 'paused' },
});
const S = node('s', 'scope-node');
const run = (nodes: AppNode[], edges: ReturnType<typeof edge>[]) =>
  audibility(nodes, edges, definitions);

describe('audibility', () => {
  it('hears a whole chain', () => {
    const r = run([A, F, O], [edge('a', 'f'), edge('f', 'o')]);
    expect([...r.heard].sort()).toEqual(['a', 'f', 'o']);
    expect([...r.live].sort()).toEqual(['a-f', 'f-o']);
  });

  it('does not hear a node with no path to the Output', () => {
    const r = run(
      [A, F, G, O],
      [edge('a', 'f'), edge('a', 'g'), edge('f', 'o')],
    );
    expect(r.heard.has('g')).toBe(false);
    expect(r.live.has('a-g')).toBe(false);
  });

  it('does not hear what only muted sources feed', () => {
    const r = run([muted(A), F, O], [edge('a', 'f'), edge('f', 'o')]);
    expect(r.heard.has('f')).toBe(false);
    expect(r.live.size).toBe(0);
  });

  it('hears a merge while one source is muted', () => {
    const r = run(
      [muted(A), B, F, O],
      [edge('a', 'f'), edge('b', 'f'), edge('f', 'o')],
    );
    expect(r.heard.has('f')).toBe(true);
    expect(r.live.has('b-f')).toBe(true);
    expect(r.live.has('a-f')).toBe(false);
  });

  it('does not count a dead-end Scope wire as live', () => {
    const r = run([A, S, O], [edge('a', 's'), edge('a', 'o')]);
    expect(r.live.has('a-s')).toBe(false);
    expect(r.live.has('a-o')).toBe(true);
  });

  it('passes sound through an inline Scope', () => {
    const r = run([A, S, O], [edge('a', 's'), edge('s', 'o')]);
    expect(r.heard.has('s')).toBe(true);
    expect(r.live.has('s-o')).toBe(true);
  });

  it('does not hear an unfed processor', () =>
    expect(run([F, O], [edge('f', 'o')]).heard.has('f')).toBe(false));

  it('always hears the Output', () =>
    expect(run([O], []).heard.has('o')).toBe(true));

  it('survives a cycle', () =>
    expect(() =>
      run(
        [A, F, G, O],
        [edge('a', 'f'), edge('f', 'g'), edge('g', 'f'), edge('g', 'o')],
      ),
    ).not.toThrow());
});

describe('isNotHeard', () => {
  it('flags unheard processors and instruments only', () => {
    const nodes = [muted(A), B, F, S, O];
    const edges = [edge('a', 's'), edge('b', 'f')];
    const r = audibility(nodes, edges, definitions);
    const flagged = nodes
      .filter((n) => isNotHeard(n, r, definitions))
      .map((n) => n.id);
    // f and b have no path to the Output; muted a, Scope s and Output o are exempt
    expect(flagged.sort()).toEqual(['b', 'f']);
  });
});
