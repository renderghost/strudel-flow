import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { keyStep, quantise, wheelSteps, type SliderRange } from './slider';

type SliderProps = {
  /** Accessible name, e.g. "Pan, channel 3". */
  label: string;
  value: number;
  range: SliderRange;
  /** Double-click returns here. */
  reset: number;
  onChange: (value: number) => void;
  /** Spoken value, e.g. "−6.0 dB". */
  valueText: (value: number) => string;
  /** Value (0–1 of the travel) and back; linear unless given. */
  toPosition?: (value: number) => number;
  fromPosition?: (position: number) => number;
  className?: string;
  children: (position: number) => ReactNode;
};

/**
 * Shared behaviour for mixer knobs and faders: drag (Shift for fine), arrow
 * keys (Shift for fine), wheel while hovered, double-click to reset.
 */
function MixerSlider({
  label,
  value,
  range,
  reset,
  onChange,
  valueText,
  toPosition = (v) => (v - range.min) / (range.max - range.min),
  fromPosition = (p) => range.min + p * (range.max - range.min),
  className,
  children,
  pixelsPerTravel,
}: SliderProps & {
  /** Drag distance for the whole travel; the element's height when absent. */
  pixelsPerTravel?: number;
}) {
  const drag = useRef<{ x: number; y: number; position: number } | null>(null);
  const wheelRest = useRef(0);
  const position = Math.min(1, Math.max(0, toPosition(value)));
  const set = (next: number) => {
    const quantised = quantise(next, range);
    if (quantised !== value) onChange(quantised);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      aria-valuenow={value}
      aria-valuetext={valueText(value)}
      className={cn(
        'nokey nodrag nopan nowheel relative cursor-ns-resize touch-none rounded outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, position };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const travel =
          (pixelsPerTravel ?? event.currentTarget.clientHeight) *
          (event.shiftKey ? 6 : 1);
        const moved =
          drag.current.y - event.clientY + event.clientX - drag.current.x;
        const next = Math.min(
          1,
          Math.max(0, drag.current.position + moved / travel),
        );
        drag.current = { x: event.clientX, y: event.clientY, position: next };
        set(fromPosition(next));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onDoubleClick={() => set(reset)}
      onKeyDown={(event) => {
        const next = keyStep(value, event.key, event.shiftKey, range);
        if (next === null) return;
        event.preventDefault();
        event.stopPropagation();
        set(next);
      }}
      onWheel={(event) => {
        // Shift+wheel arrives as horizontal scroll on some systems.
        const delta = event.deltaY || event.deltaX;
        const { steps, rest } = wheelSteps(wheelRest.current, delta);
        wheelRest.current = rest;
        if (steps)
          set(value + steps * (event.shiftKey ? range.fine : range.step));
      }}
    >
      {children(position)}
    </div>
  );
}

type KnobProps = Omit<SliderProps, 'children'> & {
  /** Where the value arc starts (0–1 of the travel), e.g. centre for pan. */
  origin: number;
  display: string;
};

export function MixerKnob({ origin, display, ...props }: KnobProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <MixerSlider
        {...props}
        pixelsPerTravel={200}
        className="grid size-14 place-items-center rounded-full"
      >
        {(position) => {
          const start = Math.min(origin, position) * 75;
          const length = Math.abs(position - origin) * 75;
          return (
            <>
              <svg
                viewBox="0 0 32 32"
                aria-hidden="true"
                className="absolute inset-0 size-full -rotate-225 fill-none stroke-[3]"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  pathLength="100"
                  strokeDasharray="75 100"
                  className="stroke-muted-foreground/20"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  pathLength="100"
                  strokeDasharray={`0 ${start} ${length} 100`}
                  className="stroke-primary"
                />
              </svg>
              <span
                aria-hidden="true"
                className="absolute inset-3 rounded-full border border-muted-foreground/20 bg-secondary"
                style={{ transform: `rotate(${-135 + position * 270}deg)` }}
              >
                <span className="absolute top-1 left-1/2 h-3 w-1 -translate-x-1/2 rounded-full bg-primary" />
              </span>
            </>
          );
        }}
      </MixerSlider>
      <span className="font-mono text-[11px] leading-none text-muted-foreground tabular-nums">
        {display}
      </span>
    </div>
  );
}

type FaderProps = Omit<SliderProps, 'children'> & {
  /** Travel position of the 0 dB mark. */
  unity: number;
};

export function MixerFader({ unity, ...props }: FaderProps) {
  return (
    <MixerSlider {...props} className="h-full w-8">
      {(position) => (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-1/2 w-1 -translate-x-1/2 rounded-full bg-muted-foreground/30"
          />
          <span
            aria-hidden="true"
            className="absolute left-0 h-px w-2 bg-muted-foreground/70"
            style={{ bottom: `calc(${unity} * (100% - 16px) + 8px)` }}
          />
          <span
            aria-hidden="true"
            className="absolute left-1/2 h-4 w-8 -translate-x-1/2 translate-y-1/2 rounded-sm border border-foreground/60 bg-card"
            style={{ bottom: `calc(${position} * (100% - 16px) + 8px)` }}
          />
        </>
      )}
    </MixerSlider>
  );
}

export function StripToggle({
  pressed,
  onClick,
  label,
  tone,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  tone: 'mute' | 'solo';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'nodrag grid size-7 place-items-center rounded-md border border-border text-[11px] leading-none font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed &&
          tone === 'mute' &&
          'border-amber-500/60 bg-amber-500/20 text-amber-800 dark:text-amber-200',
        pressed &&
          tone === 'solo' &&
          'border-primary bg-primary text-primary-foreground',
      )}
    >
      {children}
    </button>
  );
}
