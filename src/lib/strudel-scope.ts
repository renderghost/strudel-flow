import {
  Pattern,
  analysers,
  getAnalyserById,
  getMasterOutput,
  registerControl,
} from '@strudel/web';
import { TAP_CONTROL } from '@/components/nodes/effects/scope/scope';

// `.scope()` in hand-written code only feeds an analyser; the nodes draw.
Pattern.prototype._scope = function ({ id = 1 } = {}) {
  return this.analyze(id);
};
Pattern.prototype._tscope = Pattern.prototype._scope;

// Makes `.flowtap(1)` available to compiled engine code (see pnpm-patches/).
registerControl(TAP_CONTROL);

export const MASTER_SCOPE_ID = 'flow-master';

const buffers = new WeakMap<AnalyserNode, Float32Array>();

/** Latest time-domain samples for an analyser, if the engine has created it. */
export function readAnalyser(id: string): Float32Array | undefined {
  const analyser = analysers[id];
  if (!analyser) return undefined;
  let buffer = buffers.get(analyser);
  if (!buffer || buffer.length !== analyser.fftSize) {
    buffer = new Float32Array(analyser.fftSize);
    buffers.set(analyser, buffer);
  }
  analyser.getFloatTimeDomainData(buffer);
  return buffer;
}

const connected = new WeakSet<AnalyserNode>();

/**
 * Feeds the master analyser from the engine's master output, reverb and delay
 * included. Safe to call every frame: superdough can replace its analysers, so
 * each new one is connected exactly once.
 */
export function ensureMasterAnalyser(
  deps: {
    getAnalyserById: (id: string, fftSize: number) => AnalyserNode;
    getMasterOutput: () => AudioNode | null;
  } = { getAnalyserById, getMasterOutput },
) {
  const master = deps.getMasterOutput();
  if (!master) return;
  const analyser = deps.getAnalyserById(MASTER_SCOPE_ID, 2 ** 13);
  if (connected.has(analyser)) return;
  master.connect(analyser);
  connected.add(analyser);
}
