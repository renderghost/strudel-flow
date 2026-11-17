import { describe, expect, it } from 'vitest';
import { compilePatch } from './compile';
import { findOverrides } from './override';
import { A, O, definitions, edge, node } from './test-fixtures';

const chain = (data: Record<string, unknown>, cpm: string) =>
  compilePatch(
    [A, node('e', 'echo-node', data), O],
    [edge('a', 'e'), edge('e', 'o')],
    { cpm, bpc: '4' },
    definitions,
  ).portable;

describe('echo and tempo', () => {
  it('follows the tempo in free time', () => {
    const free = { sync: false, ms: 500 };
    expect(chain(free, '120')).toContain('.late(0.25)');
    expect(chain(free, '60')).toContain('.late(0.125)');
  });

  it('stays on the beat when synced', () => {
    const synced = { division: '1/8' };
    expect(chain(synced, '120')).toContain('.late(0.125)');
    expect(chain(synced, '60')).toContain('.late(0.125)');
  });

  it('gives the stock delay seconds at the current tempo', () =>
    expect(chain({ mode: 'clean', division: '1/4' }, '60')).toContain(
      '.delaytime(1)',
    ));
});

describe('echo overrides', () => {
  const twoEchoes = (mode: string) =>
    findOverrides(
      [
        A,
        node('e1', 'echo-node', { mode }),
        node('e2', 'echo-node', { mode }),
        O,
      ],
      [edge('a', 'e1'), edge('e1', 'e2'), edge('e2', 'o')],
      definitions,
    );

  it('lets tape echoes stack', () => expect(twoEchoes('tape').size).toBe(0));

  it('badges a clean echo replaced by a later one', () =>
    expect(twoEchoes('clean').get('e1')).toBe('Overridden by Echo downstream'));
});
