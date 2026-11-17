import { useRef, type ReactElement, type MouseEventHandler } from 'react';
import {
  addEdge,
  reconnectEdge,
  useReactFlow,
  type Edge,
  type Connection,
  type OnConnectEnd,
  type ReactFlowProps,
} from '@xyflow/react';
import type { RadialMenuHandle } from '@/components/ui/radial-menu';
import {
  RadialMenu,
  RadialMenuItem,
  RadialMenuSubItem,
} from '@/components/ui/radial-menu';
import {
  createNodeByType,
  type AppNodeType,
} from '@/components/nodes/registry';
import { iconMapping } from '@/data/icon-mapping';
import { radialMenuItems } from '@/data/radial-menu';
import { useAppStore } from '@/store/app-store';
import { check, refuseDrop } from '@/lib/signal';
import { getMenuSize } from '@/components/ui/radial-menu/geometry';

type ConnectionHandlers = Pick<
  ReactFlowProps,
  'onConnectEnd' | 'onReconnect' | 'onReconnectEnd'
>;

export function NodeContextMenu({
  children,
}: {
  children: (
    handlers: ConnectionHandlers,
    onAddNode: MouseEventHandler<HTMLButtonElement>,
  ) => ReactElement;
}) {
  const menuRef = useRef<RadialMenuHandle>(null);
  const pending = useRef<PendingConnection | null>(null);
  const openFromHandle: OnConnectEnd = (event, state) => {
    pending.current = null;
    if (state.isValid || !state.fromNode || !state.fromHandle) return;
    if (state.toNode && state.toHandle) {
      const { nodes, edges, setNotice } = useAppStore.getState();
      const connection =
        state.fromHandle.type === 'source'
          ? { source: state.fromNode.id, target: state.toNode.id }
          : { source: state.toNode.id, target: state.fromNode.id };
      const result = check(nodes, edges, connection);
      if (!result.ok) setNotice(result.reason);
      return;
    }
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    if (!point) return;
    const under = document.elementFromPoint(point.clientX, point.clientY);
    if (!under?.classList.contains('react-flow__pane')) {
      const droppedOnId = under
        ?.closest('.react-flow__node')
        ?.getAttribute('data-id');
      const { nodes, setNotice } = useAppStore.getState();
      const droppedOn = nodes.find((node) => node.id === droppedOnId);
      const reason =
        droppedOn && droppedOn.id !== state.fromNode.id
          ? refuseDrop(droppedOn, state.fromHandle.type)
          : null;
      if (reason) setNotice(reason);
      return;
    }
    pending.current = {
      nodeId: state.fromNode.id,
      handleId: state.fromHandle.id ?? null,
      type: state.fromHandle.type,
    };
    menuRef.current?.openAt({ x: point.clientX, y: point.clientY }, true);
  };
  const handlers: ConnectionHandlers = {
    onConnectEnd: openFromHandle,
    onReconnect: (edge, connection) =>
      useAppStore.setState((state) => {
        const others = state.edges.filter((other) => other.id !== edge.id);
        const result = check(state.nodes, others, connection);
        if (!result.ok) return { notice: result.reason };
        return { edges: reconnectEdge(edge, connection, state.edges) };
      }),
    onReconnectEnd: (event, edge, _type, state) => {
      openFromHandle(event, state);
      if (pending.current) pending.current.edge = edge;
    },
  };
  const position = useRef({ x: 0, y: 0 });
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const openFromToolbar: MouseEventHandler<HTMLButtonElement> = (event) => {
    const toolbar = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!toolbar) return;
    const size = getMenuSize(window.innerWidth, window.innerHeight);
    menuRef.current?.openAt({
      x: toolbar.left - 24 - size / 2,
      y: toolbar.bottom + 12 + size / 2,
    });
  };

  const addNode = (type: AppNodeType) => {
    const canvas = document
      .querySelector('.reactflow-wrapper')
      ?.getBoundingClientRect();
    if (!canvas) return;
    const { zoom } = getViewport();
    const existing = useAppStore
      .getState()
      .nodes.find((node) => node.type === type);
    const width = (existing?.measured?.width ?? 500) * zoom;
    const height = (existing?.measured?.height ?? 500) * zoom;
    const inset = 24;
    const spawn = {
      x: Math.max(
        canvas.left + inset,
        Math.min(position.current.x, canvas.right - width - inset),
      ),
      y: Math.max(
        canvas.top + inset,
        Math.min(position.current.y, canvas.bottom - height - inset),
      ),
    };
    const newNode = createNodeByType({
      type,
      position: screenToFlowPosition(spawn),
    });
    const origin = pending.current;
    useAppStore.setState((state) => {
      const nodes = [...state.nodes, newNode];
      let edges = state.edges;
      let notice = state.notice;
      if (origin && state.nodes.some((node) => node.id === origin.nodeId)) {
        const connection = connectionToNode(origin, newNode.id);
        const others = origin.edge
          ? edges.filter((edge) => edge.id !== origin.edge!.id)
          : edges;
        const result = check(nodes, others, connection);
        if (!result.ok) {
          notice = result.reason;
        } else {
          edges = origin.edge
            ? reconnectEdge(origin.edge, connection, edges)
            : addEdge({ ...connection, type: 'default' }, edges);
        }
      }
      return { nodes, edges, notice };
    });
    pending.current = null;
  };

  return (
    <RadialMenu
      ariaLabel="Add nodes"
      openOnTouchTap
      isTriggerTarget={(target) =>
        target.classList.contains('react-flow__pane')
      }
      menuRef={menuRef}
      trigger={children(handlers, openFromToolbar)}
      onPositionChange={(point, fromHandle) => {
        position.current = point;
        if (!fromHandle) pending.current = null;
      }}
    >
      {radialMenuItems.map(({ label, category, icon: Icon, items }) => (
        <RadialMenuItem
          key={category}
          label={label}
          icon={<Icon strokeWidth={1.7} />}
        >
          {items.map((node) => {
            const NodeIcon = iconMapping[node.icon];
            return (
              <RadialMenuSubItem
                key={node.id}
                aria-label={`Add ${node.title}`}
                icon={<NodeIcon aria-hidden="true" />}
                onSelect={() => addNode(node.id)}
              >
                {node.title}
              </RadialMenuSubItem>
            );
          })}
        </RadialMenuItem>
      ))}
    </RadialMenu>
  );
}

type PendingConnection = {
  nodeId: string;
  handleId: string | null;
  type: 'source' | 'target';
  edge?: Edge;
};

function connectionToNode(
  origin: PendingConnection,
  nodeId: string,
): Connection {
  return origin.type === 'source'
    ? {
        source: origin.nodeId,
        sourceHandle: origin.handleId,
        target: nodeId,
        targetHandle: null,
      }
    : {
        source: nodeId,
        sourceHandle: null,
        target: origin.nodeId,
        targetHandle: origin.handleId,
      };
}
