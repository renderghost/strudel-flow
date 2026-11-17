import type { ReactNode } from 'react';
import type { CustomControlsProps } from '../../define-node';
import { ParameterKnob } from '../../shared/parameter-knob';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  CLEAN_INTENSITY_MAX,
  DIVISIONS,
  MS_MAX,
  MS_MIN,
  TAPE_INTENSITY_MAX,
  type Division,
  type EchoData,
} from './echo';

const two = (value: number) => String(Number(value.toFixed(2)));
const percent = (value: number) => `${Math.round(value * 100)}%`;

function Toggle({
  pressed,
  onClick,
  label,
  disabled,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'nodrag rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
        pressed && 'border-primary bg-primary text-primary-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function EchoNode({ values, onChange }: CustomControlsProps<EchoData>) {
  const tape = values.mode === 'tape';
  const intensityMax = tape ? TAPE_INTENSITY_MAX : CLEAN_INTENSITY_MAX;
  const onHeads = values.heads.filter(Boolean).length;

  return (
    <div className="w-80 space-y-4 px-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div role="group" aria-label="Echo mode" className="flex gap-1">
          <Toggle pressed={tape} onClick={() => onChange({ mode: 'tape' })}>
            Tape
          </Toggle>
          <Toggle pressed={!tape} onClick={() => onChange({ mode: 'clean' })}>
            Clean
          </Toggle>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Sync
          <Switch
            className="nodrag"
            checked={values.sync}
            onCheckedChange={(sync) => onChange({ sync })}
          />
        </label>
      </div>

      <div className="grid grid-cols-3 justify-items-center gap-4">
        {values.sync ? (
          <label className="flex min-w-20 flex-col items-center gap-2 text-[9px] font-medium tracking-widest text-muted-foreground uppercase">
            <select
              aria-label="Rate"
              className="nodrag mt-6 rounded border border-input bg-background p-2 font-mono text-xs text-foreground normal-case"
              value={values.division}
              onChange={(event) =>
                onChange({ division: event.target.value as Division })
              }
            >
              {Object.keys(DIVISIONS).map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
            <span className="mt-auto">Rate</span>
          </label>
        ) : (
          <ParameterKnob
            label="Rate"
            value={values.ms}
            min={MS_MIN}
            max={MS_MAX}
            step={10}
            format={(value) => `${Math.round(value)} ms`}
            onChange={(ms) => onChange({ ms })}
          />
        )}
        <ParameterKnob
          label="Intensity"
          value={Math.min(values.intensity, intensityMax)}
          min={0}
          max={intensityMax}
          step={0.01}
          format={two}
          onChange={(intensity) => onChange({ intensity })}
        />
        <ParameterKnob
          label="Echo volume"
          value={values.volume}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={(volume) => onChange({ volume })}
        />
        {tape && (
          <>
            <ParameterKnob
              label="Tone"
              value={values.tone}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(tone) => onChange({ tone })}
            />
            <ParameterKnob
              label="Saturation"
              value={values.saturation}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(saturation) => onChange({ saturation })}
            />
          </>
        )}
      </div>

      {tape ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] font-medium tracking-widest text-muted-foreground uppercase">
            Heads
          </span>
          <div role="group" aria-label="Heads" className="flex gap-1">
            {values.heads.map((on, index) => (
              <Toggle
                key={index}
                pressed={on}
                label={`Head ${index + 1}`}
                // At least one head always plays.
                disabled={on && onHeads === 1}
                onClick={() =>
                  onChange({
                    heads: values.heads.map((head, at) =>
                      at === index ? !head : head,
                    ),
                  })
                }
              >
                {index + 1}
              </Toggle>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Applied after the whole chain. Scopes and meters don't hear it.
        </p>
      )}
    </div>
  );
}
