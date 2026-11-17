export const WIRE_ARROW_ID = 'flow-wire-arrow';

/** One arrowhead shared by every wire, so wires show which way sound flows. */
export function WireMarkers() {
  return (
    <svg aria-hidden="true" className="absolute size-0">
      <defs>
        <marker
          id={WIRE_ARROW_ID}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: 'var(--primary)' }} />
        </marker>
      </defs>
    </svg>
  );
}
