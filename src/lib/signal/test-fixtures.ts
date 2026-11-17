import type { Edge } from '@xyflow/react';
import { defineNode } from '@/components/nodes/define-node';
import type { AppNode } from '@/components/nodes/types';
import lpf from '@/components/nodes/effects/lpf.node';
import time from '@/components/nodes/effects/time.node';
import type { SignalDefinitions } from './graph';

const inst = defineNode({
  id: 'inst',
  title: 'Inst',
  category: 'Instruments',
  icon: 'Music',
  parameters: { notes: { control: 'text', label: 'Notes', default: 'c' } },
  generate: ({ notes }) => `note("${notes}")`,
});

const fx = defineNode({
  id: 'fx',
  title: 'Fx',
  category: 'Audio Effects',
  icon: 'Zap',
  parameters: {
    amount: {
      control: 'knob',
      label: 'Amount',
      default: 1,
      min: 0,
      max: 10,
      step: 1,
    },
  },
  generate: ({ amount }, input) => (input ? `${input}.fx(${amount})` : ''),
});

const scope = defineNode({
  id: 'scope-node',
  title: 'Scope',
  category: 'Audio Effects',
  icon: 'Activity',
  parameters: {},
  generate: (_values, input) => input,
});

// Stand-in for the real Output, whose component loads the audio engine.
const output = defineNode({
  id: 'output-node',
  title: 'Output',
  category: 'Output',
  icon: 'Volume2',
  parameters: {},
  generate: (_values, input) => input,
});

export const definitions: SignalDefinitions = {
  inst,
  fx,
  lpf,
  time,
  'scope-node': scope,
  'output-node': output,
};

export function node(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): AppNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

export function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

export const A = node('a', 'inst', { notes: 'c' });
export const B = node('b', 'inst', { notes: 'e' });
export const F = node('f', 'fx', { amount: '2' });
export const G = node('g', 'fx', { amount: '3' });
export const O = node('o', 'output-node');
