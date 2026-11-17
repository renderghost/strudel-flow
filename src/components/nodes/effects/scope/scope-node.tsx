import type { CustomControlsProps } from '../../define-node';
import type { ScopeData } from './scope';
import { useEffect, useRef } from 'react';
import { ParameterKnob } from '../../shared/parameter-knob';
import { drawScope } from '@/lib/strudel-scope';
import { DEFAULT_SCOPE_SCALE, scopeIdForNode } from './scope';

export function ScopeNode({
  values: data,
  onChange,
  isPlaying: playing,
  id,
}: CustomControlsProps<ScopeData>) {
  const scopeId = scopeIdForNode(id);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scale = Number(data.scopeScale ?? DEFAULT_SCOPE_SCALE);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    let frame: number;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(element.clientWidth * ratio);
      const height = Math.round(element.clientHeight * ratio);
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      drawScope(
        ctx,
        scopeId,
        Number.isFinite(scale) ? scale : DEFAULT_SCOPE_SCALE,
        playing,
      );
      if (playing) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [scopeId, scale, playing]);

  return (
    <div className="w-72 max-w-[calc(100vw-32px)] space-y-3 px-4 pb-4">
      <canvas
        ref={canvas}
        role="img"
        aria-label="Audio waveform"
        className="h-28 w-full rounded border border-border bg-background text-primary"
      />
      <div className="flex justify-center">
        <ParameterKnob
          label="Scale"
          value={scale}
          min={0.1}
          max={4}
          step={0.05}
          format={(value) => String(Number(value.toFixed(2)))}
          onChange={(value) => onChange({ scopeScale: String(value) })}
        />
      </div>
    </div>
  );
}
