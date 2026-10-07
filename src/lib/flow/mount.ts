import { mountFlow } from './player';
import { registerRenderer } from './render';
import type { FlowData } from './types';

// Case-study flow: reads the JSON the server embedded, loads the one renderer this project needs, then mounts the
// player. The written version of the flow is already on the page, so this is an enhancement, never a requirement.
const host = document.querySelector<HTMLElement>('[data-flow]');
const json = document.querySelector('[data-flow-json]');
if (host && json?.textContent) {
  const { data, nodes } = JSON.parse(json.textContent) as {
    data: FlowData;
    nodes: Parameters<typeof mountFlow>[2];
  };
  const loaders: Partial<
    Record<FlowData['kind'], () => Promise<{ default: Parameters<typeof registerRenderer>[1] }>>
  > = {
    rag: () => import('./render-rag'),
    speech: () => import('./render-speech'),
    pool: () => import('./render-pool'),
  };
  const load = loaders[data.kind];
  (load ? load().then((m) => registerRenderer(data.kind, m.default)) : Promise.resolve()).then(() => {
    mountFlow(host, data, nodes);
    document.querySelector('.cf-text')?.removeAttribute('open');
  });
}
