import type { Edge } from '@xyflow/react';
import type { NodeDefinition } from '@/components/nodes/define-node';
import type { AppNode } from '@/components/nodes/types';

export type SignalDefinition = Pick<
  NodeDefinition,
  'title' | 'category' | 'generatePattern'
>;
export type SignalDefinitions = Record<string, SignalDefinition>;

export const OUTPUT_TYPE = 'output-node';
export const SCOPE_TYPE = 'scope-node';

export type Role = 'instrument' | 'output' | 'processor';

export function roleOf(node: AppNode, definitions: SignalDefinitions): Role {
  const category = definitions[node.type]?.category;
  if (category === 'Instruments') return 'instrument';
  if (category === 'Output') return 'output';
  return 'processor';
}

export function isProbe(node: AppNode): boolean {
  return node.type === SCOPE_TYPE;
}

export const REFUSAL = {
  loop: 'That would create a loop.',
  intoInstrument: 'Instruments are sources and have no input.',
  outOfOutput: 'Nothing can be wired out of the Output.',
  duplicate: 'These are already connected.',
} as const;

export function wouldCreateCycle(
  edges: Edge[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;
  const visited = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) {
      if (edge.source === current) stack.push(edge.target);
    }
  }
  return false;
}

/**
 * Instruments have no input handle and the Output has no output handle, so a
 * wire dropped on their body never reaches a handle. Explain why it didn't connect.
 */
export function dropRefusal(
  droppedOn: AppNode,
  fromHandleType: 'source' | 'target',
  definitions: SignalDefinitions,
): string | null {
  const role = roleOf(droppedOn, definitions);
  if (fromHandleType === 'source' && role === 'instrument')
    return REFUSAL.intoInstrument;
  if (fromHandleType === 'target' && role === 'output')
    return REFUSAL.outOfOutput;
  return null;
}

export type ConnectionCheck = { ok: true } | { ok: false; reason: string };

export function checkConnection(
  nodes: AppNode[],
  edges: Edge[],
  connection: { source: string; target: string },
  definitions: SignalDefinitions,
): ConnectionCheck {
  const { source, target } = connection;
  if (wouldCreateCycle(edges, source, target))
    return { ok: false, reason: REFUSAL.loop };
  const byId = (id: string) => nodes.find((node) => node.id === id);
  const from = byId(source);
  const to = byId(target);
  if (from && roleOf(from, definitions) === 'output')
    return { ok: false, reason: REFUSAL.outOfOutput };
  if (to && roleOf(to, definitions) === 'instrument')
    return { ok: false, reason: REFUSAL.intoInstrument };
  if (edges.some((edge) => edge.source === source && edge.target === target))
    return { ok: false, reason: REFUSAL.duplicate };
  return { ok: true };
}
