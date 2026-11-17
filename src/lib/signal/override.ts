import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { portOf, roleOf, type SignalDefinitions } from './graph';

/** Calls that compose (apply on top of each other) rather than overwrite. */
export const COMPOSING_CALLS = new Set([
  'fast',
  'slow',
  'rev',
  'palindrome',
  'late',
  'early',
  'analyze',
  'stack',
  'mul',
  'superimpose',
  'echoWith',
]);

const INPUT_SENTINEL = '__in__';
const OPEN = '([{';
const CLOSE = ')]}';
const QUOTES = `'"\``;

export function topLevelCalls(code: string): string[] {
  const calls: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let identifier = '';
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (QUOTES.includes(char)) {
      quote = char;
      identifier = '';
    } else if (OPEN.includes(char)) {
      if (char === '(' && depth === 0 && identifier) calls.push(identifier);
      depth++;
      identifier = '';
    } else if (CLOSE.includes(char)) {
      depth = Math.max(0, depth - 1);
      identifier = '';
    } else if (/[\w$]/.test(char)) {
      identifier += char;
    } else {
      identifier = '';
    }
  }
  return calls;
}

/** Calls a processor's code sets on top of its input, read from its code. */
function callsOf(
  node: AppNode,
  definitions: SignalDefinitions,
  data: Record<string, unknown> = node.data,
): string[] {
  const definition = definitions[node.type];
  if (!definition || roleOf(node, definitions) !== 'processor') return [];
  try {
    const code = definition.generatePattern(data, INPUT_SENTINEL);
    if (!code.startsWith(INPUT_SENTINEL)) return [];
    return topLevelCalls(code.slice(INPUT_SENTINEL.length)).filter(
      (call) => !COMPOSING_CALLS.has(call),
    );
  } catch {
    return [];
  }
}

type Control = { call: string; label: string };

/** Controls a node sets that something downstream could replace. */
function carried(node: AppNode, definitions: SignalDefinitions): Control[] {
  if (roleOf(node, definitions) !== 'processor') return [];
  const rules = definitions[node.type]?.overrides;
  if (rules) return rules.carries(node.data);
  return callsOf(node, definitions).map((call) => ({ call, label: call }));
}

/**
 * Every call the node's knobs can produce, including ones left out at their
 * defaults (a Level at centre pan still has a pan knob).
 */
function possibleCalls(
  node: AppNode,
  definitions: SignalDefinitions,
): Set<string> {
  const definition = definitions[node.type];
  const rules = definition?.overrides;
  if (rules) return new Set(rules.carries(node.data).map(({ call }) => call));
  const calls = new Set(callsOf(node, definitions));
  const { parameters = {}, updateValues } = definition ?? {};
  const knobs = Object.entries(parameters).flatMap(([key, parameter]) =>
    parameter.control === 'knob'
      ? [[key, parameter.min + (parameter.max - parameter.min) * 0.37]]
      : [],
  );
  if (knobs.length && updateValues) {
    const moved = {
      ...node.data,
      ...updateValues(node.data, Object.fromEntries(knobs)),
    };
    for (const call of callsOf(node, definitions, moved)) calls.add(call);
  }
  return calls;
}

/** Calls a node replaces on what arrives at `port`. */
function replaced(
  node: AppNode,
  port: string | null,
  definitions: SignalDefinitions,
): string[] {
  const rules = definitions[node.type]?.overrides;
  return rules ? rules.replaces(node.data, port) : callsOf(node, definitions);
}

/** "Pan, gain overridden by Mixer downstream, postgain overridden by Level downstream". */
function describe(found: { label: string; by: string }[]): string {
  const groups = new Map<string, string[]>();
  for (const { label, by } of found)
    groups.set(by, [...(groups.get(by) ?? []), label.toLowerCase()]);
  const text = [...groups]
    .map(
      ([by, labels]) => `${labels.join(', ')} overridden by ${by} downstream`,
    )
    .join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Badge text for every heard node whose controls are replaced downstream on
 * every path to the Output: the full copy when every knob it has is replaced
 * by one node; otherwise the replaced controls by name.
 */
export function findOverrides(
  nodes: AppNode[],
  edges: Edge[],
  definitions: SignalDefinitions,
): Map<string, string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const titleOf = (node: AppNode) =>
    String(node.data.title ?? definitions[node.type]?.title ?? node.type);
  const portInto = (edge: Edge, node: AppNode) => {
    const ports = definitions[node.type]?.ports;
    return ports?.length ? portOf(edge, ports) : null;
  };

  const heard = new Set<string>();
  const pending = nodes
    .filter((node) => roleOf(node, definitions) === 'output')
    .map((node) => node.id);
  while (pending.length) {
    const id = pending.pop()!;
    if (heard.has(id)) continue;
    heard.add(id);
    for (const edge of edges) if (edge.target === id) pending.push(edge.source);
  }

  /** Who replaces `call` on every path from `start`, or null if one escapes. */
  const replacer = (start: string, call: string): string | null => {
    let escapes = false;
    let by: string | null = null;
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const edge of edges) {
        if (edge.source !== id) continue;
        const next = byId.get(edge.target);
        if (!next || !heard.has(next.id)) continue;
        if (roleOf(next, definitions) === 'output') {
          escapes = true;
          continue;
        }
        if (replaced(next, portInto(edge, next), definitions).includes(call)) {
          by ??= titleOf(next);
          continue;
        }
        walk(next.id);
      }
    };
    walk(start);
    return escapes ? null : by;
  };

  const overrides = new Map<string, string>();
  for (const node of nodes) {
    if (!heard.has(node.id)) continue;
    const own = carried(node, definitions);
    const found = own.flatMap(({ call, label }) => {
      const by = replacer(node.id, call);
      return by ? [{ call, label, by }] : [];
    });
    if (found.length === 0) continue;
    const possible = possibleCalls(node, definitions);
    const everyOneBySame =
      [...possible].every((call) => found.some((f) => f.call === call)) &&
      found.every(({ by }) => by === found[0].by);
    overrides.set(
      node.id,
      everyOneBySame
        ? `Overridden by ${found[0].by} downstream`
        : describe(found),
    );
  }
  return overrides;
}
