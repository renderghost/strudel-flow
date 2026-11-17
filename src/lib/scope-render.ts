export type Point = [x: number, y: number];

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

/** Strokes the trace as one plain line in a single colour. */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  colour: string,
) {
  const { width, height, clientWidth } = ctx.canvas;
  const ratio = clientWidth ? width / clientWidth : 1;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5 * ratio;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

/** The theme's primary colour, falling back to the element's text colour. */
export function scopeColour(element: Element): string {
  const style = getComputedStyle(element);
  return style.getPropertyValue('--primary').trim() || style.color;
}
