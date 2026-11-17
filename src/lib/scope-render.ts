export type Point = [x: number, y: number];
export type ScopeColors = { from: string; to: string };

const SILENCE = 1e-6;

/**
 * Turns analyser samples into canvas points. Starts on the first rising zero
 * crossing so the trace holds still, and falls back to a flat centre line when
 * there is no signal.
 */
export function traceWaveform(
  samples: Float32Array | undefined,
  width: number,
  height: number,
  scale: number,
): Point[] {
  const middle = height / 2;
  const flat: Point[] = [
    [0, middle],
    [width, middle],
  ];
  if (!samples || samples.length < 2) return flat;
  const value = (i: number) => (Number.isFinite(samples[i]) ? samples[i] : 0);
  let loud = false;
  for (let i = 0; i < samples.length && !loud; i++)
    loud = Math.abs(value(i)) > SILENCE;
  if (!loud) return flat;

  let start = 0;
  for (let i = 1; i < samples.length / 2; i++) {
    if (value(i - 1) <= 0 && value(i) > 0) {
      start = i - 1;
      break;
    }
  }
  const count = Math.min(
    samples.length - start,
    Math.floor(samples.length / 2),
  );
  return Array.from({ length: count }, (_, k): Point => {
    const y = middle - value(start + k) * scale * middle;
    return [(k / (count - 1)) * width, Math.min(height, Math.max(0, y))];
  });
}

/** Strokes the trace with a horizontal theme gradient and a soft glow. */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  colors: ScopeColors,
) {
  const { width, height, clientWidth } = ctx.canvas;
  const ratio = clientWidth ? width / clientWidth : 1;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, colors.from);
  gradient.addColorStop(1, colors.to);
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2 * ratio;
  ctx.lineJoin = 'round';
  ctx.shadowColor = colors.from;
  ctx.shadowBlur = 8 * ratio;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

/** Theme chart colours, falling back to the element's text colour. */
export function themeScopeColors(element: Element): ScopeColors {
  const style = getComputedStyle(element);
  const read = (name: string) =>
    style.getPropertyValue(name).trim() || style.color;
  return { from: read('--chart-1'), to: read('--chart-2') };
}
