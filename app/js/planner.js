export function nextUp(trophies, store, n = 5) {
  const underway = t => t.count && store.getCounter(t.id) > 0 && store.getCounter(t.id) < t.count;
  const priority = t => t.missable ? 0 : underway(t) ? 1 : 2;
  return trophies.filter(t => !store.isEarned(t.id)).sort((a, b) => priority(a) - priority(b) || a.stage - b.stage || a.id - b.id).slice(0, n).map(t => ({
    ...t,
    reason: t.missable ? 'Missable — do the Chapter 1 session before the chapter ends' : underway(t)
      ? `Counter under way: ${store.getCounter(t.id)} / ${t.count} ${t.countLabel}`
      : `Next on the roadmap (Stage ${t.stage})`
  }));
}
