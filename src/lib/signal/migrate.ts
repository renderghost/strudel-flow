import type { Edge, XYPosition } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import type { GraphSnapshot } from '@/lib/graph-history';
import {
  assignPort,
  isProbe,
  portOf,
  roleOf,
  wouldCreateCycle,
  type SignalDefinitions,
} from './graph';

export const MIGRATION_NOTICE =
  'This patch was updated for directed wiring and may sound different.';

const OUTPUT_OFFSET_X = 600;

function reversed(edge: Edge): Edge {
  return {
    ...edge,
    id: `${edge.target}-${edge.source}`,
    source: edge.target,
    target: edge.source,
    sourceHandle: edge.targetHandle,
    targetHandle: edge.sourceHandle,
  };
}

export function migrateGraph(
  graph: GraphSnapshot,
  definitions: SignalDefinitions,
  createOutput: (position: XYPosition) => AppNode,
): { graph: GraphSnapshot; migrated: boolean } {
  const role = (node: AppNode) => roleOf(node, definitions);

  const outputs = graph.nodes.filter((node) => role(node) === 'output');
  const outputWasMissing = outputs.length === 0;
  const droppedOutputs = new Set(outputs.slice(1).map((node) => node.id));
  let nodes = graph.nodes.filter((node) => !droppedOutputs.has(node.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));

  // 1. Normalise edge direction and drop invalid edges.
  const seen = new Set<string>();
  const normalised: Edge[] = [];
  for (const original of graph.edges) {
    let edge = original;
    const from = byId.get(edge.source);
    const to = byId.get(edge.target);
    if (!from || !to || edge.source === edge.target) continue;
    if (role(from) === 'output') continue;
    if (role(to) === 'instrument') {
      if (role(from) === 'instrument') continue;
      edge = reversed(edge);
    }
    edge = assignPort(edge, nodes, normalised, definitions);
    const target = byId.get(edge.target)!;
    const ports = definitions[target.type]?.ports;
    const port = ports?.length ? portOf(edge, ports) : '';
    const key = `${edge.source}>${edge.target}>${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalised.push(edge);
  }

  // 2. Break cycles, keeping earlier edges.
  const edges: Edge[] = [];
  for (const edge of normalised) {
    if (!wouldCreateCycle(edges, edge.source, edge.target)) edges.push(edge);
  }

  // 3. Ensure exactly one Output; wire sinks into a new one.
  let output = nodes.find((node) => role(node) === 'output');
  if (!output) {
    const position = nodes.length
      ? {
          x:
            Math.max(...nodes.map((node) => node.position.x)) + OUTPUT_OFFSET_X,
          y:
            nodes.reduce((sum, node) => sum + node.position.y, 0) /
            nodes.length,
        }
      : { x: 0, y: 0 };
    output = createOutput(position);
    const outputId = output.id;
    const feedsChain = (node: AppNode) =>
      edges.some((edge) => {
        const target = byId.get(edge.target);
        return edge.source === node.id && target && !isProbe(target);
      });
    const sinks = nodes.filter((node) => !isProbe(node) && !feedsChain(node));
    nodes = [...nodes, output];
    for (const sink of sinks) {
      edges.push({
        id: `${sink.id}-${outputId}`,
        source: sink.id,
        target: outputId,
        type: 'default',
      });
    }
  }

  // 4. Protect the Output; mute state only applies to instruments.
  const outputId = output.id;
  nodes = nodes.map((node) => {
    if (node.id === outputId) return { ...node, deletable: false };
    if (role(node) !== 'instrument' && node.data.state === 'paused') {
      return { ...node, data: { ...node.data, state: 'running' } };
    }
    return node;
  });

  return {
    graph: { nodes, edges },
    migrated: outputWasMissing && graph.nodes.length > 0,
  };
}
