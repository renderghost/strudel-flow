import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import {
  scopeIdForNode,
  TAP_CONTROL,
} from '@/components/nodes/effects/scope/scope';
import { isProbe, roleOf, OUTPUT_TYPE, type SignalDefinitions } from './graph';

/**
 * `portable` is what plays and what people copy. `engine` adds one silent tap
 * per Scope so each Scope can show the signal at its own position.
 */
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
          result = isProbe(node)
            ? input
            : definition.generatePattern(node.data, input).trim() || null;
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
  const taps = nodes
    .filter(isProbe)
    .map((node) => ({ id: node.id, input: expression(node.id) }))
    .filter((tap): tap is { id: string; input: string } => tap.input !== null)
    .map(
      ({ id, input }) =>
        `$: ${input}.analyze(${JSON.stringify(scopeIdForNode(id))}).${TAP_CONTROL}(1)`,
    );

  const bpm = parseInt(tempo.cpm) || 120;
  const beatsPerCycle = parseInt(tempo.bpc) || 4;
  const program = (body: string[]) =>
    body.length ? `setcpm(${bpm}/${beatsPerCycle})\n${body.join('\n')}` : '';
  return { engine: program([...lines, ...taps]), portable: program(lines) };
}
