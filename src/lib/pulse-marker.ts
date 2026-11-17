/** Global function the engine code calls for every note: see pulse-bus.ts. */
export const PULSE_HOOK = 'flowPulse';

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
