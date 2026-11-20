export const defaultFilters = { kind: 'all', grade: 'all', status: 'all', query: '', hiddenOnly: false, sort: 'roadmap' };
const grades = ['platinum', 'gold', 'silver', 'bronze'];
export function applyFilters(trophies, state, store) {
  const s = { ...defaultFilters, ...state };
  const query = s.query.trim().toLocaleLowerCase();
  return trophies.filter(t =>
    (s.kind === 'all' || (s.kind === 'missable' ? t.missable : s.kind !== 'online' && t.kind === s.kind)) &&
    (s.grade === 'all' || t.grade === s.grade) &&
    (s.status === 'all' || store.isEarned(t.id) === (s.status === 'earned')) &&
    (!s.hiddenOnly || t.hidden) &&
    `${t.name} ${t.description} ${t.kind}`.toLocaleLowerCase().includes(query)
  ).sort((a, b) => s.sort === 'name' ? a.name.localeCompare(b.name) :
    (s.sort === 'grade' ? grades.indexOf(a.grade) - grades.indexOf(b.grade) : a.stage - b.stage) || a.id - b.id);
}
export function kindChips(trophies) {
  return [['all', 'All'], ['story', 'Story'], ['side', 'Side quests'], ['collectibles', 'Collectibles'], ['activities', 'Activities'], ['missable', 'Missable'], ['online', 'Online']].map(([id, label]) => ({
    id, label, count: trophies.filter(t => id === 'all' || (id === 'missable' ? t.missable : id !== 'online' && t.kind === id)).length
  }));
}
