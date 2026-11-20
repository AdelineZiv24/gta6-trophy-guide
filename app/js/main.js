import * as store from './store.js';
import { loadTrophies } from './data.js';
import { defaultFilters, kindChips } from './filters.js';
import { renderStats, renderList, renderDetail, renderRoadmap, renderMissables, renderNext, renderAbout } from './views.js';

const views = ['checklist', 'roadmap', 'missables', 'next', 'about'];
async function boot() {
  const trophies = await loadTrophies();
  let state = store.loadState();
  const filters = { ...defaultFilters };
  const ctx = { trophies, state, store, selectedId: 28, filters, activeView: 'checklist', root: document };
  const viewRenderers = { checklist: () => { renderList(ctx); renderDetail(ctx); }, roadmap: () => renderRoadmap(ctx), missables: () => renderMissables(ctx), next: () => renderNext(ctx), about: () => renderAbout(ctx) };

  function update() {
    renderStats(ctx);
    viewRenderers[ctx.activeView]();
  }
  function showView(view, hash = true) {
    ctx.activeView = views.includes(view) ? view : 'checklist';
    for (const name of views) {
      const panel = document.querySelector(`#view-${name}`), tab = document.querySelector(`[data-view="${name}"]`);
      panel.hidden = name !== ctx.activeView;
      tab.setAttribute('aria-selected', String(name === ctx.activeView));
    }
    document.querySelector('#filters').hidden = ctx.activeView !== 'checklist';
    if (hash) { const next = `#/${ctx.activeView}`; if (location.hash !== next) location.hash = next; }
    update();
  }
  ctx.select = id => {
    ctx.selectedId = Number(id);
    showView('checklist', false);
    const next = `#/trophy/${ctx.selectedId}`;
    if (location.hash !== next) location.hash = next;
    const detail = document.querySelector('#trophy-detail');
    if (detail) detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  document.querySelectorAll('[data-view]').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
  document.querySelector('#f-search').addEventListener('input', e => { filters.query = e.target.value; update(); });
  document.querySelector('#f-grade').addEventListener('change', e => { filters.grade = e.target.value; update(); });
  document.querySelector('#f-status').addEventListener('change', e => { filters.status = e.target.value; update(); });
  document.querySelector('#f-sort').addEventListener('change', e => { filters.sort = e.target.value; update(); });
  document.querySelector('#f-hidden').addEventListener('change', e => { filters.hiddenOnly = e.target.checked; update(); });
  document.querySelector('#f-spoiler').checked = state.settings.spoiler;
  document.querySelector('#f-spoiler').addEventListener('change', e => {
    state.settings.spoiler = e.target.checked; store.saveState(); update();
  });
  function drawKinds() {
    const container = document.querySelector('#f-kinds'); container.replaceChildren();
    for (const chip of kindChips(trophies)) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = `${chip.label} ${chip.count}`;
      b.setAttribute('aria-pressed', String(filters.kind === chip.id));
      b.addEventListener('click', () => { filters.kind = chip.id; drawKinds(); update(); }); container.append(b);
    }
  }
  drawKinds();
  document.querySelector('#btn-export').addEventListener('click', () => store.exportState());
  const fileInput = document.querySelector('#file-import');
  document.querySelector('#btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    const imported = await store.importState(file); fileInput.value = '';
    if (imported) { state = store.loadState(); ctx.state = state; document.querySelector('#f-spoiler').checked = state.settings.spoiler; update(); }
    else window.alert('That progress file could not be read.');
  });
  document.querySelector('#btn-reset').addEventListener('click', () => {
    if (!window.confirm('Reset all trophy progress, counters, notes and spoiler settings in this browser?')) return;
    state = store.resetState(); ctx.state = state; document.querySelector('#f-spoiler').checked = false; update();
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault(); document.querySelector('#f-search').focus();
    } else if (e.key === 'Escape' && document.activeElement === document.querySelector('#f-search')) {
      document.querySelector('#f-search').value = ''; filters.query = ''; update();
    }
  });
  function route() {
    const hash = location.hash.replace(/^#\/?/, '');
    const trophy = hash.match(/^trophy\/(\d+)$/);
    if (trophy) {
      const id = Number(trophy[1]);
      if (trophies.some(t => t.id === id)) ctx.selectedId = id;
      showView('checklist', false);
    } else showView(hash, false);
  }
  window.addEventListener('hashchange', route);
  if (location.hash) route(); else showView('checklist');
}

if (typeof document !== 'undefined') {
  boot().catch(error => {
    const main = document.querySelector('#main');
    if (main) main.textContent = `The trophy guide could not start: ${error.message}`;
  });
}
