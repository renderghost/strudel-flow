import { Position } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { CustomControlsProps } from '../../define-node';
import { BaseHandle } from '../../shared/base-handle';
import { useAppStore } from '@/store/app-store';
import { colourOf, instrumentsFeeding } from '@/lib/signal';
import { cn } from '@/lib/utils';
import {
  FADER_MAX,
  FADER_MIN,
  FLAT_CHANNEL,
  GAIN_MAX,
  GAIN_MIN,
  PORTS,
  faderToPosition,
  formatDb,
  formatPan,
  positionToFader,
  type Channel,
  type MixerData,
} from './mixer';
import { MixerFader, MixerKnob, StripToggle } from './mixer-controls';
import { ClipLight, LevelMeter } from './level-meter';
import { useMeters } from './use-meters';
import type { SliderRange } from './slider';

const METER_KEYS = [...PORTS, 'master'];
const FADER: SliderRange = {
  min: FADER_MIN,
  max: FADER_MAX,
  step: 1,
  fine: 0.1,
};
const GAIN: SliderRange = { min: GAIN_MIN, max: GAIN_MAX, step: 1, fine: 0.1 };
const PAN: SliderRange = { min: 0, max: 1, step: 0.05, fine: 0.01 };
const UNITY = faderToPosition(0);

/** Strip geometry, shared with the input handles on the node's bottom edge. */
const STRIP_WIDTH = 72;
const STRIP_GAP = 4;
/** BaseNode padding (4px) plus this node's own left padding (8px). */
const STRIPS_LEFT = 12;
const inputLeft = (index: number) =>
  STRIPS_LEFT + index * (STRIP_WIDTH + STRIP_GAP) + STRIP_WIDTH / 2;

const short = (db: number, floor = false) =>
  formatDb(db, { floor }).replace(' dB', '');
const shortPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan - 0.5) * 200);
  return amount === 0 ? 'C' : `${pan < 0.5 ? 'L' : 'R'}${amount}`;
};

type StripSource = { wired: boolean; instruments: number; colours: number[] };

/**
 * What feeds each strip, as a string so the store selector stays stable:
 * whether anything is wired in, how many instruments are behind it, and their
 * colours.
 */
function useStripSources(id: string): StripSource[] {
  const summary = useAppStore((state) =>
    PORTS.map((port) => {
      const wired = state.edges.some(
        (edge) => edge.target === id && edge.targetHandle === port,
      );
      const feeding = instrumentsFeeding(id, port, state.nodes, state.edges);
      const colours = feeding
        .map(colourOf)
        .filter((colour): colour is number => colour !== null);
      return `${wired ? 1 : 0}:${feeding.length}:${colours.join(',')}`;
    }).join('|'),
  );
  return summary.split('|').map((part) => {
    const [wired, count, colours] = part.split(':');
    return {
      wired: wired === '1',
      instruments: Number(count),
      colours: colours ? colours.split(',').map(Number) : [],
    };
  });
}

const swatch = (colour: number) => `var(--instrument-${colour + 1})`;

function Strip({
  index,
  channel,
  source,
  meters,
  onChange,
}: {
  index: number;
  channel: Channel;
  source: StripSource;
  meters: ReturnType<typeof useMeters>;
  onChange: (patch: Partial<Channel>) => void;
}) {
  const number = index + 1;
  const port = PORTS[index];
  // One instrument behind the strip tints it; several leave it neutral with a
  // dot per colour.
  const tint =
    source.instruments === 1 && source.colours.length === 1
      ? swatch(source.colours[0])
      : null;
  const dots = source.instruments > 1 ? [...new Set(source.colours)] : [];
  const style: CSSProperties | undefined = tint
    ? { background: `color-mix(in oklch, ${tint} 12%, transparent)` }
    : undefined;

  return (
    <div
      data-channel={number}
      className="relative flex flex-col items-center rounded-md pb-2"
      style={{ ...style, width: STRIP_WIDTH }}
    >
      {tint && (
        <span
          aria-hidden="true"
          className="absolute inset-x-1 top-0 h-[3px] rounded-b-sm"
          style={{ background: tint }}
        />
      )}
      <div
        className={cn(
          'flex w-full flex-col items-center gap-2 pt-2.5',
          !source.wired && 'opacity-50',
        )}
      >
        <div className="flex gap-1">
          <StripToggle
            tone="solo"
            pressed={channel.solo}
            label={`Solo channel ${number}`}
            onClick={() => onChange({ solo: !channel.solo })}
          >
            S
          </StripToggle>
          <StripToggle
            tone="mute"
            pressed={channel.muted}
            label={`Mute channel ${number}`}
            onClick={() => onChange({ muted: !channel.muted })}
          >
            M
          </StripToggle>
        </div>
        <ClipLight
          meters={meters}
          meterKey={port}
          label={`channel ${number}`}
        />
        <div className="flex h-56 gap-1.5">
          <MixerFader
            label={`Level, channel ${number}`}
            value={channel.fader}
            range={FADER}
            reset={0}
            unity={UNITY}
            toPosition={faderToPosition}
            fromPosition={positionToFader}
            valueText={(value) => formatDb(value, { floor: true })}
            onChange={(fader) => onChange({ fader })}
          />
          <LevelMeter meters={meters} meterKey={port} />
        </div>
        <span className="font-mono text-[11px] leading-none text-foreground tabular-nums">
          {short(channel.fader, true)}
        </span>
        <MixerKnob
          label={`Pan, channel ${number}`}
          value={channel.pan}
          range={PAN}
          reset={FLAT_CHANNEL.pan}
          origin={0.5}
          display={shortPan(channel.pan)}
          valueText={formatPan}
          onChange={(pan) => onChange({ pan })}
        />
        <MixerKnob
          label={`Input gain, channel ${number}`}
          value={channel.gain}
          range={GAIN}
          reset={FLAT_CHANNEL.gain}
          origin={(0 - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)}
          display={short(channel.gain)}
          valueText={(value) => formatDb(value)}
          onChange={(gain) => onChange({ gain })}
        />
        <span className="flex h-4 items-center gap-1 text-xs font-semibold text-muted-foreground tabular-nums">
          {number}
          {dots.map((colour) => (
            <span
              key={colour}
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: swatch(colour) }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export function MixerNode({
  id,
  values,
  onChange,
  isPlaying,
}: CustomControlsProps<MixerData>) {
  const sources = useStripSources(id);
  const meters = useMeters(id, METER_KEYS, isPlaying);
  const updateChannel = (index: number, patch: Partial<Channel>) =>
    onChange({
      channels: values.channels.map((channel, at) =>
        at === index ? { ...channel, ...patch } : channel,
      ),
    });

  return (
    <div className="flex px-2 pb-2" style={{ gap: STRIP_GAP }}>
      {values.channels.map((channel, index) => (
        <Strip
          key={PORTS[index]}
          index={index}
          channel={channel}
          source={sources[index]}
          meters={meters}
          onChange={(patch) => updateChannel(index, patch)}
        />
      ))}
      {/* Positioned against the node itself so they hang over its bottom edge,
          like every other node's handles. */}
      {PORTS.map((port, index) => (
        <BaseHandle
          key={port}
          type="target"
          id={port}
          position={Position.Bottom}
          aria-label={`Channel ${index + 1} input`}
          style={{ left: inputLeft(index) }}
        />
      ))}
      <div aria-hidden="true" className="mx-1.5 w-px self-stretch bg-border" />
      <div className="flex w-20 flex-col items-center gap-2 pt-2.5">
        <span className="h-7 text-[11px] leading-7 font-semibold tracking-widest text-muted-foreground uppercase">
          Master
        </span>
        <ClipLight meters={meters} meterKey="master" label="master" />
        <div className="flex h-56 gap-1.5">
          <MixerFader
            label="Master level"
            value={values.master}
            range={FADER}
            reset={0}
            unity={UNITY}
            toPosition={faderToPosition}
            fromPosition={positionToFader}
            valueText={(value) => formatDb(value, { floor: true })}
            onChange={(master) => onChange({ master })}
          />
          <LevelMeter meters={meters} meterKey="master" />
        </div>
        <span className="font-mono text-[11px] leading-none text-foreground tabular-nums">
          {short(values.master, true)}
        </span>
      </div>
    </div>
  );
}
