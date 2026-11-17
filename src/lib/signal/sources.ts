import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { SWATCH_COUNT } from '@/lib/instrument-colours';
import { roleOf, type SignalDefinitions } from './graph';

/** The instrument's swatch index (0-based), or null for no colour. */
export function colourOf(node: AppNode): number | null {
  const raw = node.data.colour;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value < SWATCH_COUNT
    ? value
    : null;
}

/**
 * Every instrument whose sound reaches `nodeId` (through `port` only, when
 * given), in first-found order. Muted instruments count: colour is identity.
 */
export function instrumentsFeeding(
  nodeId: string,
  port: string | null,
  nodes: AppNode[],
  edges: Edge[],
  definitions: SignalDefinitions,
): AppNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const found: AppNode[] = [];
  const seen = new Set<string>([nodeId]);
  const queue = edges
    .filter(
      (edge) =>
        edge.target === nodeId && (port === null || edge.targetHandle === port),
    )
    .map((edge) => edge.source);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    if (roleOf(node, definitions) === 'instrument') found.push(node);
    for (const edge of edges) if (edge.target === id) queue.push(edge.source);
  }
  return found;
}
