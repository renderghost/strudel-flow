import { describe, expect, it } from 'vitest';
import { findOverrides, topLevelCalls } from './override';
import { A, O, definitions, edge, node } from './test-fixtures';

describe('topLevelCalls', () => {
  it('parses top-level calls', () => {
    expect(topLevelCalls('lpf(1000).lpq(1)')).toEqual(['lpf', 'lpq']);
    expect(topLevelCalls('room("0.5").rsize(2)')).toEqual(['room', 'rsize']);
    expect(topLevelCalls('sound("bd(3,8)").gain(sine.range(0, 1))')).toEqual([
      'sound',
      'gain',
    ]);
  });
});

describe('findOverrides', () => {
  const L1 = node('l1', 'lpf', { lpf: '800 1' });
  const L2 = node('l2', 'lpf', { lpf: '2000 1' });

  it('badges a filter overridden downstream', () =>
    expect(
      findOverrides(
        [A, L1, L2, O],
        [edge('a', 'l1'), edge('l1', 'l2'), edge('l2', 'o')],
        definitions,
      ).get('l1'),
    ).toBe('Filter'));

  it('does not badge when one path escapes', () =>
    expect(
      findOverrides(
        [A, L1, L2, O],
        [edge('a', 'l1'), edge('l1', 'l2'), edge('l2', 'o'), edge('l1', 'o')],
        definitions,
      ).has('l1'),
    ).toBe(false));

  it('never badges composing transforms', () => {
    const T1 = node('t1', 'time', { rate: '2' });
    const T2 = node('t2', 'time', { rate: '2' });
    expect(
      findOverrides(
        [A, T1, T2, O],
        [edge('a', 't1'), edge('t1', 't2'), edge('t2', 'o')],
        definitions,
      ).size,
    ).toBe(0);
  });

  it('never badges unheard nodes', () =>
    expect(
      findOverrides(
        [A, L1, L2],
        [edge('a', 'l1'), edge('l1', 'l2')],
        definitions,
      ).size,
    ).toBe(0));
});
