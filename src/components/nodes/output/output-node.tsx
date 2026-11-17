import type { CustomControlsProps } from '../define-node';
import { ScopeCanvas } from '../shared/scope-canvas';
import { MASTER_SCOPE_ID } from '@/lib/strudel-scope';

export function OutputNode({
  isPlaying,
}: CustomControlsProps<Record<never, never>>) {
  return (
    <div className="w-72 max-w-[calc(100vw-32px)] space-y-3 px-4 pt-1 pb-4">
      <p className="text-xs text-muted-foreground">
        Everything wired here plays.
      </p>
      <div className="space-y-1">
        <ScopeCanvas
          analyserId={MASTER_SCOPE_ID}
          scale={1}
          playing={isPlaying}
          label="Master waveform"
          master
        />
        <p className="text-[10px] text-muted-foreground">
          Full mix, with reverb and delay
        </p>
      </div>
    </div>
  );
}
