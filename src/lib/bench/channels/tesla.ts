import {
  accept,
  cancelRider,
  committedSeats,
  completePool,
  evaluateAccept,
  initialState,
  SIMULTANEOUS_REPLAY,
  type State,
} from '../tesla';
import { renderTesla } from '../svg';
import { add, clear, subscribe, type LogEntry } from '../engine';

const bench = document.querySelector<HTMLElement>('.bench');
if (bench) {
  const desktop = bench.querySelector<HTMLElement>('.tesla-svg.desktop')!;
  const mobile = bench.querySelector<HTMLElement>('.tesla-svg.mobile')!;
  const inspector = bench.querySelector<HTMLElement>('.inspector')!;
  const live = bench.querySelector<HTMLElement>('[data-bench-live]')!;
  const logLive = bench.querySelector<HTMLElement>('[data-log-live]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state: State = initialState();
  let seats = 2,
    decision: 200 | 409 = 409,
    lastBefore = 3,
    lastSeats = 2,
    stale = false,
    limit = false,
    simultaneous = false,
    noGuard = false;
  let selected: string | null = null,
    mode: 'replay' | 'live' = 'replay',
    refusedHint = false;
  let replayTimer: number | undefined;

  function marker() {
    return (getComputedStyle(mobile).display === 'none' ? desktop : mobile).querySelector<SVGElement>(
      '[data-guard]',
    );
  }
  function render(focus?: 'handle' | 'pool' | 'guard') {
    const frame = {
      state,
      seats,
      decision,
      lastBefore,
      lastSeats,
      stale,
      limit,
      simultaneous,
      noGuard,
      selected,
    };
    desktop.innerHTML = renderTesla(frame, false);
    mobile.innerHTML = renderTesla(frame, true);
    if (focus) {
      const scope = getComputedStyle(mobile).display === 'none' ? desktop : mobile;
      const selector =
        focus === 'handle'
          ? '[data-handle]'
          : focus === 'guard'
            ? '[data-guard]'
            : `[data-pool="${selected}"]`;
      scope.querySelector<SVGElement>(selector)?.focus();
    }
    bench!
      .querySelectorAll<HTMLElement>('.pool [data-provenance="replay"]')
      .forEach((item) => (item.hidden = mode === 'live'));
    bench!
      .querySelectorAll<HTMLElement>('.pool [data-provenance="executed"]')
      .forEach((item) => (item.hidden = mode !== 'live'));
    const prov = bench!.querySelector('.pool .provenance');
    prov
      ?.querySelector<HTMLElement>('p:not([data-executed-explain])')
      ?.toggleAttribute('hidden', mode === 'live');
    prov?.querySelector<HTMLElement>('[data-executed-explain]')?.toggleAttribute('hidden', mode !== 'live');
  }
  // The server-rendered stage has its controls stripped (they would be dead without this script); render the
  // interactive version now. The starting state is the same frame the server drew.
  render();
  function liveMode() {
    mode = 'live';
    simultaneous = false;
    noGuard = false;
  }
  function preview(value: number, focus?: 'handle') {
    seats = Math.max(1, Math.min(6, value));
    stale = true;
    liveMode();
    render(focus);
  }
  function pulse() {
    if (reduced.matches) return;
    for (const ring of bench!.querySelectorAll('.wall-ring')) {
      ring.classList.remove('pulse');
      void (ring as SVGElement).getBoundingClientRect();
      ring.classList.add('pulse');
    }
  }
  function send() {
    if (simultaneous || state.nextLetter >= 26) return;
    liveMode();
    const letter = String.fromCharCode(65 + state.nextLetter);
    const result = evaluateAccept(state, seats);
    if (!('decision' in result)) return;
    decision = result.code;
    if (result.decision === 'accepted') {
      state = accept(state, seats);
      add({
        channel: 'pool',
        title: `${letter} requests ${seats} ${seats === 1 ? 'seat' : 'seats'}`,
        detail: `accepted, ${result.after} of 3`,
        provenance: 'executed',
      });
      live.textContent = `Request ${letter}, ${seats} seats, accepted, ${result.after} of 3`;
    } else {
      add({
        channel: 'pool',
        title: `${letter} requests ${seats} ${seats === 1 ? 'seat' : 'seats'}`,
        detail: `refused, ${result.committed} of 3`,
        provenance: 'executed',
      });
      live.textContent = `Request ${letter}, ${seats} seats, refused, ${result.committed} of 3`;
      if (!refusedHint) refusedHint = true;
    }
    lastBefore = result.decision === 'accepted' ? result.before : result.committed;
    lastSeats = seats;
    stale = false;
    selected = null;
    render();
    if (decision === 200 && !reduced.matches)
      bench!
        .querySelectorAll<SVGElement>(`[data-pool="${letter}"]`)
        .forEach((pool) => pool.classList.add('new-pool'));
    if (decision === 409) pulse();
  }
  function reset() {
    window.clearTimeout(replayTimer);
    state = initialState();
    seats = 2;
    decision = 409;
    lastBefore = 3;
    lastSeats = 2;
    stale = false;
    simultaneous = false;
    noGuard = false;
    selected = null;
    mode = 'replay';
    inspector.hidden = true;
    render();
    live.textContent = 'Recorded run restored.';
  }
  function replay() {
    window.clearTimeout(replayTimer);
    mode = 'replay';
    selected = null;
    noGuard = false;
    simultaneous = true;
    decision = 200;
    stale = false;
    const finish = () => {
      state = {
        capacity: 3,
        pools: [
          { id: 'A', seats: 1, status: 'OPEN', riderCancelled: false },
          ...SIMULTANEOUS_REPLAY.requests.map((request) => ({
            id: request.id,
            seats: request.seats,
            status: 'OPEN' as const,
            riderCancelled: false,
          })),
        ],
        nextLetter: 3,
      };
      limit = true;
      render();
      add({
        channel: 'pool',
        title: 'Two requests at the same moment',
        detail: 'both accepted, 5 of 3',
        provenance: 'replay',
        limit: true,
      });
      // The test log announces this result as a limit, so the status line stays quiet here.
      live.textContent = '';
    };
    if (reduced.matches) finish();
    else {
      state = {
        capacity: 3,
        pools: [{ id: 'A', seats: 1, status: 'OPEN', riderCancelled: false }],
        nextLetter: 1,
      };
      render();
      replayTimer = window.setTimeout(() => {
        live.textContent = 'Both requests read 1 of 3.';
        replayTimer = window.setTimeout(finish, 600);
      }, 600);
    }
  }
  // Scroll beats set the stage to a canonical frame that matches the chapter text. They never write to the log.
  const pool = (id: string, n: number) => ({ id, seats: n, status: 'OPEN' as const, riderCancelled: false });
  document.addEventListener('bench:beat', (event) => {
    const { channel, beat } = (event as CustomEvent<{ channel: string; beat: number }>).detail;
    if (channel !== 'pool') return;
    window.clearTimeout(replayTimer);
    selected = null;
    simultaneous = false;
    noGuard = false;
    seats = 2;
    stale = false;
    lastSeats = 2;
    mode = beat <= 1 ? 'live' : 'replay';
    if (beat === 0) {
      state = { capacity: 3, pools: [pool('A', 1)], nextLetter: 1 };
      decision = 200;
      lastBefore = 1;
      stale = true;
    } else if (beat === 1) {
      state = initialState();
      decision = 409;
      lastBefore = 3;
      stale = true;
    } else if (beat === 2) {
      state = initialState();
      decision = 409;
      lastBefore = 3;
    } else if (beat === 3) {
      state = { capacity: 3, pools: [pool('A', 1), pool('B', 2), pool('C', 2)], nextLetter: 3 };
      decision = 200;
      noGuard = true;
    } else {
      state = {
        capacity: 3,
        pools: [pool('A', 1), ...SIMULTANEOUS_REPLAY.requests.map((r) => pool(r.id, r.seats))],
        nextLetter: 3,
      };
      decision = 200;
      simultaneous = true;
    }
    render();
  });
  bench.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('[data-reset]')) {
      reset();
      return;
    }
    if (target.closest('[data-clear]')) {
      clear();
      return;
    }
    if (target.closest('[data-replay]')) {
      replay();
      return;
    }
    if (target.closest('[data-close]')) {
      inspector.hidden = true;
      marker()?.focus();
      return;
    }
    if (target.closest('[data-guard], [data-inspect-channel="pool"]')) {
      inspector.classList.remove('speech-inspector');
      inspector.classList.remove('rag-inspector');
      inspector.setAttribute('aria-labelledby', 'inspector-title');
      inspector.querySelector<HTMLElement>('[data-tesla-inspector]')!.hidden = false;
      inspector.querySelector<HTMLElement>('[data-speech-inspector]')!.hidden = true;
      inspector.querySelector<HTMLElement>('[data-rag-inspector]')!.hidden = true;
      inspector.querySelector<HTMLElement>('[data-email-inspector]')!.hidden = true;
      inspector.classList.remove('email-inspector');
      inspector.hidden = false;
      inspector.focus();
      return;
    }
    if (target.closest('[data-send]')) {
      send();
      return;
    }
    const pool = target.closest<SVGElement>('[data-pool]');
    if (pool) {
      selected = pool.dataset.pool ?? null;
      render('pool');
      return;
    }
    const complete = target.closest<HTMLElement>('[data-complete]');
    if (complete) {
      const id = complete.dataset.complete!;
      state = completePool(state, id);
      liveMode();
      selected = null;
      stale = true;
      add({
        channel: 'pool',
        title: `Pool ${id} completed`,
        detail: `seats freed, ${committedSeats(state)} of 3`,
        provenance: 'model',
      });
      live.textContent = `Pool ${id} completed, seats freed, ${committedSeats(state)} of 3`;
      render();
      return;
    }
    const cancel = target.closest<HTMLElement>('[data-cancel]');
    if (cancel) {
      const id = cancel.dataset.cancel!;
      state = cancelRider(state, id);
      liveMode();
      selected = null;
      stale = true;
      add({
        channel: 'pool',
        title: `Rider ${id} cancelled`,
        detail: `seats not released, ${committedSeats(state)} of 3`,
        provenance: 'model',
        limit: true,
      });
      live.textContent = `Rider ${id} cancelled, seats not released, ${committedSeats(state)} of 3`;
      render();
      return;
    }
  });
  bench.addEventListener('keydown', (event) => {
    const target = event.target as Element;
    if (event.key === 'Escape') {
      if (!inspector.hidden && !inspector.classList.contains('speech-inspector')) {
        inspector.hidden = true;
        marker()?.focus();
      } else if (selected) {
        selected = null;
        render();
      }
      return;
    }
    if (target.closest('[data-handle]')) {
      let next = seats;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next++;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next--;
      else if (event.key === 'Home') next = 1;
      else if (event.key === 'End') next = 6;
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        send();
        return;
      } else return;
      event.preventDefault();
      preview(next, 'handle');
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && target.closest('[role="button"]')) {
      event.preventDefault();
      (target.closest('[role="button"]') as Element).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    }
  });
  bench.addEventListener('pointerdown', (event) => {
    const handle = (event.target as Element).closest<SVGElement>('[data-handle]');
    if (!handle) return;
    const capture = bench.querySelector<HTMLElement>('.tesla-stage')!;
    capture.setPointerCapture(event.pointerId);
    const svg = handle.ownerSVGElement!;
    const start = event.clientX,
      original = seats;
    const unit =
      svg.getBoundingClientRect().width /
      (svg.viewBox.baseVal.width / (svg.classList.contains('m') ? 48 : 110));
    let pending: number | undefined;
    let animation: number | undefined;
    const flush = () => {
      if (animation !== undefined) cancelAnimationFrame(animation);
      animation = undefined;
      const next = pending;
      pending = undefined;
      if (next === undefined || next === seats) return;
      preview(next);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      const next = Math.max(1, Math.min(6, original + Math.round((ev.clientX - start) / unit)));
      // A return to the current value supersedes any queued move.
      pending = next;
      if (next === seats) {
        pending = undefined;
        if (animation !== undefined) cancelAnimationFrame(animation);
        animation = undefined;
        return;
      }
      if (animation === undefined) animation = requestAnimationFrame(flush);
    };
    const end = () => {
      // Apply the last move before subsequent actions or drags.
      flush();
      bench.removeEventListener('pointermove', move);
      bench.removeEventListener('pointerup', end);
      bench.removeEventListener('pointercancel', end);
    };
    bench.addEventListener('pointermove', move);
    bench.addEventListener('pointerup', end);
    bench.addEventListener('pointercancel', end);
  });
  const visitor = bench.querySelector<HTMLOListElement>('.visitor-entries')!;
  // The log announces only a documented limit, only when it is new this session (not when stored entries are restored
  // on load), and only once: every other result is already announced by the channel's own status line.
  let lastLogged: number | null = null;
  subscribe((entries) => {
    if (!limit && entries.some((entry) => entry.limit && entry.provenance === 'replay')) {
      limit = true;
      render();
    }
    visitor.replaceChildren(
      ...[...entries].reverse().map((entry: LogEntry) => {
        const li = document.createElement('li');
        li.className = 'ent';
        const index = document.createElement('span');
        index.className = 'entry-index';
        index.textContent = String(3 + entry.n).padStart(2, '0');
        const content = document.createElement('div');
        const title = document.createElement('b');
        title.textContent = entry.title;
        const detail = document.createElement('span');
        detail.textContent = entry.detail;
        const tag = document.createElement('span');
        tag.className = `tag ${entry.provenance}`;
        tag.innerHTML = '<i aria-hidden="true"></i>';
        tag.append(
          document.createTextNode(
            entry.provenance === 'executed'
              ? 'Runs in browser'
              : entry.provenance === 'replay'
                ? 'Recorded project run'
                : 'Modelled from the code',
          ),
        );
        content.append(title, detail, tag);
        if (entry.limit) {
          const flag = document.createElement('span');
          flag.className = 'entry-limit';
          flag.textContent = 'limit found';
          content.append(flag);
        }
        li.append(index, content);
        return li;
      }),
    );
    bench.querySelector<HTMLElement>('[data-empty]')!.hidden = entries.length > 0;
    bench.querySelector<HTMLElement>('[data-clear]')!.hidden = entries.length === 0;
    const latest = entries.at(-1);
    if (lastLogged === null) lastLogged = latest?.n ?? 0;
    else if (!latest) lastLogged = 0;
    else if (latest.n !== lastLogged) {
      lastLogged = latest.n;
      if (latest.limit) logLive.textContent = `Limit found. ${latest.title}, ${latest.detail}.`;
    }
  });
}
