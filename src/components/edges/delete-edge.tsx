import { EdgeProps, useReactFlow } from '@xyflow/react';
import { memo, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ButtonEdge } from '@/components/edges/button-edge';
import { useAppStore } from '@/store/app-store';
import { audibilityOf } from '@/lib/signal';
import { pulses } from '@/lib/pulse-bus';
import { WIRE_ARROW_ID } from '@/components/edges/wire-markers';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const DeleteEdge = memo((props: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const live = useAppStore((state) =>
    audibilityOf(state.nodes, state.edges).live.has(props.id),
  );
  const playing = useAppStore((state) => state.isPlaying);
  const pulse = useRef<SVGPathElement>(null);

  useEffect(
    () =>
      pulses.subscribe(props.id, (intensity) => {
        const path = pulse.current;
        if (!path) return;
        path.dataset.pulses = String(Number(path.dataset.pulses ?? 0) + 1);
        if (reducedMotion()) return;
        path.animate(
          [
            { opacity: 0.35 + 0.65 * intensity, strokeWidth: 5 },
            { opacity: 0, strokeWidth: 2 },
          ],
          { duration: 260, easing: 'ease-out' },
        );
      }),
    [props.id],
  );

  const onDeleteEdge = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== props.id));
  };

  return (
    <ButtonEdge
      {...props}
      markerEnd={`url(#${WIRE_ARROW_ID})`}
      className={live && playing ? 'flow-wire--live' : undefined}
      pulseRef={pulse}
      style={{
        ...props.style,
        stroke: 'var(--primary)',
        strokeWidth: 2,
        opacity: props.selected ? 1 : live ? 0.4 : 0.2,
      }}
    >
      {props.selected && (
        <Button
          aria-label="Disconnect modules"
          onClick={onDeleteEdge}
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-full border hover:bg-muted transition-colors"
        >
          <X size={12} />
        </Button>
      )}
    </ButtonEdge>
  );
});

DeleteEdge.displayName = 'DeleteEdge';

export default DeleteEdge;
