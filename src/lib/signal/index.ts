import type { Edge } from '@xyflow/react';
import {
  createNodeByType,
  nodeDefinitions,
  type AppNode,
} from '@/components/nodes/registry';
import type { GraphSnapshot } from '@/lib/graph-history';
import { compilePatch, type CompiledPatch } from './compile';
import {
  checkConnection,
  dropRefusal,
  roleOf,
  OUTPUT_TYPE,
  type ConnectionCheck,
} from './graph';
import { migrateGraph } from './migrate';
import { findOverrides } from './override';
import {
  audibility,
  isNotHeard as notHeard,
  type Audibility,
} from './audibility';
import { instrumentsFeeding as feeding } from './sources';

export type { CompiledPatch } from './compile';
export { MIGRATION_NOTICE } from './migrate';
export { colourOf } from './sources';

export function compile(
  nodes: AppNode[],
  edges: Edge[],
  cpm: string,
  bpc: string,
): CompiledPatch {
  return compilePatch(nodes, edges, { cpm, bpc }, nodeDefinitions);
}

export function check(
  nodes: AppNode[],
  edges: Edge[],
  connection: { source: string; target: string },
): ConnectionCheck {
  return checkConnection(nodes, edges, connection, nodeDefinitions);
}

export function refuseDrop(
  droppedOn: AppNode,
  fromHandleType: 'source' | 'target',
): string | null {
  return dropRefusal(droppedOn, fromHandleType, nodeDefinitions);
}

let lastOverrides: {
  nodes: AppNode[];
  edges: Edge[];
  result: Map<string, string>;
} | null = null;

export function overriddenBy(
  nodes: AppNode[],
  edges: Edge[],
  nodeId: string,
): string | null {
  if (lastOverrides?.nodes !== nodes || lastOverrides.edges !== edges) {
    lastOverrides = {
      nodes,
      edges,
      result: findOverrides(nodes, edges, nodeDefinitions),
    };
  }
  return lastOverrides.result.get(nodeId) ?? null;
}

export function migrate(graph: GraphSnapshot): {
  graph: GraphSnapshot;
  migrated: boolean;
} {
  return migrateGraph(graph, nodeDefinitions, (position) =>
    createNodeByType({ type: OUTPUT_TYPE, position }),
  );
}

export function instrumentsFeeding(
  nodeId: string,
  port: string | null,
  nodes: AppNode[],
  edges: Edge[],
): AppNode[] {
  return feeding(nodeId, port, nodes, edges, nodeDefinitions);
}

export function isInstrument(node: AppNode): boolean {
  return roleOf(node, nodeDefinitions) === 'instrument';
}

let lastAudibility: {
  nodes: AppNode[];
  edges: Edge[];
  result: Audibility;
} | null = null;

export function audibilityOf(nodes: AppNode[], edges: Edge[]): Audibility {
  if (lastAudibility?.nodes !== nodes || lastAudibility.edges !== edges) {
    lastAudibility = {
      nodes,
      edges,
      result: audibility(nodes, edges, nodeDefinitions),
    };
  }
  return lastAudibility.result;
}

export function isNotHeard(
  node: AppNode,
  nodes: AppNode[],
  edges: Edge[],
): boolean {
  return notHeard(node, audibilityOf(nodes, edges), nodeDefinitions);
}
