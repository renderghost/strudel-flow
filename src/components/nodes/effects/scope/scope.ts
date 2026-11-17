export type ScopeData = { scopeScale?: string };
export const DEFAULT_SCOPE_SCALE = 0.25;
export const scopeIdForNode = (id: string) => `flow-scope-${id}`;

/** Per-note control the patched engine reads: feed the analyser only. */
export const TAP_CONTROL = 'flowtap';
