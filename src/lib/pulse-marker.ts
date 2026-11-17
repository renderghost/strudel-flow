/** Global function the engine code calls for every note: see pulse-bus.ts. */
export const PULSE_HOOK = 'flowPulse';

/** Pattern method the engine code calls to tag notes (registered in the runner). */
export const MARK_METHOD = 'flowMark';

const PREFIX = 'fe_';

/**
 * A per-wire marker control name that is always a plain JS identifier, so the
 * Strudel transpiler leaves it alone: letters and digits stay, every other
 * character becomes `_<char code>_`.
 */
export function markerFor(edgeId: string): string {
  return (
    PREFIX +
    edgeId.replace(/[^A-Za-z0-9]/g, (char) => `_${char.charCodeAt(0)}_`)
  );
}

export function edgeOfMarker(marker: string): string | null {
  if (!marker.startsWith(PREFIX)) return null;
  return marker
    .slice(PREFIX.length)
    .replace(/_(\d+)_/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    );
}

/**
 * Tags a note with a wire marker. Only notes that are already control objects
 * are tagged: a bare value like "c" must stay bare, so it fails exactly as it
 * would in strudel.cc instead of turning into a default note.
 */
export function markValue(value: unknown, marker: string): unknown {
  return value !== null && typeof value === 'object'
    ? { ...value, [marker]: 1 }
    : value;
}
