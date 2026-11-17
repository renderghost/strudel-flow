import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { colourOf, instrumentsFeeding } from './sources';
import { A, B, F, G, definitions, edge, node } from './test-fixtures';

const ids = (found: { id: string }[]) => found.map((n) => n.id);

describe('colourOf', () => {
  it('reads a swatch index', () => {
    expect(colourOf(node('x', 'inst', { colour: 3 }))).toBe(3);
    expect(colourOf(node('x', 'inst', { colour: '5' }))).toBe(5);
  });

  it('treats missing or invalid values as no colour', () => {
    for (const colour of [undefined, 9, -1, 'x', 2.5, null])
      expect(colourOf(node('x', 'inst', { colour }))).toBeNull();
  });
});

describe('instrumentsFeeding', () => {
  const all = [A, B, F, G];
  const feeding = (id: string, edges: Edge[], port: string | null = null) =>
    ids(instrumentsFeeding(id, port, all, edges, definitions));

  it('finds instruments through a chain', () =>
    expect(feeding('g', [edge('a', 'f'), edge('f', 'g')])).toEqual(['a']));

  it('finds every instrument of a merge once', () =>
    expect(
      feeding('g', [
        edge('a', 'f'),
        edge('b', 'f'),
        edge('a', 'g'),
        edge('f', 'g'),
      ]).sort(),
    ).toEqual(['a', 'b']));

  it('filters the first hop by port', () => {
    const into = (source: string, port: string): Edge => ({
      ...edge(source, 'g'),
      id: `${source}-g-${port}`,
      targetHandle: port,
    });
    expect(
      feeding('g', [into('a', 'ch-1'), into('b', 'ch-2')], 'ch-2'),
    ).toEqual(['b']);
  });

  it('survives a cycle', () =>
    expect(
      feeding('g', [edge('a', 'f'), edge('f', 'g'), edge('g', 'f')]),
    ).toEqual(['a']));

  it('includes muted instruments', () => {
    const muted = node('a', 'inst', { ...A.data, state: 'paused' });
    expect(
      ids(
        instrumentsFeeding(
          'f',
          null,
          [muted, F],
          [edge('a', 'f')],
          definitions,
        ),
      ),
    ).toEqual(['a']);
  });
});
