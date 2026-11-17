import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { compilePatch, expressionAt } from './compile';
import { audibility, isNotHeard } from './audibility';
import { findOverrides } from './override';
import { A, B, O, definitions, edge, node, portEdge } from './test-fixtures';

const t = { cpm: '120', bpc: '4' };
const channels = (overrides: Record<number, object>) =>
  Array.from({ length: 8 }, (_, i) => ({ ...overrides[i + 1] }));
const mixer = (id: string, data: Record<string, unknown> = {}): AppNode =>
  node(id, 'mixer-node', data);
const M = mixer('m');

describe('mixer meters', () => {
  const nodes = [A, B, M, O];
  const edges: Edge[] = [
    portEdge('a', 'm', 'ch-1'),
    portEdge('b', 'm', 'ch-3'),
    edge('m', 'o'),
  ];
  const { engine, portable } = compilePatch(nodes, edges, t, definitions);

  it('taps each wired strip and the master, silently', () => {
    expect(engine).toContain(
      `$: (() => { try { return note("c").pan(0.5); } catch { return silence; } })().analyze("flow-meter-m-ch-1").fft(6).flowtap(1)`,
    );
    expect(engine).toContain('.analyze("flow-meter-m-ch-3")');
    expect(engine).toContain('.analyze("flow-meter-m-master-l")');
    expect(engine).not.toContain('flow-meter-m-ch-2');
  });

  it('keeps meters out of the portable code', () =>
    expect(portable).not.toContain('flow-meter'));

  it('meters a mixer that is not wired to the Output', () =>
    expect(
      compilePatch([A, M, O], [portEdge('a', 'm', 'ch-1')], t, definitions)
        .engine,
    ).toContain('flow-meter-m-ch-1'));
});

describe('expressionAt', () => {
  it('gives the code at the mixer output', () =>
    expect(
      expressionAt(
        [A, B, M, O],
        [portEdge('a', 'm', 'ch-1'), portEdge('b', 'm', 'ch-2')],
        'm',
        definitions,
      ),
    ).toBe('stack(\n  note("c").pan(0.5),\n  note("e").pan(0.5),\n)'));

  it('is null with nothing wired in', () =>
    expect(expressionAt([M], [], 'm', definitions)).toBeNull());
});

describe('mixer audibility', () => {
  it('treats a source on a muted channel as not heard', () => {
    const muted = mixer('m', { channels: channels({ 1: { muted: true } }) });
    const edges = [
      portEdge('a', 'm', 'ch-1'),
      portEdge('b', 'm', 'ch-2'),
      edge('m', 'o'),
    ];
    const result = audibility([A, B, muted, O], edges, definitions);
    expect(result.heard.has('a')).toBe(false);
    expect(result.heard.has('b')).toBe(true);
    expect(result.live.has('a-m-ch-1')).toBe(false);
    expect(result.live.has('b-m-ch-2')).toBe(true);
  });

  it('treats a soloed-out source as not heard', () => {
    const solo = mixer('m', { channels: channels({ 2: { solo: true } }) });
    const result = audibility(
      [A, B, solo, O],
      [portEdge('a', 'm', 'ch-1'), portEdge('b', 'm', 'ch-2'), edge('m', 'o')],
      definitions,
    );
    expect(result.heard.has('a')).toBe(false);
    expect(result.heard.has('b')).toBe(true);
  });

  it('silences everything behind a muted mixer, which says Muted instead', () => {
    const muted = mixer('m', { muted: true });
    const result = audibility(
      [A, muted, O],
      [portEdge('a', 'm', 'ch-1'), edge('m', 'o')],
      definitions,
    );
    expect(result.heard.has('a')).toBe(false);
    expect(isNotHeard(A, result, definitions)).toBe(true);
    expect(isNotHeard(muted, result, definitions)).toBe(false);
  });
});

describe('partial overrides', () => {
  const panned = node('l', 'level', { pan: '0.2' });
  const pannedAndLoud = node('l', 'level', { pan: '0.2', gain: '1.5' });

  it('badges a Level pan replaced by a mixer channel', () =>
    expect(
      findOverrides(
        [A, panned, M, O],
        [edge('a', 'l'), portEdge('l', 'm', 'ch-1'), edge('m', 'o')],
        definitions,
      ).get('l'),
    ).toBe('Pan overridden by Mixer downstream'));

  it('names only the replaced controls', () =>
    expect(
      findOverrides(
        [A, pannedAndLoud, M, O],
        [edge('a', 'l'), portEdge('l', 'm', 'ch-1'), edge('m', 'o')],
        definitions,
      ).get('l'),
    ).toBe('Pan overridden by Mixer downstream'));

  it('keeps the full copy when every control is replaced', () => {
    const L1 = node('l1', 'lpf', { lpf: '800 1' });
    const L2 = node('l2', 'lpf', { lpf: '2000 1' });
    expect(
      findOverrides(
        [A, L1, L2, O],
        [edge('a', 'l1'), edge('l1', 'l2'), edge('l2', 'o')],
        definitions,
      ).get('l1'),
    ).toBe('Overridden by Filter downstream');
  });

  it('badges the mixer master when a Level replaces postgain', () => {
    const post = node('l', 'level', { postgain: '1.5' });
    expect(
      findOverrides(
        [A, M, post, O],
        [portEdge('a', 'm', 'ch-1'), edge('m', 'l'), edge('l', 'o')],
        definitions,
      ).get('m'),
    ).toBe('Master overridden by Level downstream');
  });

  it('never badges levels between two mixers in series', () => {
    const notes = findOverrides(
      [A, M, mixer('n'), O],
      [portEdge('a', 'm', 'ch-1'), portEdge('m', 'n', 'ch-1'), edge('n', 'o')],
      definitions,
    );
    expect(notes.get('m')).toBe('Pan overridden by Mixer downstream');
  });

  it('does not badge Level postgain feeding a mixer (it multiplies)', () =>
    expect(
      findOverrides(
        [A, node('l', 'level', { postgain: '1.5' }), M, O],
        [edge('a', 'l'), portEdge('l', 'm', 'ch-1'), edge('m', 'o')],
        definitions,
      ).has('l'),
    ).toBe(false));
});

describe('overrides by different nodes', () => {
  it('names each replaced control with its replacer', () => {
    const first = node('l1', 'level', { pan: '0.2', postgain: '1.5' });
    const post = node('l3', 'level', { postgain: '0.5' });
    expect(
      findOverrides(
        [A, first, M, post, O],
        [
          edge('a', 'l1'),
          portEdge('l1', 'm', 'ch-1'),
          edge('m', 'l3'),
          edge('l3', 'o'),
        ],
        definitions,
      ).get('l1'),
    ).toBe(
      'Pan overridden by Mixer downstream, postgain overridden by Level downstream',
    );
  });
});
