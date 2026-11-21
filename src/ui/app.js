// Controller: turns DOM events into cell writes, then re-renders from the cells.
// The only module that touches the DOM globals, storage and WebRTC together.
import { BRAND_ORDER, BRANDS } from '../config/brands.js';
import { COLORS } from '../config/colors.js';
import { TYPOGRAPHY } from '../config/typography.js';
import { STRINGS } from '../strings/th.js';
import { loadCells, saveCells } from '../integrations/storage.js';
import * as sync from '../integrations/peer-sync.js';
import { deriveState, mergeCells, setCell } from '../logic/cells.js';
import { buildView, ownersFor } from '../logic/view-model.js';
import { buildSummaryText } from '../logic/bill-text.js';
import { renderBody, renderClear, renderShare } from './render.js';

const root = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastEl = document.getElementById('toast');

const ui = {
  target: null, // person-mode counting target; device-local, not shared
  taxOpen: false,
  clearOpen: false,
  share: {
    open: false,
    tab: 'host',
    status: 'idle',
    invite: '',
    reply: '',
    inviteDraft: '',
    replyDraft: '',
    busy: false,
    error: '',
  },
};

let cells = loadCells();
let session = null; // { send, close, acceptReply? } for the active share connection

const randomId = (len) => Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
const newPersonId = () => `p_${randomId(8)}`;
const newExtraId = () => `${Date.now().toString(36)}${randomId(4)}`;
const cellsKey = {
  brandField: (b, f) => `brand:${b}:${f}`,
  plate: (b, owner, plate) => `brand:${b}:plate:${owner}:${plate}`,
  extra: (b, id) => `brand:${b}:extra:${id}`,
  person: (id) => `person:${id}`,
};

const state = () => deriveState(cells);

// Person mode counts into one owner at a time. Falls back to the first person.
function currentOwner(s) {
  if (s.mode === 'table') return 'table';
  if (!ownersFor(s).includes(ui.target)) ui.target = s.people[0]?.id ?? 'shared';
  return ui.target;
}

const extrasOwner = (s) => (s.mode === 'table' ? 'table' : currentOwner(s));

function currentView() {
  const s = state();
  return buildView(s, currentOwner(s));
}

function applyTokens(brandId) {
  const style = document.documentElement.style;
  for (const [name, hex] of Object.entries(COLORS.PLATE)) style.setProperty(`--plate-${name}`, hex);
  for (const id of BRAND_ORDER) {
    const t = COLORS.BRAND[BRANDS[id].theme];
    style.setProperty(`--brand-${id}-primary`, t.primary);
  }
  const current = COLORS.BRAND[BRANDS[brandId].theme];
  style.setProperty('--brand-primary', current.primary);
  style.setProperty('--brand-soft', current.soft);
  style.setProperty('--brand-border', current.border);
  style.setProperty('--font-sans', TYPOGRAPHY.FONT_STACK);
  for (const [name, size] of Object.entries(TYPOGRAPHY)) {
    if (name !== 'FONT_STACK') style.setProperty(`--${name.toLowerCase().replace(/_/g, '-')}`, size);
  }
  for (const [name, hex] of Object.entries(COLORS)) {
    if (typeof hex === 'string') style.setProperty(`--${name.toLowerCase().replace(/_/g, '-')}`, hex);
  }
}

function render() {
  const s = state();
  const view = buildView(s, currentOwner(s));
  applyTokens(s.brandId);
  root.innerHTML = renderBody(s, view, ui);
  modalRoot.innerHTML = [
    ui.share.open ? renderShare(ui.share, Boolean(session)) : '',
    ui.clearOpen ? renderClear(BRANDS[s.brandId]) : '',
  ].join('');
  document.title = `${STRINGS.APP_TITLE} • ${BRANDS[s.brandId].shortName}`;
}

let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
}

// One place that writes cells: stores locally, pushes to the connected device, re-renders.
function commit(changes) {
  const now = Date.now();
  cells = changes.reduce((acc, [key, value]) => setCell(acc, key, value, now), cells);
  saveCells(cells);
  session?.send(cells);
  render();
}

function applyRemote(remote) {
  const result = mergeCells(cells, remote);
  if (result.rejected > 0) toast(STRINGS.TOAST_REJECTED(result.rejected));
  if (result.changed) {
    cells = result.cells;
    saveCells(cells);
    toast(STRINGS.TOAST_SYNCED);
    render();
  }
}

function shareHooks() {
  return {
    getCells: () => cells,
    onCells: applyRemote,
    onRejected: () => toast(STRINGS.TOAST_REJECTED(1)),
    onStatus: (status) => {
      if (status === 'connected') ui.share.status = 'connected';
      else if (status === 'failed' || status === 'closed') {
        session?.close();
        session = null;
        ui.share.status = status === 'failed' ? 'failed' : 'idle';
      } else ui.share.status = status;
      render();
    },
  };
}

function addExtra(name, price, qty) {
  const s = state();
  const brandId = s.brandId;
  const owner = extrasOwner(s);
  const existing = s.brands[brandId].extras.find(
    (e) => e.name === name && e.price === price && e.owner === owner,
  );
  if (existing) {
    commit([[cellsKey.extra(brandId, existing.id), { n: name, p: price, q: existing.qty + qty, o: owner }]]);
  } else {
    commit([[cellsKey.extra(brandId, newExtraId()), { n: name, p: price, q: qty, o: owner }]]);
  }
  toast(STRINGS.TOAST_EXTRA_ADDED(name));
}

function setPlate(brandId, owner, plateId, count) {
  commit([[cellsKey.plate(brandId, owner, plateId), count]]);
}

// Removing a person keeps their dishes and extras on the bill by moving them to the shared pool.
function removePerson(personId) {
  const s = state();
  if (s.people.length <= 1) {
    toast(STRINGS.ERR_LAST_PERSON);
    return;
  }
  const changes = [[cellsKey.person(personId), null]];
  const removed = s.people.find((p) => p.id === personId);
  for (const brandId of BRAND_ORDER) {
    const data = s.brands[brandId];
    const personCounts = data.plates[personId] || {};
    const sharedCounts = data.plates.shared || {};
    for (const plate of BRANDS[brandId].plates) {
      const moved = personCounts[plate.id] || 0;
      if (moved > 0) {
        changes.push([cellsKey.plate(brandId, 'shared', plate.id), Math.min(999, (sharedCounts[plate.id] || 0) + moved)]);
      }
      if (personCounts[plate.id] !== undefined) changes.push([cellsKey.plate(brandId, personId, plate.id), null]);
    }
    for (const ex of data.extras.filter((e) => e.owner === personId)) {
      changes.push([cellsKey.extra(brandId, ex.id), { n: ex.name, p: ex.price, q: ex.qty, o: 'shared' }]);
    }
  }
  commit(changes);
  if (ui.target === personId) ui.target = null;
  toast(STRINGS.TOAST_PERSON_REMOVED(removed.name));
}

function clearBrand(brandId) {
  const changes = [
    [cellsKey.brandField(brandId, 'discount'), 0],
    [cellsKey.brandField(brandId, 'sc'), true],
  ];
  for (const key of Object.keys(cells)) {
    if (cells[key].v === null) continue;
    if (key.startsWith(`brand:${brandId}:plate:`) || key.startsWith(`brand:${brandId}:extra:`)) {
      changes.push([key, null]);
    }
  }
  commit(changes);
  ui.clearOpen = false;
  toast(STRINGS.TOAST_CLEARED(BRANDS[brandId].shortName));
}

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    toast(STRINGS.TOAST_COPY_FAILED);
  }
}

async function copySummary() {
  const view = currentView();
  if (view.plateTotal === 0 && view.extraQty === 0) {
    toast(STRINGS.TOAST_EMPTY_BILL);
    return;
  }
  await copyText(buildSummaryText(view), STRINGS.TOAST_COPIED);
}

const parseIntInRange = (raw, min, max) => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

async function createInvite() {
  ui.share.busy = true;
  ui.share.error = '';
  render();
  try {
    session?.close();
    session = null;
    const created = await sync.createInvite(shareHooks());
    session = created;
    ui.share.invite = created.code;
    ui.share.status = 'waiting';
  } catch (err) {
    console.warn('Invite failed:', err);
    ui.share.error = sync.isSupported() ? STRINGS.SHARE_STATUS_FAILED : STRINGS.ERR_UNSUPPORTED;
    ui.share.status = 'failed';
  } finally {
    ui.share.busy = false;
    render();
  }
}

async function acceptReply() {
  if (!session?.acceptReply) {
    ui.share.error = STRINGS.SHARE_HOST_STEP1;
    render();
    return;
  }
  try {
    await session.acceptReply(ui.share.replyDraft);
    ui.share.error = '';
    ui.share.status = 'connecting';
  } catch (err) {
    console.warn('Reply rejected:', err);
    ui.share.error = STRINGS.ERR_CODE_INVALID;
  }
  render();
}

async function joinInvite() {
  ui.share.busy = true;
  ui.share.error = '';
  render();
  try {
    session?.close();
    session = null;
    const joined = await sync.joinWithInvite(ui.share.inviteDraft, shareHooks());
    session = joined;
    ui.share.reply = joined.code;
    ui.share.status = 'connecting';
  } catch (err) {
    console.warn('Join failed:', err);
    ui.share.error = err.message === 'INVALID_CODE' ? STRINGS.ERR_CODE_INVALID : STRINGS.SHARE_STATUS_FAILED;
  } finally {
    ui.share.busy = false;
    render();
  }
}

function disconnect() {
  session?.close();
  session = null;
  Object.assign(ui.share, { status: 'idle', invite: '', reply: '', inviteDraft: '', replyDraft: '', error: '' });
  render();
}

const actions = {
  brand(el) {
    const id = el.dataset.brand;
    if (id === state().brandId) return;
    commit([['cfg:brand', id]]);
    ui.target = null;
    toast(STRINGS.TOAST_BRAND(BRANDS[id].shortName));
  },
  mode(el) {
    const mode = el.dataset.mode;
    if (mode === state().mode) return;
    commit([['cfg:mode', mode]]);
  },
  target(el) {
    const target = el.dataset.target;
    if (target === ui.target) return;
    ui.target = target;
    render();
  },
  plate(el) {
    const s = state();
    const owner = currentOwner(s);
    const current = s.brands[s.brandId].plates[owner]?.[el.dataset.plate] ?? 0;
    const next = Math.min(999, Math.max(0, current + Number(el.dataset.delta)));
    if (next !== current) setPlate(s.brandId, owner, el.dataset.plate, next);
  },
  preset(el) {
    const s = state();
    const preset = BRANDS[s.brandId].presets[Number(el.dataset.index)];
    const text = STRINGS[preset.textKey];
    addExtra(text.name, preset.price, 1);
  },
  extra(el) {
    const s = state();
    const ex = s.brands[s.brandId].extras.find((e) => e.id === el.dataset.id);
    if (!ex) return;
    const qty = ex.qty + Number(el.dataset.delta);
    const key = cellsKey.extra(s.brandId, ex.id);
    commit([[key, qty <= 0 ? null : { n: ex.name, p: ex.price, q: qty, o: ex.owner }]]);
  },
  discount(el) {
    commit([[cellsKey.brandField(state().brandId, 'discount'), Number(el.dataset.amount)]]);
  },
  'add-person'() {
    const s = state();
    const id = newPersonId();
    const name = STRINGS.DEFAULT_PERSON_NAME(s.people.length + 1);
    commit([[cellsKey.person(id), { n: name, o: Date.now() }]]);
    if (s.mode === 'person') ui.target = id;
    render();
    toast(STRINGS.TOAST_PERSON_ADDED(name));
  },
  'remove-person'(el) {
    removePerson(el.dataset.person);
  },
  'open-share'() {
    ui.share.open = true;
    render();
  },
  'close-share'() {
    ui.share.open = false;
    render();
  },
  'close-share-backdrop'(el, event) {
    if (event.target === el) actions['close-share']();
  },
  'share-tab'(el) {
    ui.share.tab = el.dataset.tab;
    ui.share.error = '';
    render();
  },
  'create-invite': createInvite,
  'accept-reply': acceptReply,
  join: joinInvite,
  disconnect,
  async 'copy-code'(el) {
    const text = el.dataset.code === 'invite' ? ui.share.invite : ui.share.reply;
    await copyText(text, STRINGS.TOAST_CODE_COPIED);
  },
  'open-clear'() {
    ui.clearOpen = true;
    render();
  },
  'close-clear'() {
    ui.clearOpen = false;
    render();
  },
  'close-clear-backdrop'(el, event) {
    if (event.target === el) actions['close-clear']();
  },
  'confirm-clear'() {
    clearBrand(state().brandId);
  },
  copy: copySummary,
};

const changes = {
  budget(el) {
    commit([[cellsKey.brandField(state().brandId, 'budget'), parseIntInRange(el.value, 0, 100000)]]);
  },
  discount(el) {
    commit([[cellsKey.brandField(state().brandId, 'discount'), parseIntInRange(el.value, 0, 100000)]]);
  },
  sc(el) {
    commit([[cellsKey.brandField(state().brandId, 'sc'), el.checked]]);
  },
  'equal-tax'(el) {
    commit([['cfg:equalTaxSplit', el.checked]]);
  },
  'plate-input'(el) {
    const s = state();
    const owner = currentOwner(s);
    setPlate(s.brandId, owner, el.dataset.plate, parseIntInRange(el.value, 0, 999));
  },
  'person-name'(el) {
    const id = el.dataset.person;
    const name = el.value.trim();
    const current = cells[cellsKey.person(id)]?.v;
    if (!name || !current) {
      render();
      return;
    }
    commit([[cellsKey.person(id), { n: name.slice(0, 40), o: current.o }]]);
  },
};

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const handler = actions[el.dataset.action];
  if (handler) handler(el, event);
});

document.addEventListener('change', (event) => {
  const handler = changes[event.target.dataset?.change];
  if (handler) handler(event.target);
});

document.addEventListener('input', (event) => {
  const field = event.target.dataset?.shareDraft;
  if (field === 'reply') ui.share.replyDraft = event.target.value;
  if (field === 'invite') ui.share.inviteDraft = event.target.value;
});

document.addEventListener('toggle', (event) => {
  if (event.target.matches?.('[data-tax-details]')) ui.taxOpen = event.target.open;
}, true);

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-form="custom"]')) return;
  event.preventDefault();
  const form = event.target;
  const price = Number(form.price.value);
  if (!Number.isInteger(price) || price < 0 || price > 100000) {
    toast(STRINGS.ERR_PRICE_INVALID);
    return;
  }
  const name = form.name.value.trim().slice(0, 60) || STRINGS.EXTRA_DEFAULT_NAME;
  addExtra(name, price, parseIntInRange(form.qty.value, 1, 99));
  form.reset();
  form.qty.value = '1';
});

// Boot: first run gets two person rows so the user can type real names right away.
// Fixed ids: two phones that both start fresh merge into the same two people, not four.
if (!Object.keys(cells).some((k) => k.startsWith('person:'))) {
  const now = Date.now();
  cells = [1, 2].reduce(
    (acc, n) => setCell(acc, cellsKey.person(`p_default${n}`), { n: STRINGS.DEFAULT_PERSON_NAME(n), o: n }, now),
    cells,
  );
  saveCells(cells);
}
render();
