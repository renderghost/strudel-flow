import { describe, expect, it } from 'vitest';
import type { Edge, XYPosition } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { migrateGraph } from './migrate';
import { wouldCreateCycle } from './graph';
import { A, B, F, G, O, definitions, edge, node } from './test-fixtures';

const createOutput = (position: XYPosition): AppNode => ({
  ...node('out', 'output-node'),
  position,
});
const m = (nodes: AppNode[], edges: Edge[]) =>
  migrateGraph({ nodes, edges }, definitions, createOutput);
const pairs = (edges: Edge[]) => edges.map((e) => `${e.source}>${e.target}`);
const at = (n: AppNode, x: number, y: number): AppNode => ({
  ...n,
  position: { x, y },
});

describe('migrateGraph', () => {
  it('adds an Output after a chain', () => {
    const { graph, migrated } = m(
      [at(A, 0, 0), at(F, 400, 100)],
      [edge('a', 'f')],
    );
    const outputs = graph.nodes.filter((n) => n.type === 'output-node');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].deletable).toBe(false);
    expect(outputs[0].position).toEqual({ x: 1000, y: 50 });
    expect(pairs(graph.edges)).toEqual(['a>f', 'f>out']);
    expect(migrated).toBe(true);
  });

  it('splits a star', () => {
    const { graph } = m([A, F, G], [edge('a', 'f'), edge('a', 'g')]);
    expect(pairs(graph.edges)).toEqual(
      expect.arrayContaining(['f>out', 'g>out']),
    );
  });

  it('reverses an edge into an instrument', () => {
    const { graph } = m([A, F], [edge('f', 'a')]);
    expect(pairs(graph.edges)).toEqual(['a>f', 'f>out']);
  });

  it('drops instrument→instrument and wires both', () => {
    const { graph } = m([A, B], [edge('a', 'b')]);
    expect(pairs(graph.edges).sort()).toEqual(['a>out', 'b>out']);
  });

  it('wires a lone instrument', () => {
    const { graph } = m([A], []);
    expect(pairs(graph.edges)).toEqual(['a>out']);
  });

  it('leaves probe scopes unwired', () => {
    const { graph } = m(
      [A, F, node('s', 'scope-node')],
      [edge('a', 'f'), edge('f', 's')],
    );
    expect(pairs(graph.edges)).toContain('f>out');
    expect(pairs(graph.edges)).not.toContain('s>out');
  });

  it('normalises paused effects', () => {
    const { graph } = m(
      [
        { ...A, data: { ...A.data, state: 'paused' } },
        { ...F, data: { ...F.data, state: 'paused' } },
      ],
      [edge('a', 'f')],
    );
    const state = (id: string) =>
      graph.nodes.find((n) => n.id === id)!.data.state;
    expect(state('f')).toBe('running');
    expect(state('a')).toBe('paused');
  });

  it('breaks cycles', () => {
    let result: ReturnType<typeof m> | undefined;
    expect(() => {
      result = m([A, F, G], [edge('a', 'f'), edge('f', 'g'), edge('g', 'f')]);
    }).not.toThrow();
    const edges = result!.graph.edges;
    for (const e of edges) {
      const others = edges.filter((other) => other !== e);
      expect(wouldCreateCycle(others, e.source, e.target)).toBe(false);
    }
  });

  it('keeps a patch that has an Output', () => {
    const { graph, migrated } = m([A, O], [edge('a', 'o')]);
    expect(migrated).toBe(false);
    expect(pairs(graph.edges)).toEqual(['a>o']);
    const twice = m(
      [A, O, node('o2', 'output-node')],
      [edge('a', 'o'), edge('a', 'o2')],
    );
    expect(
      twice.graph.nodes.filter((n) => n.type === 'output-node'),
    ).toHaveLength(1);
    expect(pairs(twice.graph.edges)).toEqual(['a>o']);
  });

  it('adds an Output to an empty graph silently', () => {
    const { graph, migrated } = m([], []);
    expect(graph.nodes.map((n) => n.type)).toEqual(['output-node']);
    expect(migrated).toBe(false);
  });
});
