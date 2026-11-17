import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { isProbe, portOf, roleOf, type SignalDefinitions } from './graph';

const PROBE_INPUT = '__in__';

export type Audibility = {
  /** Nodes whose sound reaches the Output from an unmuted instrument. */
  heard: Set<string>;
  /** Edges carrying sound that is heard. */
  live: Set<string>;
};

export function audibility(
  nodes: AppNode[],
  edges: Edge[],
  definitions: SignalDefinitions,
): Audibility {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const isMuted = (node: AppNode) => node.data.state === 'paused';
  // Mirrors compile: an instrument whose pattern is empty plays nothing.
  const plays = (node: AppNode) => {
    try {
      return Boolean(
        definitions[node.type]?.generatePattern(node.data, '').trim(),
      );
    } catch {
      return false;
    }
  };

  // A wire into a port-aware node (a mixer) only carries sound when that
  // port plays: not muted, soloed out or at −∞.
  const passes = new Map<string, boolean>();
  const carries = (edge: Edge) => {
    const target = byId.get(edge.target);
    const ports = target && definitions[target.type]?.ports;
    if (!target || !ports?.length) return true;
    const port = portOf(edge, ports);
    const key = `${target.id}>${port}`;
    if (!passes.has(key)) {
      const inputs = Object.fromEntries(
        ports.map((each) => [each, each === port ? PROBE_INPUT : '']),
      );
      let result = false;
      try {
        result = Boolean(
          definitions[target.type]
            .generatePattern(target.data, PROBE_INPUT, inputs)
            .trim(),
        );
      } catch {
        result = false;
      }
      passes.set(key, result);
    }
    return passes.get(key)!;
  };

  const fed = new Set<string>();
  const pending = nodes
    .filter(
      (node) =>
        roleOf(node, definitions) === 'instrument' &&
        !isMuted(node) &&
        plays(node),
    )
    .map((node) => node.id);
  while (pending.length) {
    const id = pending.pop()!;
    if (fed.has(id) || !byId.has(id)) continue;
    fed.add(id);
    for (const edge of edges)
      if (edge.source === id && carries(edge)) pending.push(edge.target);
  }

  const reaches = new Set<string>();
  const back = nodes
    .filter((node) => roleOf(node, definitions) === 'output')
    .map((node) => node.id);
  while (back.length) {
    const id = back.pop()!;
    if (reaches.has(id) || !byId.has(id)) continue;
    reaches.add(id);
    for (const edge of edges)
      if (edge.target === id && carries(edge)) back.push(edge.source);
  }

  const heard = new Set(
    nodes
      .filter(
        (node) =>
          roleOf(node, definitions) === 'output' ||
          (fed.has(node.id) && reaches.has(node.id)),
      )
      .map((node) => node.id),
  );
  const live = new Set(
    edges
      .filter(
        (edge) =>
          fed.has(edge.source) && reaches.has(edge.target) && carries(edge),
      )
      .map((edge) => edge.id),
  );
  return { heard, live };
}

/**
 * Should this node show "Not heard"? Scopes are probes, the Output is always
 * heard, and muted instruments and mixers already say they're muted.
 */
export function isNotHeard(
  node: AppNode,
  { heard }: Audibility,
  definitions: SignalDefinitions,
): boolean {
  if (heard.has(node.id) || isProbe(node)) return false;
  const role = roleOf(node, definitions);
  if (role === 'output') return false;
  if (role === 'instrument' && node.data.state === 'paused') return false;
  if (definitions[node.type]?.mutable && node.data.muted === true) return false;
  return true;
}
