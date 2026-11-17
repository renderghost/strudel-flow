import { useEffect, useRef } from 'react';
import { drawWaveform, scopeColour, traceWaveform } from '@/lib/scope-render';
import { ensureMasterAnalyser, readAnalyser } from '@/lib/strudel-scope';

export function ScopeCanvas({
  analyserId,
  scale,
  playing,
  label,
  master = false,
}: {
  analyserId: string;
  scale: number;
  playing: boolean;
  label: string;
  master?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

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
      if (playing && master) ensureMasterAnalyser();
      const samples = playing ? readAnalyser(analyserId) : undefined;
      drawWaveform(
        ctx,
        traceWaveform(samples, width, height, scale),
        scopeColour(element),
      );
      if (playing) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [analyserId, scale, playing, master]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={label}
      className="h-28 w-full rounded border border-border bg-background text-primary"
    />
  );
}
