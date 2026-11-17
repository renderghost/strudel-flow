import { defineNode } from '../define-node';
import { OutputNode } from './output-node';

export default defineNode({
  id: 'output-node',
  title: 'Output',
  category: 'Output',
  icon: 'Volume2',
  order: 0,
  parameters: {},
  component: OutputNode,
  generate: (_values, input) => input,
});
