import { defineNode } from '../../define-node';
import { echoSpec } from './echo';
import { EchoNode } from './echo-node';

export default defineNode({ ...echoSpec, component: EchoNode });
