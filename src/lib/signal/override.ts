import type { Edge } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { roleOf, type SignalDefinitions } from './graph';

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

function controlsOf(node: AppNode, definitions: SignalDefinitions): string[] {
  const definition = definitions[node.type];
  if (!definition || roleOf(node, definitions) !== 'processor') return [];
  try {
    const code = definition.generatePattern(node.data, INPUT_SENTINEL);
    if (!code.startsWith(INPUT_SENTINEL)) return [];
    return topLevelCalls(code.slice(INPUT_SENTINEL.length)).filter(
      (call) => !COMPOSING_CALLS.has(call),
    );
  } catch {
    return [];
  }
}

export function findOverrides(
  nodes: AppNode[],
  edges: Edge[],
  definitions: SignalDefinitions,
): Map<string, string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const controls = new Map(
    nodes.map((node) => [node.id, controlsOf(node, definitions)]),
  );
  const successors = (id: string) =>
    edges
      .filter((edge) => edge.source === id)
      .map((edge) => byId.get(edge.target))
      .filter((node): node is AppNode => node !== undefined);
  const titleOf = (node: AppNode) =>
    String(node.data.title ?? definitions[node.type]?.title ?? node.type);

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

  const overrides = new Map<string, string>();
  for (const node of nodes) {
    const own = controls.get(node.id)!;
    if (own.length === 0 || !heard.has(node.id)) continue;
    let escapes = false;
    let overriddenBy: string | null = null;
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const next of successors(id)) {
        if (!heard.has(next.id)) continue;
        if (roleOf(next, definitions) === 'output') {
          escapes = true;
          continue;
        }
        const theirs = controls.get(next.id)!;
        if (own.every((call) => theirs.includes(call))) {
          overriddenBy ??= titleOf(next);
          continue;
        }
        walk(next.id);
      }
    };
    walk(node.id);
    if (!escapes && overriddenBy) overrides.set(node.id, overriddenBy);
  }
  return overrides;
}
