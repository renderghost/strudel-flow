import { describe, expect, it } from 'vitest';
import type { NodeChange } from '@xyflow/react';
import type { AppNode } from '@/components/nodes/types';
import { withoutProtectedRemovals } from './protect';
import { F, O } from './test-fixtures';

describe('withoutProtectedRemovals', () => {
  it('keeps Output when removing a mixed selection', () => {
    const changes: NodeChange<AppNode>[] = [
      { type: 'remove', id: 'f' },
      { type: 'remove', id: 'o' },
      { type: 'select', id: 'o', selected: true },
    ];
    expect(withoutProtectedRemovals(changes, [F, O])).toEqual([
      { type: 'remove', id: 'f' },
      { type: 'select', id: 'o', selected: true },
    ]);
  });
});
