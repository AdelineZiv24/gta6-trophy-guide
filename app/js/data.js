export async function loadTrophies() {
  const response = await fetch('data/trophies.json');
  if (!response.ok) throw new Error(`Could not load trophy data (${response.status})`);
  const data = await response.json();
  const trophies = Array.isArray(data) ? data : data.trophies;
  if (!Array.isArray(trophies)) throw new TypeError('Trophy data must contain a trophies array');
  return trophies;
}

export const KINDS = [
  { id: 'story', label: 'Story' },
  { id: 'side', label: 'Side quests' },
  { id: 'collectibles', label: 'Collectibles' },
  { id: 'activities', label: 'Activities' },
  { id: 'platinum', label: 'Platinum' }
];

export const STAGES = [
  {
    n: 1,
    name: 'Stage 1 — Story first',
    hours: '60–80 hours',
    blurb: 'Play the story and its stranger chains, do the Chapter 1 meditation, and scan as you travel.'
  },
  {
    n: 2,
    name: 'Stage 2 — The 100% checklist',
    hours: '~100 hours',
    blurb: 'Work the 100% Completion checklist — its thresholds are lenient, and most trophies live here.'
  },
  {
    n: 3,
    name: 'Stage 3 — Cleanup',
    hours: '~10 hours',
    blurb: 'Sweep the one-off trophies, the money totals, and the platinum itself.'
  }
];

export function gradeOf(trophy) {
  return String(trophy?.grade ?? '').toLowerCase();
}

export function isCounted(trophy) {
  return ['platinum', 'gold', 'silver', 'bronze'].includes(gradeOf(trophy));
}
