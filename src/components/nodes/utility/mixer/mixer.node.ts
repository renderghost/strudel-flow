import { defineNode } from '../../define-node';
import { mixerSpec } from './mixer';
import { MixerNode } from './mixer-node';

export default defineNode({ ...mixerSpec, component: MixerNode });
