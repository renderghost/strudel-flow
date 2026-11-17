import type { CustomControlsProps } from '../../define-node';
import type { ScopeData } from './scope';
import { ParameterKnob } from '../../shared/parameter-knob';
import { ScopeCanvas } from '../../shared/scope-canvas';
import { DEFAULT_SCOPE_SCALE, scopeIdForNode } from './scope';

export function ScopeNode({
  values: data,
  onChange,
  isPlaying: playing,
  id,
}: CustomControlsProps<ScopeData>) {
  const scale = Number(data.scopeScale ?? DEFAULT_SCOPE_SCALE);

  return (
    <div className="w-72 max-w-[calc(100vw-32px)] space-y-3 px-4 pb-4">
      <div className="space-y-1">
        <ScopeCanvas
          analyserId={scopeIdForNode(id)}
          scale={Number.isFinite(scale) ? scale : DEFAULT_SCOPE_SCALE}
          playing={playing}
          label="Audio waveform"
        />
        <p className="text-[10px] text-muted-foreground">
          Before reverb and delay
        </p>
      </div>
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
