import type { AppNode } from '@/components/nodes/types';
import { OUTPUT_TYPE } from './graph';

export function withoutProtectedRemovals<
  T extends { type: string; id?: string },
>(changes: T[], nodes: AppNode[]): T[] {
  const protectedIds = new Set(
    nodes.filter((node) => node.type === OUTPUT_TYPE).map((node) => node.id),
  );
  return changes.filter(
    (change) =>
      change.type !== 'remove' ||
      change.id === undefined ||
      !protectedIds.has(change.id),
  );
}
