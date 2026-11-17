import { describe, expect, it } from 'vitest';
import { copySelectedNodes } from './node-clipboard';
import { A, F, O, edge } from './signal/test-fixtures';

describe('copySelectedNodes', () => {
  it('copySelectedNodes excludes Output', () => {
    const selection = copySelectedNodes({
      nodes: [A, F, O].map((node) => ({ ...node, selected: true })),
      edges: [edge('a', 'f'), edge('f', 'o')],
    });
    expect(selection?.nodes.map((node) => node.id)).toEqual(['a', 'f']);
    expect(selection?.edges.map((e) => `${e.source}>${e.target}`)).toEqual([
      'a>f',
    ]);
  });
});
