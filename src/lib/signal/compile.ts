import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { DEFAULT_TEMPO, type Tempo } from '@/components/nodes/define-node';
import {
  meterIdFor,
  scopeIdForNode,
  TAP_CONTROL,
} from '@/components/nodes/effects/scope/scope';
import {
  isProbe,
  portOf,
  roleOf,
  OUTPUT_TYPE,
  type SignalDefinitions,
} from './graph';

const merge = (inputs: string[]) =>
  inputs.length === 1 ? inputs[0] : `stack(${inputs.join(', ')})`;

/** Meter windows are short (2^(6+5) samples ≈ 46 ms) so levels track notes. */
const METER_FFT = 6;

const tap = (input: string, analyserId: string, fft?: number) =>
  `$: (() => { try { return ${input}; } catch { return silence; } })()` +
  `.analyze(${JSON.stringify(analyserId)})` +
  (fft === undefined ? '' : `.fft(${fft})`) +
  `.${TAP_CONTROL}(1)`;

/**
 * `portable` is what plays and what people copy. `engine` adds one silent tap
 * per Scope and per meter so each can show the signal at its own position.
 */
export type CompiledPatch = { engine: string; portable: string };

type Inputs = { input: string; inputs: Record<string, string> };

/** Resolves each node's expression from the wires feeding it. */
function walker(
  nodes: AppNode[],
  edges: Edge[],
  definitions: SignalDefinitions,
  tempo: Tempo = DEFAULT_TEMPO,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const memo = new Map<string, string | null>();
  const resolving = new Set<string>();

  const through = (edge: Edge): string | null => expression(edge.source);

  /** What arrives at a node: everything merged, and per port. */
  const inputsOf = (id: string): Inputs | null => {
    const node = byId.get(id);
    const ports = (node && definitions[node.type]?.ports) || [];
    const wired = edges
      .filter((edge) => edge.target === id)
      .map((edge) => ({ edge, input: through(edge) }))
      .filter(
        (item): item is { edge: Edge; input: string } => item.input !== null,
      );
    if (wired.length === 0) return null;
    const inputs = Object.fromEntries(
      ports.map((port) => {
        const here = wired
          .filter((item) => portOf(item.edge, ports) === port)
          .map((item) => item.input);
        return [port, here.length ? merge(here) : ''];
      }),
    );
    return { input: merge(wired.map((item) => item.input)), inputs };
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
        const arriving = inputsOf(id);
        if (arriving) {
          result = isProbe(node)
            ? arriving.input
            : definition
                .generatePattern(
                  node.data,
                  arriving.input,
                  arriving.inputs,
                  tempo,
                )
                .trim() || null;
        }
      }
    } finally {
      resolving.delete(id);
    }
    memo.set(id, result);
    return result;
  };
  return { expression, through, inputsOf };
}

/** The tempo fields as stored (strings) → numbers, with the usual defaults. */
export function parseTempo(cpm: string, bpc: string): Tempo {
  return {
    bpm: parseInt(cpm) || DEFAULT_TEMPO.bpm,
    bpc: parseInt(bpc) || DEFAULT_TEMPO.bpc,
  };
}

/** The code at a node's output, or null when nothing plays there. */
export function expressionAt(
  nodes: AppNode[],
  edges: Edge[],
  nodeId: string,
  definitions: SignalDefinitions,
  tempo?: Tempo,
): string | null {
  return walker(nodes, edges, definitions, tempo).expression(nodeId);
}

export function compilePatch(
  nodes: AppNode[],
  edges: Edge[],
  tempo: { cpm: string; bpc: string },
  definitions: SignalDefinitions,
): CompiledPatch {
  const { bpm, bpc: beatsPerCycle } = parseTempo(tempo.cpm, tempo.bpc);
  const { expression, through, inputsOf } = walker(nodes, edges, definitions, {
    bpm,
    bpc: beatsPerCycle,
  });
  const output = nodes.find((node) => node.type === OUTPUT_TYPE);
  const intoOutput = output
    ? edges.filter((edge) => edge.target === output.id)
    : [];
  const lines = intoOutput
    .map(through)
    .filter((line): line is string => line !== null)
    .map((line) => `$: ${line}`);

  const scopeTaps = nodes
    .filter(isProbe)
    .map((node) => ({ id: node.id, input: expression(node.id) }))
    .filter((probe): probe is { id: string; input: string } => !!probe.input)
    .map(({ id, input }) => tap(input, scopeIdForNode(id)));

  const meterTaps = nodes.flatMap((node) => {
    const meters = definitions[node.type]?.meters;
    const arriving = meters && inputsOf(node.id);
    if (!meters || !arriving) return [];
    return Object.entries(meters(node.data, arriving.inputs))
      .filter(([, code]) => code.trim())
      .map(([key, code]) => tap(code, meterIdFor(node.id, key), METER_FFT));
  });

  const program = (body: string[]) =>
    body.length ? `setcpm(${bpm}/${beatsPerCycle})\n${body.join('\n')}` : '';
  return {
    engine: program([...lines, ...scopeTaps, ...meterTaps]),
    portable: program(lines),
  };
}
