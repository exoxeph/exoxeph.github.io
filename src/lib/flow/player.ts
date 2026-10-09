import { h } from './dom';
import { renderVisual } from './render';
import { stageStates } from './states';
import { PROV_LABEL, type FlowData, type FlowScenario, type FlowStep, type Prov } from './types';

type NodeInfo = {
  label: string;
  role: string;
  why?: string;
  io?: { in: string; out: string };
  decision?: string;
  failure?: string;
  control?: string;
  limitation?: string;
  source?: string;
  evidence?: { state: string; text: string; caveat?: string }[];
};

const PROV_ORDER: Prov[] = ['executed', 'recorded', 'modelled'];
const INTERVAL = 2400;

export function mountFlow(host: HTMLElement, data: FlowData, nodes: Record<string, NodeInfo>) {
  let scen: FlowScenario = data.scenarios[0]!;
  let index = 0;
  let inspecting = false;
  let timer = 0;

  const uid = `cf-${data.kind}`;
  const live = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const visual = h('div', { class: `cf-visual fv-${data.kind}`, 'aria-hidden': 'true' });
  const rail = h('ol', { class: 'cf-rail', 'aria-label': 'Stages of the system' });
  const scenBox = h('div', { class: 'cf-scen', role: 'group', 'aria-label': 'Scenario' });
  const legend = h(
    'ul',
    { class: 'cf-legend', 'aria-label': 'Where each step comes from' },
    ...PROV_ORDER.map((p) =>
      h('li', { class: `prov-${p}` }, h('i', { 'aria-hidden': 'true' }), PROV_LABEL[p]),
    ),
  );
  const count = h('p', { class: 'cf-count' });
  const title = h('h3', { class: 'cf-title' });
  const questions = h('dl', { class: 'cf-q' });
  const provNote = h('p', { class: 'cf-provnote' });
  const inspector = h('div', { class: 'cf-inspector', id: `${uid}-inspector`, hidden: true });
  const progress = h('div', { class: 'cf-progress', 'aria-hidden': 'true' });

  const btn = (label: string, cls = 'btn') => h('button', { type: 'button', class: cls, text: label });
  const bPlay = btn('Play', 'btn solid');
  bPlay.setAttribute('aria-pressed', 'false');
  const bBack = btn('Back');
  const bStep = btn('Step');
  const bReset = btn('Reset');
  const bInspect = btn('Inspect');
  bInspect.setAttribute('aria-pressed', 'false');
  bInspect.setAttribute('aria-controls', `${uid}-inspector`);
  const controls = h(
    'div',
    { class: 'cf-controls', role: 'group', 'aria-label': 'Playback' },
    bPlay,
    bBack,
    bStep,
    bReset,
    bInspect,
  );
  const foot = h('p', { class: 'cf-foot', text: data.footnote });

  host.replaceChildren(
    h('div', { class: 'cf-top' }, scenBox, legend),
    rail,
    h(
      'div',
      { class: 'cf-stage' },
      visual,
      h('div', { class: 'cf-read' }, progress, count, title, questions, provNote),
    ),
    inspector,
    controls,
    foot,
    live,
  );
  host.classList.add('is-live');

  const step = (): FlowStep => scen.steps[index]!;

  const pause = () => {
    window.clearInterval(timer);
    timer = 0;
    bPlay.textContent = 'Play';
    bPlay.setAttribute('aria-pressed', 'false');
  };
  const play = () => {
    if (index >= scen.steps.length - 1) go(0, true);
    bPlay.textContent = 'Pause';
    bPlay.setAttribute('aria-pressed', 'true');
    timer = window.setInterval(() => {
      if (index >= scen.steps.length - 1) return pause();
      go(index + 1);
    }, INTERVAL);
  };

  function lit(nodeId?: string) {
    document.querySelectorAll('[data-arch-node].is-lit').forEach((el) => el.classList.remove('is-lit'));
    if (nodeId && inspecting) document.querySelector(`[data-arch-node="${nodeId}"]`)?.classList.add('is-lit');
  }

  function fillInspector(s: FlowStep) {
    const n = s.node ? nodes[s.node] : undefined;
    const rows: [string, string | HTMLElement][] = [];
    if (n) {
      rows.push(['Role', n.role]);
      if (n.io) rows.push(['Input', n.io.in], ['Output', n.io.out]);
      if (n.why) rows.push(['Why it exists', n.why]);
      if (n.decision) rows.push(['Decision', n.decision]);
      if (n.control) rows.push(['Control', n.control]);
      if (n.failure) rows.push(['Failure mode', n.failure]);
    }
    for (const f of s.extra ?? []) rows.push([f.k, f.v]);
    if (n?.limitation) rows.push(['Limitation', n.limitation]);
    if (n?.evidence?.length)
      rows.push([
        'Evidence',
        h(
          'ul',
          {},
          ...n.evidence.map((e) => h('li', { text: `${e.text}${e.caveat ? ` ${e.caveat}` : ''}` })),
        ),
      ]);
    rows.push(['Provenance', `${PROV_LABEL[s.prov]}. ${s.provNote}`]);
    if (n?.source) rows.push(['Source', n.source]);
    inspector.replaceChildren(
      h(
        'div',
        { class: 'cf-ihead' },
        h('p', { class: 'cf-ik', text: 'Inspector' }),
        h('p', { class: 'cf-it', text: n ? n.label : s.title }),
      ),
      h(
        'dl',
        {},
        ...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', {}, typeof v === 'string' ? v : v)]),
      ),
      ...(s.node
        ? [
            h(
              'p',
              { class: 'cf-ilink' },
              h('a', { href: `#arch-${s.node}`, text: 'Open this component in the architecture \u2193' }),
            ),
          ]
        : []),
    );
  }

  function draw(announce: boolean) {
    const s = step();
    const states = stageStates(data, scen, index);
    // Scenario switch
    scenBox.replaceChildren(
      ...data.scenarios.map((sc) => {
        const b = h('button', {
          type: 'button',
          class: `cf-scbtn${sc.id === scen.id ? ' on' : ''}${sc.moment ? ' moment' : ''}`,
          'aria-pressed': sc.id === scen.id ? 'true' : 'false',
          title: sc.blurb,
          text: sc.label,
        });
        b.addEventListener('click', () => {
          pause();
          scen = sc;
          go(0, true);
        });
        return b;
      }),
    );
    // Stage rail
    rail.replaceChildren(
      ...data.stages.map((st, i) => {
        const first = scen.steps.findIndex((x) => x.stage === st.id);
        const b = h(
          'button',
          {
            type: 'button',
            class: 'cf-stbtn',
            disabled: first < 0,
            'aria-current': states[st.id] === 'active' ? 'step' : undefined,
          },
          h('b', { text: String(i + 1) }),
          h('span', { text: st.label }),
        );
        if (first >= 0)
          b.addEventListener('click', () => {
            pause();
            go(first);
          });
        return h('li', { class: `st-${states[st.id]}` }, b);
      }),
    );
    const stageName = data.stages.find((x) => x.id === s.stage)?.label ?? s.stage;
    count.replaceChildren(
      `Step ${index + 1} of ${scen.steps.length}  \u00b7  ${stageName}  `,
      h('span', { class: `cf-prov prov-${s.prov}` }, h('i', { 'aria-hidden': 'true' }), PROV_LABEL[s.prov]),
    );
    title.textContent = s.title;
    title.className = `cf-title tone-${s.tone ?? 'neutral'}`;
    questions.replaceChildren(
      ...(
        [
          ['What came in', s.came],
          ['What acted', s.acted],
          ['What it decided', s.decided],
          ['What changed', s.changed],
          ['What happens next', s.next],
        ] as const
      ).flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]),
    );
    provNote.textContent = s.provNote;
    progress.replaceChildren(
      ...scen.steps.map((_, i) => h('i', { class: i === index ? 'on' : i < index ? 'past' : '' })),
    );
    bBack.disabled = index === 0;
    bStep.disabled = index >= scen.steps.length - 1;
    renderVisual(visual, { data, scenario: scen, index });
    if (inspecting) fillInspector(s);
    lit(s.node);
    if (announce)
      live.textContent = `Step ${index + 1} of ${scen.steps.length}: ${s.title}. ${s.decided} ${PROV_LABEL[s.prov]}.`;
  }

  function go(next: number, announce = false) {
    index = Math.max(0, Math.min(next, scen.steps.length - 1));
    draw(true || announce);
  }

  bPlay.addEventListener('click', () => (timer ? pause() : play()));
  bStep.addEventListener('click', () => {
    pause();
    go(index + 1);
  });
  bBack.addEventListener('click', () => {
    pause();
    go(index - 1);
  });
  bReset.addEventListener('click', () => {
    pause();
    go(0);
  });
  bInspect.addEventListener('click', () => {
    inspecting = !inspecting;
    bInspect.setAttribute('aria-pressed', String(inspecting));
    bInspect.setAttribute('aria-expanded', String(inspecting));
    inspector.hidden = !inspecting;
    if (inspecting) fillInspector(step());
    lit(step().node);
  });
  document.addEventListener('visibilitychange', () => document.hidden && pause());

  draw(false);
}
