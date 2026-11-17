import { cn } from '@/lib/utils';
import { AMBER_FROM, RED_FROM, meterPosition } from './meter';
import type { useMeters } from './use-meters';

const AMBER_AT = meterPosition(AMBER_FROM);
const RED_AT = meterPosition(RED_FROM);

/** Flat studio zones: green, amber, red. */
function Zones({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('absolute inset-0', className)}>
      <span
        className="absolute inset-x-0 bottom-0 bg-green-500"
        style={{ height: `${AMBER_AT * 100}%` }}
      />
      <span
        className="absolute inset-x-0 bg-amber-500"
        style={{
          bottom: `${AMBER_AT * 100}%`,
          height: `${(RED_AT - AMBER_AT) * 100}%`,
        }}
      />
      <span
        className="absolute inset-x-0 top-0 bg-red-500"
        style={{ height: `${(1 - RED_AT) * 100}%` }}
      />
    </span>
  );
}

type Meters = ReturnType<typeof useMeters>;

export function LevelMeter({
  meters,
  meterKey,
}: {
  meters: Meters;
  meterKey: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-full w-1.5 overflow-hidden rounded-[1px] bg-muted"
    >
      <Zones className="opacity-15" />
      <span
        ref={meters.register(meterKey, 'lit')}
        className="absolute inset-0"
        style={{ clipPath: 'inset(100% 0 0 0)' }}
      >
        <Zones />
      </span>
      <span
        ref={meters.register(meterKey, 'hold')}
        className="absolute inset-x-0 h-px bg-foreground opacity-0"
      />
    </span>
  );
}

export function ClipLight({
  meters,
  meterKey,
  label,
}: {
  meters: Meters;
  meterKey: string;
  /** e.g. "channel 3" or "master". */
  label: string;
}) {
  const on = meters.clipped.has(meterKey);
  return (
    <button
      type="button"
      aria-label={on ? `Clipped, ${label}: clear` : `No clipping, ${label}`}
      title={on ? 'Clipped: click to clear' : 'Clip light'}
      disabled={!on}
      onClick={() => meters.clear(meterKey)}
      className={cn(
        'nodrag h-1.5 w-5 rounded-[1px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'cursor-pointer bg-red-500' : 'bg-muted',
      )}
    />
  );
}
