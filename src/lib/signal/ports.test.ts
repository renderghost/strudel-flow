import { describe, expect, it } from 'vitest';
import type { Edge, XYPosition } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { compilePatch } from './compile';
import { assignPort, checkConnection, portOf, REFUSAL } from './graph';
import { migrateGraph } from './migrate';
import { A, B, O, definitions, edge, node, portEdge } from './test-fixtures';

const M = node('m', 'mix2');
const t = { cpm: '120', bpc: '4' };
const c = (nodes: AppNode[], edges: Edge[]) =>
  compilePatch(nodes, edges, t, definitions).portable;

describe('portOf', () => {
  it('keeps a known port and falls back to the first', () => {
    expect(portOf(portEdge('a', 'm', 'b'), ['a', 'b'])).toBe('b');
    expect(portOf(edge('a', 'm'), ['a', 'b'])).toBe('a');
    expect(portOf(portEdge('a', 'm', 'zz'), ['a', 'b'])).toBe('a');
  });
});

describe('port-aware compile', () => {
  it('hands each port its own input', () =>
    expect(
      c(
        [A, B, M, O],
        [portEdge('a', 'm', 'b'), portEdge('b', 'm', 'a'), edge('m', 'o')],
      ),
    ).toBe('setcpm(120/4)\n$: note("e") + note("c")'));

  it('stacks several wires into one port', () =>
    expect(
      c(
        [A, B, M, O],
        [portEdge('a', 'm', 'a'), portEdge('b', 'm', 'a'), edge('m', 'o')],
      ),
    ).toBe('setcpm(120/4)\n$: stack(note("c"), note("e"))'));

  it('lets one source feed two ports', () =>
    expect(
      c(
        [A, M, O],
        [portEdge('a', 'm', 'a'), portEdge('a', 'm', 'b'), edge('m', 'o')],
      ),
    ).toBe('setcpm(120/4)\n$: note("c") + note("c")'));
});

describe('port-aware connections', () => {
  const nodes = [A, M, O];

  it('allows the same source on another port', () =>
    expect(
      checkConnection(
        nodes,
        [portEdge('a', 'm', 'a')],
        { source: 'a', target: 'm', targetHandle: 'b' },
        definitions,
      ),
    ).toEqual({ ok: true }));

  it('refuses a duplicate on the same port', () =>
    expect(
      checkConnection(
        nodes,
        [portEdge('a', 'm', 'a')],
        { source: 'a', target: 'm', targetHandle: 'a' },
        definitions,
      ),
    ).toEqual({ ok: false, reason: REFUSAL.duplicate }));

  it('still refuses a duplicate between plain nodes', () =>
    expect(
      checkConnection(
        [A, node('f', 'fx')],
        [edge('a', 'f')],
        { source: 'a', target: 'f', targetHandle: null },
        definitions,
      ),
    ).toEqual({ ok: false, reason: REFUSAL.duplicate }));

  it('assigns the first free port when none is given', () => {
    expect(
      assignPort(
        { source: 'b', target: 'm', targetHandle: null },
        nodes,
        [portEdge('a', 'm', 'a')],
        definitions,
      ).targetHandle,
    ).toBe('b');
    expect(
      assignPort(
        { source: 'b', target: 'm', targetHandle: null },
        nodes,
        [portEdge('a', 'm', 'a'), portEdge('x', 'm', 'b')],
        definitions,
      ).targetHandle,
    ).toBe('a');
  });

  it('leaves plain targets and known ports alone', () => {
    const plain = { source: 'a', target: 'o', targetHandle: null };
    expect(assignPort(plain, nodes, [], definitions)).toBe(plain);
    const known = { source: 'a', target: 'm', targetHandle: 'b' };
    expect(assignPort(known, nodes, [], definitions)).toBe(known);
  });
});

describe('port-aware migration', () => {
  const createOutput = (position: XYPosition): AppNode => ({
    ...node('out', 'output-node'),
    position,
  });

  it('assigns missing and unknown ports to free channels', () => {
    const { graph } = migrateGraph(
      {
        nodes: [A, B, M, O],
        edges: [edge('a', 'm'), portEdge('b', 'm', 'nope'), edge('m', 'o')],
      },
      definitions,
      createOutput,
    );
    expect(
      graph.edges
        .filter((e) => e.target === 'm')
        .map((e) => `${e.source}>${e.targetHandle}`),
    ).toEqual(['a>a', 'b>b']);
  });

  it('keeps one source on two ports', () => {
    const { graph } = migrateGraph(
      {
        nodes: [A, M, O],
        edges: [
          portEdge('a', 'm', 'a'),
          portEdge('a', 'm', 'b'),
          edge('m', 'o'),
        ],
      },
      definitions,
      createOutput,
    );
    expect(graph.edges.filter((e) => e.target === 'm')).toHaveLength(2);
  });
});
