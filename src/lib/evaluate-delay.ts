/**
 * How long to wait before re-evaluating after an edit: a short debounce, but
 * never more than `maxWait` since the first unapplied change, so dragging a
 * fader is heard about ten times a second.
 */
export function evaluateDelay(
  pendingSince: number,
  now: number,
  debounce = 40,
  maxWait = 100,
): number {
  return Math.max(0, Math.min(debounce, pendingSince + maxWait - now));
}
