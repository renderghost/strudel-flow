import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPulseBus, pulseHook } from './pulse-bus';
import { edgeOfMarker, markerFor } from './pulse-marker';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('markers', () => {
  it('round-trip any edge id as a plain identifier', () => {
    for (const id of ['a-f', 'edge_1', 'x.y', 'é', 'V1StGXR8_Z5jdHi6B-myT']) {
      const marker = markerFor(id);
      expect(marker).toMatch(/^[A-Za-z_$][\w$]*$/);
      expect(edgeOfMarker(marker)).toBe(id);
    }
  });

  it('ignore other controls', () => expect(edgeOfMarker('gain')).toBeNull());
});

describe('pulse bus', () => {
  it('delivers a pulse after its delay', () => {
    const bus = createPulseBus();
    const listener = vi.fn();
    bus.subscribe('a-f', listener);
    bus.emit('a-f', 0.5, 100);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledWith(0.5);
  });

  it('stops after unsubscribing', () => {
    const bus = createPulseBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe('a-f', listener);
    bus.emit('a-f', 1, 50);
    unsubscribe();
    vi.advanceTimersByTime(50);
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores wires nobody listens to', () => {
    const bus = createPulseBus();
    expect(() => {
      bus.emit('gone', 1, 0);
      vi.runAllTimers();
    }).not.toThrow();
  });
});

describe('pulseHook', () => {
  const setup = () => {
    const bus = createPulseBus();
    const heard: Array<[string, number]> = [];
    for (const id of ['a-f', 'f-o'])
      bus.subscribe(id, (intensity) => heard.push([id, intensity]));
    return { hook: pulseHook(bus), heard };
  };

  it('pulses every marked wire when the note plays', () => {
    const { hook, heard } = setup();
    hook(10.5, { value: { note: 'c', fe_a_45_f: 1, fe_f_45_o: 1 } }, 10);
    vi.advanceTimersByTime(499);
    expect(heard).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(heard).toEqual([
      ['a-f', 1],
      ['f-o', 1],
    ]);
  });

  it('scales intensity with gain and velocity, capped at 1', () => {
    const { hook, heard } = setup();
    hook(0, { value: { fe_a_45_f: 1, gain: 0.4 } }, 0);
    hook(0, { value: { fe_a_45_f: 1, gain: 0.8, velocity: 0.5 } }, 0);
    hook(0, { value: { fe_a_45_f: 1, gain: 2 } }, 0);
    vi.runAllTimers();
    expect(heard.map(([, intensity]) => intensity)).toEqual([0.5, 0.5, 1]);
  });
});
