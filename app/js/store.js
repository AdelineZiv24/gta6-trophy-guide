const STORAGE_KEY = 'leonida-field-guide-v1';
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
const STAGE_NUMBERS = [1, 2, 3];
const emptyState = () => ({ v: 1, earned: {}, counters: {}, notes: {}, revealed: {}, settings: { spoiler: false } });

let state = emptyState();

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeState(value) {
  if (!isRecord(value) || !isRecord(value.earned) || !isRecord(value.counters)) return null;
  return {
    v: 1,
    earned: value.earned,
    counters: value.counters,
    notes: isRecord(value.notes) ? value.notes : {},
    revealed: isRecord(value.revealed) ? value.revealed : {},
    settings: { spoiler: Boolean(value.settings?.spoiler) }
  };
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? normalizeState(JSON.parse(stored)) : null;
    state = parsed ?? emptyState();
  } catch {
    state = emptyState();
  }
  return state;
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function resetState() {
  state = emptyState();
  saveState();
  return state;
}

export function isEarned(id) {
  return Boolean(state.earned[String(id)]);
}

export function toggleEarned(id) {
  const key = String(id);
  state.earned[key] = !state.earned[key];
  saveState();
  return state.earned[key];
}

export function setCounter(id, n) {
  const value = Number(n);
  if (!Number.isFinite(value) || value < 0) throw new TypeError('Counter must be a non-negative number');
  state.counters[String(id)] = value;
  saveState();
  return value;
}

export function getCounter(id) {
  return Number(state.counters[String(id)] ?? 0);
}

export function setNote(id, text) {
  state.notes[String(id)] = String(text);
  saveState();
  return state.notes[String(id)];
}

export function getNote(id) {
  return String(state.notes[String(id)] ?? '');
}

export function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leonida-field-guide-progress.json';
  link.click();
  URL.revokeObjectURL(url);
}

export async function importState(file) {
  try {
    const parsed = normalizeState(JSON.parse(await file.text()));
    if (!parsed) return false;
    state = parsed;
    saveState();
    return true;
  } catch {
    return false;
  }
}

export function progress(trophies) {
  const counted = trophies.filter((trophy) => trophy && trophy.id != null);
  const total = counted.length;
  const earned = counted.reduce((count, trophy) => count + Number(isEarned(trophy.id)), 0);
  const byGrade = Object.fromEntries(GRADES.map((grade) => {
    const group = counted.filter((trophy) => String(trophy.grade).toLowerCase() === grade);
    return [grade, [group.reduce((count, trophy) => count + Number(isEarned(trophy.id)), 0), group.length]];
  }));
  const byStage = Object.fromEntries(STAGE_NUMBERS.map((stage) => {
    const group = counted.filter((trophy) => Number(trophy.stage) === stage);
    return [stage, [group.reduce((count, trophy) => count + Number(isEarned(trophy.id)), 0), group.length]];
  }));
  return { earned, total, pct: total ? Math.round((earned / total) * 100) : 0, byGrade, byStage };
}

loadState();
