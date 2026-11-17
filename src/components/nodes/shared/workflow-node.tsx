import { useState } from 'react';
import { Code2, Ellipsis, Trash2, Volume2, VolumeX } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { overriddenBy } from '@/lib/signal';

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
  const category = nodeDefinitions[type]?.category;
  const isInstrument = category === 'Instruments';
  const isOutput = category === 'Output';
  const isPaused = isInstrument && data.state === 'paused';
  const overrider = useAppStore((state) =>
    overriddenBy(state.nodes, state.edges, id),
  );

  return (
    <BaseNode
      data-muted={isPaused || undefined}
      className={
        isPaused ? 'border-amber-500/70 ring-1 ring-amber-500/25' : undefined
      }
    >
      {!isInstrument && (
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
        <h3 className="flex-1 text-[11px] font-semibold tracking-[.16em] uppercase">
          {data.title}
        </h3>
        <div className="flex items-center gap-1">
          {isInstrument && (
            <Button
              variant="ghost"
              aria-label={isPaused ? 'Unmute instrument' : 'Mute instrument'}
              onClick={() => setMuted(id, !isPaused)}
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
      {overrider && (
        <p
          role="note"
          className="mx-3 mb-3 w-fit rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          Overridden by {overrider} downstream
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
            <p className="text-[10px] opacity-80">This instrument is silent</p>
          </div>
          <button
            aria-label={`Unmute ${data.title}`}
            onClick={() => setMuted(id, false)}
            className="nodrag rounded-md border border-amber-600/30 bg-background/70 px-2 py-1.5 text-xs font-semibold hover:bg-background"
          >
            Unmute
          </button>
        </div>
      )}
      {children}
      {showCode && <PatternPopup id={id} />}
    </BaseNode>
  );
}
export default WorkflowNode;
