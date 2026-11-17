import { useCallback, useEffect, useRef, useState } from 'react';
import { meterIdFor } from '@/components/nodes/effects/scope/scope';
import { readAnalyser } from '@/lib/strudel-scope';
import {
  QUIET,
  meterPosition,
  meterStep,
  peakDb,
  type MeterState,
} from './meter';

export type Painter = { lit: HTMLElement | null; hold: HTMLElement | null };

function paint(painter: Painter | undefined, state: MeterState) {
  if (!painter?.lit || !painter.hold) return;
  painter.lit.style.clipPath = `inset(${(1 - meterPosition(state.level)) * 100}% 0 0 0)`;
  const hold = meterPosition(state.hold);
  painter.hold.style.bottom = `${hold * 100}%`;
  painter.hold.style.opacity = hold > 0 ? '1' : '0';
}

/**
 * Drives every meter on one node from a single animation frame loop, writing
 * straight to the DOM. Clip lights latch until cleared, and Stop clears them.
 */
export function useMeters(
  nodeId: string,
  keys: readonly string[],
  playing: boolean,
) {
  const painters = useRef(new Map<string, Painter>());
  const states = useRef(new Map<string, MeterState>());
  const [clipped, setClipped] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    states.current.clear();
    setClipped(new Set());
    for (const key of keys) paint(painters.current.get(key), QUIET);
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const newlyClipped: string[] = [];
      for (const key of keys) {
        const before = states.current.get(key) ?? QUIET;
        const peak = peakDb(readAnalyser(meterIdFor(nodeId, key)));
        const after = meterStep(before, peak, seconds);
        if (after.clip && !before.clip) newlyClipped.push(key);
        states.current.set(key, after);
        paint(painters.current.get(key), after);
      }
      if (newlyClipped.length)
        setClipped((current) => new Set([...current, ...newlyClipped]));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [nodeId, keys, playing]);

  const clear = useCallback((key: string) => {
    const state = states.current.get(key);
    if (state) states.current.set(key, { ...state, clip: false });
    setClipped((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);

  const register = useCallback(
    (key: string, part: keyof Painter) => (element: HTMLElement | null) => {
      const painter = painters.current.get(key) ?? { lit: null, hold: null };
      painter[part] = element;
      painters.current.set(key, painter);
    },
    [],
  );

  return { clipped, clear, register };
}
