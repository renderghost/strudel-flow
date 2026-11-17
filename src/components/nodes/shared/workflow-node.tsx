import { useState } from 'react';
import {
  Ban,
  Check,
  Code2,
  Ellipsis,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Position } from '@xyflow/react';
import { WorkflowNodeData, AppNodeType } from '@/components/nodes/registry';
import { nodeDefinitions } from '@/components/nodes/registry';
import { BaseNode } from '@/components/nodes/shared/base-node';
import { useAppStore } from '@/store/app-store';
import PatternPopup from '@/components/nodes/shared/pattern-popup';
import { BaseHandle } from '@/components/nodes/shared/base-handle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { colourOf, isNotHeard, overrideNote } from '@/lib/signal';
import { SWATCH_COUNT } from '@/lib/instrument-colours';

function WorkflowNode({
  id,
  data,
  type,
  children,
}: {
  id: string;
  data: WorkflowNodeData;
  type: AppNodeType;
  children?: React.ReactNode;
}) {
  const [showCode, setShowCode] = useState(false);
  const removeNode = useAppStore((state) => state.removeNode);
  const setMuted = useAppStore((state) => state.setMuted);
  const setColour = useAppStore((state) => state.setColour);
  const updateNodeData = useAppStore((state) => state.updateNodeData);
  const definition = nodeDefinitions[type];
  const category = definition?.category;
  const isInstrument = category === 'Instruments';
  const isOutput = category === 'Output';
  const hasPorts = Boolean(definition?.ports?.length);
  // Instruments mute through `state`; other mutable nodes (the mixer) through
  // `muted`, which migration leaves alone.
  const isMutable = isInstrument || definition?.mutable === true;
  const isPaused = isInstrument
    ? data.state === 'paused'
    : isMutable && data.muted === true;
  const kind = isInstrument
    ? 'instrument'
    : (definition?.title ?? 'module').toLowerCase();
  const setPaused = (paused: boolean) =>
    isInstrument ? setMuted(id, paused) : updateNodeData(id, { muted: paused });
  const colour = isInstrument ? colourOf({ data }) : null;
  const accent =
    colour === null ? undefined : `var(--instrument-${colour + 1})`;
  const notHeard = useAppStore((state) => {
    const node = state.nodes.find((candidate) => candidate.id === id);
    return node ? isNotHeard(node, state.nodes, state.edges) : false;
  });
  const override = useAppStore((state) =>
    overrideNote(state.nodes, state.edges, id),
  );

  return (
    <BaseNode
      data-muted={isPaused || undefined}
      className={cn(isPaused && 'border-amber-500/70 ring-1 ring-amber-500/25')}
    >
      {accent && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-lg"
          style={{ background: accent }}
        />
      )}
      {!isInstrument && !hasPorts && (
        <BaseHandle
          position={Position.Left}
          type="target"
          aria-label="Patch input"
          style={{ top: 28 }}
        />
      )}
      {!isOutput && (
        <BaseHandle
          position={Position.Right}
          type="source"
          aria-label="Patch output"
          style={{ top: 28 }}
        />
      )}
      <header className="mb-1 flex h-12 items-center gap-3 px-3">
        {accent && (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: accent }}
          />
        )}
        <h3 className="flex-1 text-[11px] font-semibold tracking-[.16em] uppercase">
          {data.title}
        </h3>
        <div className="flex items-center gap-1">
          {isMutable && (
            <Button
              variant="ghost"
              aria-label={isPaused ? `Unmute ${kind}` : `Mute ${kind}`}
              aria-pressed={isPaused}
              onClick={() => setPaused(!isPaused)}
              className={cn(
                'nodrag size-7 rounded-md p-1 text-muted-foreground',
                isPaused &&
                  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
              )}
            >
              {isPaused ? (
                <VolumeX className="size-3.5" />
              ) : (
                <Volume2 className="size-3.5" />
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label="Module options"
                className="nodrag size-7 rounded-md p-1 text-muted-foreground"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-md">
              <DropdownMenuItem onSelect={() => setShowCode(!showCode)}>
                <Code2 />
                {showCode ? 'Hide code' : 'View code'}
              </DropdownMenuItem>
              {isInstrument && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Colour</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={colour === null ? 'none' : String(colour)}
                    onValueChange={(value) =>
                      setColour(id, value === 'none' ? null : Number(value))
                    }
                    className="grid grid-cols-5 gap-1.5 px-2 pb-2"
                  >
                    <DropdownMenuRadioItem
                      value="none"
                      aria-label="No colour"
                      title="No colour"
                      onSelect={(event) => event.preventDefault()}
                      className={cn(
                        swatchClass,
                        'grid place-items-center border border-border text-muted-foreground',
                      )}
                    >
                      <Ban className="size-3.5" aria-hidden="true" />
                      <SelectedMark />
                    </DropdownMenuRadioItem>
                    {Array.from({ length: SWATCH_COUNT }, (_, index) => (
                      <DropdownMenuRadioItem
                        key={index}
                        value={String(index)}
                        aria-label={`Colour ${index + 1}`}
                        title={`Colour ${index + 1}`}
                        onSelect={(event) => event.preventDefault()}
                        className={swatchClass}
                        style={{ background: `var(--instrument-${index + 1})` }}
                      >
                        <SelectedMark />
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isOutput && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => removeNode(id)}
                >
                  <Trash2 />
                  Remove
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {notHeard && (
        <p
          role="note"
          className="mx-3 mb-3 w-fit rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          Not heard
        </p>
      )}
      {override && (
        <p
          role="note"
          className="mx-3 mb-3 w-fit rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          {override}
        </p>
      )}
      {isPaused && (
        <div
          role="status"
          className="mx-2 mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-amber-800 dark:text-amber-200"
        >
          <VolumeX className="size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-xs font-semibold">Muted</p>
            <p className="text-[10px] opacity-80">This {kind} is silent</p>
          </div>
          <button
            aria-label={`Unmute ${data.title}`}
            onClick={() => setPaused(false)}
            className="nodrag rounded-md border border-amber-600/30 bg-background/70 px-2 py-1.5 text-xs font-semibold hover:bg-background"
          >
            Unmute
          </button>
        </div>
      )}
      {/* Dim only the controls: the title and Not heard badge keep full contrast. */}
      <div className={cn(notHeard && 'opacity-60')}>{children}</div>
      {showCode && <PatternPopup id={id} />}
    </BaseNode>
  );
}
export default WorkflowNode;

// Hover and keyboard focus get a ring; the selected swatch gets a check badge,
// a different shape, so the two can't be confused in any theme.
const swatchClass =
  'relative size-6 rounded-full outline-none ring-offset-2 ring-offset-popover data-[highlighted]:ring-2 data-[highlighted]:ring-ring';

function SelectedMark() {
  return (
    <DropdownMenuItemIndicator
      data-selected-mark=""
      className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-foreground text-background"
    >
      <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
    </DropdownMenuItemIndicator>
  );
}
