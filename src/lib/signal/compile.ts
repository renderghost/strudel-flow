import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { scopeIdForNode } from '@/components/nodes/effects/scope/scope';
import { roleOf, OUTPUT_TYPE, type SignalDefinitions } from './graph';

export type CompiledPatch = { engine: string; portable: string };

export function compilePatch(
  nodes: AppNode[],
  edges: Edge[],
  tempo: { cpm: string; bpc: string },
  definitions: SignalDefinitions,
): CompiledPatch {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const memo = new Map<string, string | null>();
  const resolving = new Set<string>();

  const expression = (id: string): string | null => {
    if (memo.has(id)) return memo.get(id)!;
    if (resolving.has(id)) return null;
    const node = byId.get(id);
    const definition = node && definitions[node.type];
    if (!node || !definition) return null;
    resolving.add(id);
    let result: string | null = null;
    try {
      if (roleOf(node, definitions) === 'instrument') {
        if (node.data.state !== 'paused') {
          result = definition.generatePattern(node.data, '').trim() || null;
        }
      } else {
        const inputs = edges
          .filter((edge) => edge.target === id)
          .map((edge) => expression(edge.source))
          .filter((input): input is string => input !== null);
        if (inputs.length > 0) {
          const input =
            inputs.length === 1 ? inputs[0] : `stack(${inputs.join(', ')})`;
          result =
            definition
              .generatePattern(node.data, input, scopeIdForNode(id))
              .trim() || null;
        }
      }
    } finally {
      resolving.delete(id);
    }
    memo.set(id, result);
    return result;
  };

  const output = nodes.find((node) => node.type === OUTPUT_TYPE);
  const lines = output
    ? edges
        .filter((edge) => edge.target === output.id)
        .map((edge) => expression(edge.source))
        .filter((line): line is string => line !== null)
        .map((line) => `$: ${line}`)
    : [];
  if (lines.length === 0) return { engine: '', portable: '' };

  const bpm = parseInt(tempo.cpm) || 120;
  const beatsPerCycle = parseInt(tempo.bpc) || 4;
  const code = `setcpm(${bpm}/${beatsPerCycle})\n${lines.join('\n')}`;
  return { engine: code, portable: code };
}
