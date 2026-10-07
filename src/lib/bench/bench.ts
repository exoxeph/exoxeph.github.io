const bench = document.querySelector<HTMLElement>('.bench');
if (bench) {
  void import('./channels/tesla');
  const loaded = new Set<string>();
  const loaders: Record<string, () => Promise<unknown>> = {
    'ch-speech': () => import('./channels/speech'),
    'ch-rag': () => import('./channels/rag'),
    'ch-email': () => import('./channels/email'),
    'ch-research': () => import('./channels/research'),
  };
  bench.addEventListener('change', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.checked &&
      loaders[target.id] &&
      !loaded.has(target.id)
    ) {
      loaded.add(target.id);
      const id = target.id.slice(3);
      void loaders[target.id]!().then(() => {
        bench.setAttribute('data-ready-' + id, '');
        // A controller that loads mid-chapter catches up to the beat being read (beat 0 is the server-rendered frame).
        const beat = Number(bench.dataset.beat ?? 0);
        if (beat > 0 && target.checked)
          document.dispatchEvent(new CustomEvent('bench:beat', { detail: { channel: id, beat } }));
      });
    }
  });

  // Closing the inspector must never drop keyboard or screen-reader focus on the page body: it returns to whatever
  // opened it, or to that channel's Inspect button if the opener is gone. Each controller restores focus in its own way
  // (some to a stage marker, some to nothing), so this is the one place that guarantees it.
  const drawer = bench.querySelector<HTMLElement>('.inspector');
  if (drawer) {
    // `lastOutside` follows focus while the inspector is closed; the moment it opens, that element is the opener.
    let lastOutside: HTMLElement | null = null;
    let opener: HTMLElement | null = null;
    bench.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (!drawer.contains(target) && drawer.hidden) lastOutside = target;
    });
    new MutationObserver(() => {
      if (!drawer.hidden) {
        opener = lastOutside;
        return;
      }
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active && active !== document.body && !drawer.contains(active)) return;
        const fallback = [...bench.querySelectorAll<HTMLElement>('[data-inspect-channel]')].find(
          (button) => button.getClientRects().length,
        );
        const target = opener?.isConnected && opener.getClientRects().length ? opener : fallback;
        target?.focus();
      }, 0);
    }).observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
  }
}
