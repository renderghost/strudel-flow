import { type ReactNode, type Ref } from 'react';

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

export const ButtonEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  className,
  pulseRef,
  children,
}: EdgeProps & {
  children: ReactNode;
  className?: string;
  /** Overlay path the wire flashes when a note passes through it. */
  pulseRef?: Ref<SVGPathElement>;
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        className={className}
      />
      {pulseRef && (
        <path
          ref={pulseRef}
          d={edgePath}
          className="flow-wire__pulse"
          fill="none"
          pointerEvents="none"
        />
      )}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {children}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
