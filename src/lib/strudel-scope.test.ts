// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@strudel/web', () => ({
  Pattern: class {},
  analysers: {},
  getAnalyserById: vi.fn(),
  getMasterOutput: vi.fn(),
  registerControl: vi.fn(),
}));

const { ensureMasterAnalyser, MASTER_SCOPE_ID } =
  await import('./strudel-scope');

const analyser = () => ({}) as AnalyserNode;

describe('ensureMasterAnalyser', () => {
  it('connects the master to each analyser once', () => {
    const master = { connect: vi.fn() };
    let current = analyser();
    const deps = {
      getAnalyserById: vi.fn(() => current),
      getMasterOutput: () => master as unknown as AudioNode,
    };
    ensureMasterAnalyser(deps);
    ensureMasterAnalyser(deps);
    expect(master.connect).toHaveBeenCalledTimes(1);
    // Same window as superdough's default per-note analyser (fft 8 → 2^13),
    // so a Scope and the master show the same span of time.
    expect(deps.getAnalyserById).toHaveBeenCalledWith(MASTER_SCOPE_ID, 8192);

    current = analyser();
    ensureMasterAnalyser(deps);
    expect(master.connect).toHaveBeenCalledTimes(2);
    expect(master.connect).toHaveBeenLastCalledWith(current);
  });

  it('does nothing while the engine has no master output', () => {
    const deps = {
      getAnalyserById: vi.fn(() => analyser()),
      getMasterOutput: () => null,
    };
    expect(() => ensureMasterAnalyser(deps)).not.toThrow();
    expect(deps.getAnalyserById).not.toHaveBeenCalled();
  });
});
