import { describe, expect, it } from 'vitest';
import { checkConnection, dropRefusal, REFUSAL, roleOf } from './graph';
import { definitions, edge, node } from './test-fixtures';

const nodes = [
  node('a', 'inst'),
  node('b', 'inst'),
  node('f', 'fx'),
  node('g', 'fx'),
  node('o', 'output-node'),
];

describe('checkConnection', () => {
  it('refuses self-connection as a loop', () =>
    expect(
      checkConnection(nodes, [], { source: 'f', target: 'f' }, definitions),
    ).toEqual({ ok: false, reason: REFUSAL.loop }));

  it('refuses a two-node loop', () =>
    expect(
      checkConnection(
        nodes,
        [edge('f', 'g')],
        { source: 'g', target: 'f' },
        definitions,
      ),
    ).toEqual({ ok: false, reason: REFUSAL.loop }));

  it('refuses a longer loop', () =>
    expect(
      checkConnection(
        nodes,
        [edge('f', 'g'), edge('g', 'o')],
        { source: 'g', target: 'f' },
        definitions,
      ).ok,
    ).toBe(false));

  it('refuses wiring into an instrument', () =>
    expect(
      checkConnection(nodes, [], { source: 'f', target: 'a' }, definitions),
    ).toEqual({ ok: false, reason: REFUSAL.intoInstrument }));

  it('refuses wiring out of the Output', () =>
    expect(
      checkConnection(nodes, [], { source: 'o', target: 'f' }, definitions),
    ).toEqual({ ok: false, reason: REFUSAL.outOfOutput }));

  it('refuses a duplicate wire', () =>
    expect(
      checkConnection(
        nodes,
        [edge('a', 'f')],
        { source: 'a', target: 'f' },
        definitions,
      ),
    ).toEqual({ ok: false, reason: REFUSAL.duplicate }));

  it('allows fan-out and fan-in', () =>
    expect(
      checkConnection(
        nodes,
        [edge('a', 'f'), edge('b', 'g')],
        { source: 'a', target: 'g' },
        definitions,
      ),
    ).toEqual({ ok: true }));
});

describe('dropRefusal', () => {
  const byId = (id: string) => nodes.find((n) => n.id === id)!;

  it('explains an output wire dropped on an instrument body', () =>
    expect(dropRefusal(byId('a'), 'source', definitions)).toBe(
      REFUSAL.intoInstrument,
    ));

  it('explains an input wire dropped on the Output body', () =>
    expect(dropRefusal(byId('o'), 'target', definitions)).toBe(
      REFUSAL.outOfOutput,
    ));

  it('stays quiet for drops that have no role-based refusal', () =>
    expect([
      dropRefusal(byId('f'), 'source', definitions),
      dropRefusal(byId('a'), 'target', definitions),
      dropRefusal(byId('o'), 'source', definitions),
    ]).toEqual([null, null, null]));
});

describe('roleOf', () => {
  it('classifies roles', () =>
    expect(
      ['a', 'f', 'o'].map((id) =>
        roleOf(
          nodes.find((n) => n.id === id)!,
          definitions,
        ),
      ),
    ).toEqual(['instrument', 'processor', 'output']));
});
