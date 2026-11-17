import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  ColorMode,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Edge,
} from '@xyflow/react';

import type { AppNode } from '@/components/nodes/registry';
import { initialEdges, initialNodes } from '@/data/workflow-data';
import { check } from '@/lib/signal';
import { OUTPUT_TYPE } from '@/lib/signal/graph';
import { withoutProtectedRemovals } from '@/lib/signal/protect';

type AppState = {
  name: string;
  author: string;
  description: string;
  graphRevision: number;
  nodes: AppNode[];
  edges: Edge[];
  colorMode: ColorMode;
  theme: string;
  cpm: string;
  bpc: string;
  pattern: string;
  isPlaying: boolean;
  error: string | null;
  notice: string | null;
};

type AppActions = {
  setCpm: (cpm: string) => void;
  setBpc: (bpc: string) => void;
  setPattern: (pattern: string) => void;
  toggle: () => void;
  setError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
  setColorMode: (colorMode: ColorMode) => void;
  onNodesChange: OnNodesChange<AppNode>;
  removeNode: (nodeId: string) => void;
  setMuted: (nodeId: string, muted: boolean) => void;
  updateNodeData: (nodeId: string, updates: Record<string, unknown>) => void;
  onConnect: OnConnect;
  setTheme: (theme: string) => void;
  onEdgesChange: OnEdgesChange<Edge>;
};

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => ({
    graphRevision: 0,
    name: 'Untitled patch',
    author: '',
    description: '',
    nodes: initialNodes,
    edges: initialEdges,
    theme: 'caffeine',
    colorMode: 'system',
    cpm: '120',
    bpc: '4',
    pattern: '',
    isPlaying: false,
    error: null,
    notice: null,
    setCpm: (cpm) => set({ cpm }),
    setBpc: (bpc) => set({ bpc }),
    setPattern: (pattern) => set({ pattern }),
    toggle: () =>
      set((state) => ({ isPlaying: !state.isPlaying, error: null })),
    setError: (error) => set({ error, ...(error ? { isPlaying: false } : {}) }),
    setNotice: (notice) => set({ notice }),

    onNodesChange: (changes) => {
      const { nodes } = get();
      set({
        nodes: applyNodeChanges(
          withoutProtectedRemovals(changes, nodes),
          nodes,
        ),
      });
    },

    removeNode: (nodeId) =>
      set((state) =>
        state.nodes.some(
          (node) => node.id === nodeId && node.type === OUTPUT_TYPE,
        )
          ? {}
          : {
              nodes: state.nodes.filter((node) => node.id !== nodeId),
              edges: state.edges.filter(
                (edge) => edge.source !== nodeId && edge.target !== nodeId,
              ),
            },
      ),

    setMuted: (nodeId, muted) =>
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, state: muted ? 'paused' : 'running' },
              }
            : node,
        ),
      })),

    onEdgesChange: (changes) =>
      set({ edges: applyEdgeChanges(changes, get().edges) }),

    onConnect: (connection) => {
      const { nodes, edges } = get();
      const result = check(nodes, edges, connection);
      if (!result.ok) {
        set({ notice: result.reason });
        return;
      }
      const { source, target, sourceHandle, targetHandle } = connection;
      set({
        edges: addEdge(
          {
            id: `${source}-${target}`,
            source,
            target,
            type: 'default',
            ...(sourceHandle ? { sourceHandle } : {}),
            ...(targetHandle ? { targetHandle } : {}),
          },
          get().edges,
        ),
      });
    },

    setTheme: (theme) => set({ theme }),

    setColorMode: (colorMode) => set({ colorMode }),

    updateNodeData: (nodeId, updates) =>
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node,
        ),
      })),
  })),
);

const systemAppearance = window.matchMedia('(prefers-color-scheme: dark)');
function applyColorMode() {
  const { colorMode } = useAppStore.getState();
  document.documentElement.classList.toggle(
    'dark',
    colorMode === 'dark' ||
      (colorMode === 'system' && systemAppearance.matches),
  );
}
const unsubscribeAppearance = useAppStore.subscribe(
  (state) => state.colorMode,
  applyColorMode,
  {
    fireImmediately: true,
  },
);
systemAppearance.addEventListener('change', applyColorMode);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeAppearance();
    systemAppearance.removeEventListener('change', applyColorMode);
  });
}
