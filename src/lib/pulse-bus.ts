import { edgeOfMarker } from './pulse-marker';

type Listener = (intensity: number) => void;

/** Routes note pulses to the wire components listening for them. */
export function createPulseBus() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    subscribe(edgeId: string, listener: Listener) {
      const set = listeners.get(edgeId) ?? new Set();
      set.add(listener);
      listeners.set(edgeId, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(edgeId);
      };
    },
    emit(edgeId: string, intensity: number, delayMs: number) {
      setTimeout(() => {
        listeners.get(edgeId)?.forEach((listener) => listener(intensity));
      }, delayMs);
    },
  };
}

export type PulseBus = ReturnType<typeof createPulseBus>;

const DEFAULT_GAIN = 0.8;

/**
 * Strudel `onTrigger` callback: when a note is scheduled, pulse every wire it
 * passed through, at the moment it sounds, brighter for louder notes.
 */
export function pulseHook(bus: PulseBus) {
  return (
    time: number,
    hap: { value: Record<string, unknown> },
    now: number,
    _cps?: number,
    targetTime?: number,
  ) => {
    const { gain, velocity } = hap.value;
    const loudness =
      (Number(gain ?? DEFAULT_GAIN) * Number(velocity ?? 1)) / DEFAULT_GAIN;
    const intensity = Number.isFinite(loudness)
      ? Math.min(1, Math.max(0, loudness))
      : 1;
    // `time` is the scheduler tick plus its deadline; `targetTime` is when the
    // note actually sounds, so pulses line up with what you hear.
    const delay = Math.max(0, (targetTime ?? time) - now) * 1000;
    for (const key of Object.keys(hap.value)) {
      const edgeId = edgeOfMarker(key);
      if (edgeId !== null) bus.emit(edgeId, intensity, delay);
    }
  };
}

/** The app-wide bus; the engine's `flowPulse` global feeds it. */
export const pulses = createPulseBus();
