import { createElement, type ComponentType, type ReactNode } from 'react';
import type { iconMapping } from '@/data/icon-mapping';

export type Parameter =
  | {
      control: 'knob';
      label: string;
      default: number;
      min: number;
      max: number;
      step: number;
      unit?: string;
      format?: (value: number) => string;
    }
  | { control: 'text'; label: string; default: string }
  | {
      control: 'select';
      label: string;
      default: string;
      options: readonly { value: string; label: string }[];
    };
export type Parameters = Record<string, Parameter>;
export type ParameterValues<P extends Parameters> = {
  [K in keyof P]: P[K] extends { control: 'knob' } ? number : string;
};
export type NodeControlsProps<
  P extends Parameters,
  D extends Record<string, unknown> = Record<never, never>,
> = {
  values: D & ParameterValues<P>;
  onChange: (updates: Partial<D & ParameterValues<P>>) => void;
  id: string;
  isPlaying: boolean;
  isMuted: boolean;
};
export type CustomControlsProps<D extends Record<string, unknown>> =
  NodeControlsProps<Record<never, never>, D>;
type ControlsContext = Pick<
  CustomControlsProps<Record<never, never>>,
  'id' | 'isPlaying' | 'isMuted'
>;
export type NodeDefinition = {
  id: string;
  title: string;
  category: 'Instruments' | 'Synths' | 'Audio Effects' | 'Utility' | 'Output';
  icon: keyof typeof iconMapping;
  order?: number;
  /** Named input ports; wires into the node are grouped by `targetHandle`. */
  ports?: readonly string[];
  parameters: Parameters;
  defaults: Record<string, unknown>;
  getValues: (data: Record<string, unknown>) => Record<string, string | number>;
  updateValues: (
    data: Record<string, unknown>,
    updates: Record<string, unknown>,
  ) => Record<string, unknown>;
  generatePattern: (
    data: Record<string, unknown>,
    input: string,
    inputs?: Record<string, string>,
  ) => string;
  renderControls?: (
    data: Record<string, unknown>,
    update: (data: Record<string, unknown>) => void,
    context: ControlsContext,
  ) => ReactNode;
};

function parameterValues<P extends Parameters>(
  parameters: P,
  data: Record<string, unknown>,
): ParameterValues<P> {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, parameter]) => {
      const raw = data[key] ?? parameter.default;
      const value = parameter.control === 'knob' ? Number(raw) : String(raw);
      return [
        key,
        typeof value === 'number' && !Number.isFinite(value)
          ? parameter.default
          : value,
      ];
    }),
  ) as ParameterValues<P>;
}

export function defineNode<
  const P extends Parameters,
  D extends Record<string, unknown> = Record<never, never>,
>(definition: {
  id: string;
  title: string;
  category: NodeDefinition['category'];
  icon: NodeDefinition['icon'];
  order?: number;
  ports?: readonly string[];
  parameters: P;
  defaults?: D;
  read?: (data: Record<string, unknown>) => Record<string, unknown>;
  write?: (
    updates: Partial<D & ParameterValues<P>>,
    data: Record<string, unknown>,
  ) => Record<string, unknown>;
  generate: (
    values: D & ParameterValues<P>,
    input: string,
    context: {
      parameters: P;
      data: Record<string, unknown>;
      /** Input per port (`''` when unwired); empty for nodes without ports. */
      inputs: Record<string, string>;
    },
  ) => string;
  component?: ComponentType<NodeControlsProps<P, D>>;
}): NodeDefinition {
  const {
    parameters,
    component,
    generate,
    defaults = {} as D,
    read = (data) => data,
    write,
    ...metadata
  } = definition;
  const resolve = (data: Record<string, unknown>) => {
    const values = read(data);
    return {
      ...defaults,
      ...values,
      ...parameterValues(parameters, values),
    } as D & ParameterValues<P>;
  };
  const encode = (updates: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [
        key,
        key in parameters && value !== undefined ? String(value) : value,
      ]),
    );
  const updateValues = (
    data: Record<string, unknown>,
    updates: Record<string, unknown>,
  ) =>
    encode(
      write ? write(updates as Partial<D & ParameterValues<P>>, data) : updates,
    );
  return {
    ...metadata,
    parameters,
    getValues: (data) => parameterValues(parameters, read(data)),
    updateValues,
    defaults: {
      ...defaults,
      ...encode(
        write ? write(resolve({}), {}) : parameterValues(parameters, {}),
      ),
    },
    generatePattern: (data, input, inputs = {}) =>
      generate(resolve(data), input, { parameters, data, inputs }),
    renderControls: component
      ? (data, update, context) =>
          createElement(component, {
            ...context,
            values: resolve(data),
            onChange: (updates) => update(updateValues(data, updates)),
          })
      : undefined,
  };
}
export function generateParameterEffects(
  values: Record<string, number>,
  input: string,
  { parameters }: { parameters: Parameters },
) {
  const calls = Object.entries(parameters).flatMap(([key, parameter]) =>
    values[key] === parameter.default ? [] : [`${key}(${values[key]})`],
  );
  return [input, ...calls].filter(Boolean).join('.');
}
