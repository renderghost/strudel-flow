/**
 * Instrument colours: 8 hues spread round the wheel from the theme's primary
 * hue, with lightness tuned so each stays visible on the theme's card.
 */
export const SWATCH_COUNT = 8;

const CHROMA = 0.14;
const START_LIGHTNESS = { light: 0.58, dark: 0.76 } as const;
const MIN_CONTRAST = 3;
const GREY_CHROMA = 0.02;
const GREY_START_HUE = 25;

type Oklch = { l: number; c: number; h: number };

export function parseOklch(value: string): Oklch {
  const match = value.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) throw new Error(`Not an oklch colour: ${value}`);
  const [, l, percent, c, h] = match;
  return {
    l: Number(l) / (percent ? 100 : 1),
    c: Number(c),
    h: Number(h),
  };
}

function luminance({ l, c, h }: Oklch): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const r = clamp(
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
  );
  const g = clamp(
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
  );
  const bl = clamp(
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

/** WCAG contrast ratio between two oklch colours (sRGB-clipped). */
export function contrastRatio(first: string, second: string): number {
  const [a, b] = [first, second].map((value) => luminance(parseOklch(value)));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const format = ({ l, c, h }: Oklch) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

export function swatchesFor(
  primary: string,
  card: string,
  mode: 'light' | 'dark',
): string[] {
  const base = parseOklch(primary);
  const background = parseOklch(card);
  const start = base.c < GREY_CHROMA ? GREY_START_HUE : base.h;
  const step = background.l > 0.5 ? -0.02 : 0.02;
  return Array.from({ length: SWATCH_COUNT }, (_, k) => {
    const swatch = {
      l: START_LIGHTNESS[mode],
      c: CHROMA,
      h: (start + (360 / SWATCH_COUNT) * k) % 360,
    };
    for (
      let tries = 0;
      tries < 15 && contrastRatio(format(swatch), card) < MIN_CONTRAST;
      tries++
    )
      swatch.l = Math.min(0.95, Math.max(0.2, swatch.l + step));
    return format(swatch);
  });
}

/** CSS declarations for one theme mode: `--instrument-1:…;` … `--instrument-8:…;` */
export function swatchDeclarations(
  primary: string,
  card: string,
  mode: 'light' | 'dark',
): string {
  return swatchesFor(primary, card, mode)
    .map((swatch, i) => `--instrument-${i + 1}:${swatch};`)
    .join('');
}
