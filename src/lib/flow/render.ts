import type { FlowData, FlowScenario, FlowStep } from './types';
import { renderEmail } from './render-email';

export type Ctx = { data: FlowData; scenario: FlowScenario; index: number };
type Renderer = (host: HTMLElement, step: FlowStep, ctx: Ctx) => void;

// One renderer per project: the structure of what is drawn is the project's own, the controls and chrome are shared.
const renderers: Partial<Record<FlowData['kind'], Renderer>> = {
  email: renderEmail,
};

export function registerRenderer(kind: FlowData['kind'], fn: Renderer) {
  renderers[kind] = fn;
}

export function renderVisual(host: HTMLElement, ctx: Ctx) {
  const step = ctx.scenario.steps[ctx.index]!;
  renderers[ctx.data.kind]?.(host, step, ctx);
}
