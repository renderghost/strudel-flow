/** Range and steps for a mixer knob or fader, in its own units. */
export type SliderRange = {
  min: number;
  max: number;
  /** Arrow keys and wheel notches. */
  step: number;
  /** With Shift held. */
  fine: number;
};

/** Rounds to the fine step and clamps, without floating-point noise. */
export function quantise(value: number, range: SliderRange): number {
  const stepped = Math.round(value / range.fine) * range.fine;
  return Number(Math.min(range.max, Math.max(range.min, stepped)).toFixed(6));
}

/** The value after a key press, or null when the key isn't ours. */
export function keyStep(
  value: number,
  key: string,
  shift: boolean,
  range: SliderRange,
): number | null {
  if (key === 'Home') return range.min;
  if (key === 'End') return range.max;
  const step = shift ? range.fine : range.step;
  const increments: Record<string, number> = {
    ArrowUp: step,
    ArrowRight: step,
    ArrowDown: -step,
    ArrowLeft: -step,
    PageUp: range.step * 10,
    PageDown: -range.step * 10,
  };
  if (!(key in increments)) return null;
  return quantise(value + increments[key], range);
}

/** Whole steps from a wheel delta (scrolling up raises), keeping the remainder. */
export function wheelSteps(
  rest: number,
  deltaY: number,
  notch = 100,
): { steps: number; rest: number } {
  const total = rest + deltaY;
  const steps = -Math.trunc(total / notch) + 0;
  return { steps, rest: total + steps * notch + 0 };
}
