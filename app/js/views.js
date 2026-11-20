import { KINDS, STAGES } from './data.js';
import { applyFilters } from './filters.js';
import { nextUp } from './planner.js';

const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function guideSteps(text) {
  const list = el('ol', null, 'guide-steps');
  const sentences = String(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  for (const sentence of sentences.length ? sentences : [String(text)]) {
    const item = el('li', null, 'guide-step');
    item.append(el('span', sentence));
    list.append(item);
  }
  return list;
}
function root(ctx, id) { const node = (ctx.root || document).querySelector(`#${id}`); node.replaceChildren(); return node; }
function button(text, action) {
  const node = el('button', text, 'button'); node.type = 'button';
  node.addEventListener('click', event => { event.stopPropagation(); action(); }); return node;
}
function masked(ctx, t) { return ctx.state.settings.spoiler && t.kind === 'story' && !ctx.store.isEarned(t.id) && !ctx.state.revealed[t.id]; }
function name(ctx, t) { return masked(ctx, t) ? 'Hidden story trophy' : t.name; }
function description(ctx, t) { return masked(ctx, t) ? 'Earn this story trophy to reveal its name and description.' : t.description; }
function card(parent) {
  const node = el('article', null, 'trophy-card');
  Object.assign(node.style, { padding: '16px', marginBottom: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)' });
  parent.append(node); return node;
}
function medal(t) {
  const node = el('span', null, `medal medal-${t.grade}`);
  const disc = el('span', t.grade[0].toUpperCase());
  Object.assign(disc.style, { display: 'inline-grid', placeItems: 'center', width: '26px', height: '26px', borderRadius: '50%', background: `var(--${t.grade})`, color: '#fff', marginRight: '5px' });
  node.append(disc, document.createTextNode(titleCase(t.grade))); return node;
}
function badges(t) {
  const row = el('div', null, 'badges');
  const labels = [[KINDS.find(k => k.id === t.kind)?.label || t.kind, 'var(--muted)']];
  if (t.hidden) labels.push(['HIDDEN', 'var(--muted)']);
  if (t.missable) labels.push(['MISSABLE', 'var(--missable)']);
  if (t.status !== 'confirmed') labels.push([t.status.toUpperCase(), t.status === 'reported' ? '#946000' : 'var(--muted)']);
  labels.push([`Stage ${t.stage}`, 'var(--muted)']);
  for (const [label, color] of labels) { const badge = el('span', label); Object.assign(badge.style, { color, marginRight: '10px', fontSize: '11px', fontWeight: '700' }); row.append(badge); }
  return row;
}
function checkbox(ctx, t) {
  const input = el('input'); input.type = 'checkbox'; input.checked = ctx.store.isEarned(t.id); input.setAttribute('aria-label', `Mark ${name(ctx, t)} earned`);
  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('change', () => { ctx.store.toggleEarned(t.id); ctx.update(); }); return input;
}
function counter(ctx, t, detailed = false) {
  const block = el('div', null, detailed ? 'counter counter-detailed' : 'counter');
  block.append(el('span', `${detailed ? 'Your progress: ' : ''}${ctx.store.getCounter(t.id)} / ${t.count} ${t.countLabel}`));
  if (detailed) {
    const bar = el('div', null, 'counter-bar'), fill = el('div', null, 'counter-fill');
    fill.style.width = `${t.count ? Math.round(ctx.store.getCounter(t.id) / t.count * 100) : 0}%`;
    bar.append(fill); block.append(bar);
  }
  const set = n => { ctx.store.setCounter(t.id, Math.max(0, Math.min(t.count, n))); ctx.update(); };
  for (const [label, delta] of [['−', -1], ['+', 1]]) { const b = button(label, () => set(ctx.store.getCounter(t.id) + delta)); b.setAttribute('aria-label', `${delta < 0 ? 'Decrease' : 'Increase'} ${name(ctx, t)} progress`); block.append(b); }
  if (detailed) block.append(button('Mark complete', () => set(t.count)));
  return block;
}
function sources(parent, list) {
  const panel = el('div', null, 'sources-panel');
  panel.append(el('h3', 'Sources — where the facts come from'));
  const ul = el('ol', null, 'sources-list');
  for (const source of list) {
    const li = el('li');
    if (source.url && /^https?:\/\//i.test(source.url)) { const a = el('a', source.name); a.href = source.url; a.target = '_blank'; a.rel = 'noopener'; li.append(a); }
    else li.textContent = source.name;
    ul.append(li);
  }
  panel.append(ul); parent.append(panel);
}
export function renderStats(ctx) {
  const p = ctx.store.progress(ctx.trophies), scope = ctx.root || document;
  scope.querySelector('#stat-earned').textContent = p.earned;
  scope.querySelector('#stat-pct').textContent = `${p.pct}%`;
  scope.querySelector('#stat-grades').textContent = Object.entries(p.byGrade).map(([grade, [earned, total]]) => `${titleCase(grade)} ${earned}/${total}`).join(' · ');
  scope.querySelector('#stat-stages').textContent = Object.entries(p.byStage).map(([stage, [earned, total]]) => `Stage ${stage} · ${earned}/${total}`).join(' — ');
  const bar = scope.querySelector('#stage-bar'); bar.style.display = 'flex';
  [...bar.children].forEach((segment, i) => { const [earned, total] = p.byStage[i + 1]; segment.style.flex = `0 0 ${p.total ? earned / p.total * 100 : 0}%`; segment.title = `Stage ${i + 1}: ${earned}/${total}`; });
  bar.setAttribute('aria-label', scope.querySelector('#stat-stages').textContent);
}
export function renderList(ctx) {
  const list = root(ctx, 'trophy-list'), visible = applyFilters(ctx.trophies, ctx.filters, ctx.store);
  (ctx.root || document).querySelector('#f-showing').textContent = `Showing ${visible.length} of ${ctx.trophies.length}`;
  const scope = ctx.root || document;
  let strip = scope.querySelector('#next-strip');
  if (!strip) {
    strip = el('div', null, 'next-strip'); strip.id = 'next-strip';
    scope.querySelector('#view-checklist').prepend(strip);
  }
  strip.replaceChildren(el('strong', 'Next up:'));
  strip.hidden = Boolean(ctx.filters.query.trim());
  for (const t of nextUp(ctx.trophies, ctx.store, 3)) {
    const chip = button('', () => ctx.select(t.id));
    chip.title = t.reason;
    chip.append(el('strong', name(ctx, t)), el('span', t.reason));
    strip.append(chip);
  }
  let stage;
  for (const t of visible) {
    if (ctx.filters.sort === 'roadmap' && stage !== t.stage) {
      stage = t.stage; const group = ctx.trophies.filter(x => x.stage === stage);
      list.append(el('h2', `${STAGES.find(s => s.n === stage).name} · ${group.filter(x => ctx.store.isEarned(x.id)).length}/${group.length} earned`));
    }
    const row = card(list), earned = ctx.store.isEarned(t.id);
    row.classList.add('trophy-row'); row.classList.toggle('earned', earned); row.classList.toggle('selected', ctx.selectedId === t.id);
    const copy = el('div', null, 'row-copy');
    const summary = el('div', null, 'row-summary');
    summary.append(el('h3', name(ctx, t)), el('p', description(ctx, t)));
    const meta = el('div', null, 'row-meta'); meta.append(badges(t));
    if (t.count) meta.append(counter(ctx, t));
    copy.append(summary, meta);
    row.tabIndex = 0; row.append(checkbox(ctx, t), medal(t), copy);
    row.addEventListener('click', () => ctx.select(t.id));
    row.addEventListener('keydown', e => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctx.select(t.id); } });
  }
  if (!visible.length) list.append(el('p', 'No trophies match these filters.'));
}
export function renderDetail(ctx) {
  const pane = root(ctx, 'trophy-detail'), t = ctx.trophies.find(t => t.id === ctx.selectedId);
  if (!t) { pane.append(el('p', 'Select a trophy to read its guide.')); return; }
  const content = card(pane);
  content.append(el('h2', name(ctx, t)));
  if (masked(ctx, t)) content.append(button('Reveal this trophy', () => { ctx.state.revealed[t.id] = true; ctx.store.saveState(); ctx.update(); }));
  const badgeRow = el('div', null, 'detail-badges'); badgeRow.append(medal(t), badges(t));
  content.append(badgeRow, el('h3', 'OFFICIAL DESCRIPTION — as PlayStation publishes it'), el('blockquote', description(ctx, t)));
  if (t.missable) content.append(el('p', 'Missable — possibly. Read the Chapter 1 note in the guide before you finish Chapter 1.', 'missable-warning'));
  if (t.count) content.append(counter(ctx, t, true));
  content.append(el('h3', "GUIDE — IN THIS APP'S OWN WORDS"), guideSteps(t.guide));
  sources(content, t.sources);
  const facts = el('div', null, 'detail-facts');
  for (const [label, value] of [['DIFFICULTY', `${t.difficulty} / 5`], ['TIME', t.time]]) { const box = el('div'); box.append(el('h3', label), el('p', value)); facts.append(box); }
  content.append(facts);
  const label = el('label', 'Personal notes'); const notes = el('textarea'); notes.value = ctx.store.getNote(t.id); notes.rows = 3; notes.style.width = '100%';
  notes.addEventListener('input', () => { const start = notes.selectionStart, end = notes.selectionEnd; ctx.store.setNote(t.id, notes.value); ctx.update(); const replacement = (ctx.root || document).querySelector('#trophy-detail textarea'); if (replacement) { replacement.focus(); replacement.setSelectionRange(start, end); } }); label.append(notes); content.append(label);
  content.append(button(ctx.store.isEarned(t.id) ? 'Mark unearned' : 'Mark earned', () => { ctx.store.toggleEarned(t.id); ctx.update(); }));
  const ordered = [...ctx.trophies].sort((a, b) => a.id - b.id), index = ordered.findIndex(x => x.id === t.id);
  for (const [text, offset] of [['Prev', -1], ['Next', 1]]) { const target = ordered[index + offset], b = button(text, () => ctx.select(target.id)); b.disabled = !target; content.append(b); }
}
export function renderRoadmap(ctx) {
  const view = root(ctx, 'view-roadmap');
  for (const stage of STAGES) {
    const c = card(view), group = ctx.trophies.filter(t => t.stage === stage.n), earned = group.filter(t => ctx.store.isEarned(t.id)).length;
    c.append(el('h2', stage.name), el('p', stage.hours), el('p', stage.blurb));
    const progress = el('progress'); progress.max = group.length; progress.value = earned; progress.setAttribute('aria-label', `${stage.name} progress`); c.append(progress, el('span', ` ${earned}/${group.length}`));
    for (const t of group) { const row = el('div'); const label = el('label'); label.append(checkbox(ctx, t), document.createTextNode(` ${name(ctx, t)}`)); row.append(label); c.append(row); }
  }
  card(view).append(el('h2', 'Vice Got a Price! — pops when the other 54 are earned'));
  view.append(el('h2', 'How this roadmap is built'), el('p', "The official descriptions and the launch guides’ consensus shape this route. PowerPyx and GTABase put the story first: there is no mission replay, and one Chapter 1 moment can be missed. The checklist comes second because its thresholds ask for about 60% of everything, leaving room to choose your activities. Cleanup comes last so you can focus on what your playthrough has left unfinished."));
}
export function renderMissables(ctx) {
  const view = root(ctx, 'view-missables'); view.append(el('h2', 'Missables & watch-outs'));
  for (const t of ctx.trophies.filter(t => t.missable)) { const c = card(view); c.style.borderColor = 'var(--missable)'; c.append(el('h3', name(ctx, t)), el('p', description(ctx, t)), el('p', t.guide)); sources(c, t.sources); }
  view.append(el('h3', 'Watch-outs')); const ul = el('ul');
  const unconfirmed = ctx.trophies.filter(t => t.status === 'unconfirmed').map(t => `${t.name} (${t.sources.map(s => s.name.split(' — ')[0]).join(' + ')})`).join('; ');
  for (const text of [
    'No mission replay — keep a manual save at the start of every chapter (PowerPyx + GTABase).',
    'Cheats disable trophies and saving for the session (GTABase + TechWiser).',
    'Stranger chains may have story-progress windows — start each strand when it appears (TechWiser, single source).',
    `Five trophies are still UNCONFIRMED: ${unconfirmed}. We flag these rather than invent steps.`,
    'Actions Speak Louder: pushing a Criminal Profile to “Irredeemable” is permanent — read before grinding (PowerPyx + GTABase).'
  ]) ul.append(el('li', text)); view.append(ul);
}
export function renderNext(ctx) {
  const view = root(ctx, 'view-next'); view.append(el('h2', 'Next up'));
  for (const t of nextUp(ctx.trophies, ctx.store)) { const c = card(view); c.append(el('h3', name(ctx, t)), medal(t), el('p', t.reason)); if (t.count) c.append(el('p', `${ctx.store.getCounter(t.id)} / ${t.count} ${t.countLabel}`)); c.append(button('Open guide', () => ctx.select(t.id))); }
  if (ctx.trophies.every(t => ctx.store.isEarned(t.id))) view.append(el('p', 'All trophies earned. Your field guide is complete!'));
}
export function renderAbout(ctx) {
  const view = root(ctx, 'view-about');
  view.append(el('h2', 'About Leonida Field Guide'), el('p', 'An unofficial, offline trophy checklist, roadmap and personal planner for Grand Theft Auto VI on PlayStation 5.'),
    el('h3', 'Your progress'), el('p', 'Progress, counters, personal notes and spoiler settings use localStorage in this browser only. Export downloads a JSON file; Import restores it. Keep an export to move browsers or protect your notes before clearing browser storage.'),
    el('h3', 'Sources — checked 19 November 2026'));
  const unique = new Map(); for (const t of ctx.trophies) for (const s of t.sources) unique.set(`${s.name}|${s.url || ''}`, s);
  sources(view, [...unique.values()]);
  view.append(el('h3', 'Our honesty note'), el('p', 'Guides are this app’s own words. Facts are cited per trophy; anything not confirmed by two sources is labelled reported or unconfirmed. Official names and descriptions are shown as PlayStation publishes them. There is no Rockstar artwork or logos anywhere. This app is not affiliated with Rockstar Games or PlayStation.'));
}
