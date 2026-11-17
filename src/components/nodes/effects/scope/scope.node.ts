import { defineNode } from '../../define-node';
import { ScopeNode } from './scope-node';
import type { ScopeData } from './scope';

export default defineNode({
  id: 'scope-node',
  title: 'Scope',
  category: 'Utility',
  icon: 'Activity',
  order: 0,
  parameters: {},
  defaults: {} as ScopeData,
  component: ScopeNode,
  // A Scope is a probe: it passes sound through unchanged. The compiler adds
  // its silent tap to the engine code.
  generate: (_values, input) => input,
});
