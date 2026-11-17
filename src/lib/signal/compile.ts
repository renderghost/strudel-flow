import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import {
  scopeIdForNode,
  TAP_CONTROL,
} from '@/components/nodes/effects/scope/scope';
import { MARK_METHOD, markerFor, PULSE_HOOK } from '@/lib/pulse-marker';
import { isProbe, roleOf, OUTPUT_TYPE, type SignalDefinitions } from './graph';

/**
 * `portable` is what plays and what people copy. `engine` plays the same notes
 * and adds editor plumbing: per-wire note markers with a trigger hook, so wires
 * can pulse, and one silent tap per Scope so each Scope shows its own position.
 */
export type CompiledPatch = { engine: string; portable: string };

export function compilePatch(
  nodes: AppNode[],
  edges: Edge[],
  tempo: { cpm: string; bpc: string },
  definitions: SignalDefinitions,
): CompiledPatch {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  /**
   * Resolves each node's expression. With `marked`, every wire a note crosses
   * tags it with an inert marker control so the editor can pulse that wire.
   */
  const walker = (marked: boolean) => {
    const memo = new Map<string, string | null>();
    const resolving = new Set<string>();
    const through = (edge: Edge): string | null => {
      const input = expression(edge.source);
      return input && marked
        ? `${input}.${MARK_METHOD}('${markerFor(edge.id)}')`
        : input;
    };
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
            .map(through)
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
    return { expression, through };
  };

  const plain = walker(false);
  const marked = walker(true);
  const output = nodes.find((node) => node.type === OUTPUT_TYPE);
  const intoOutput = output
    ? edges.filter((edge) => edge.target === output.id)
    : [];
  const lines = intoOutput
    .map(plain.through)
    .filter((line): line is string => line !== null)
    .map((line) => `$: ${line}`);
  const markedLines = intoOutput
    .map(marked.through)
    .filter((line): line is string => line !== null)
    .map((line) => `$: ${line}.onTrigger(${PULSE_HOOK}, false)`);
  const expression = plain.expression;

  const taps = nodes
    .filter(isProbe)
    .map((node) => ({ id: node.id, input: expression(node.id) }))
    .filter((tap): tap is { id: string; input: string } => tap.input !== null)
    .map(
      ({ id, input }) =>
        `$: (() => { try { return ${input}; } catch { return silence; } })()` +
        `.analyze(${JSON.stringify(scopeIdForNode(id))}).${TAP_CONTROL}(1)`,
    );

  const bpm = parseInt(tempo.cpm) || 120;
  const beatsPerCycle = parseInt(tempo.bpc) || 4;
  const program = (body: string[]) =>
    body.length ? `setcpm(${bpm}/${beatsPerCycle})\n${body.join('\n')}` : '';
  return {
    engine: program([...markedLines, ...taps]),
    portable: program(lines),
  };
}
