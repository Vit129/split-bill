// Controller: turns DOM events into cell writes, then re-renders from the cells.
// The only module that touches the DOM globals, storage and WebRTC together.
import { BRAND_ORDER, BRANDS, type BrandId } from '../config/brands.ts';
import { COLORS } from '../config/colors.ts';
import { TYPOGRAPHY } from '../config/typography.ts';
import { STRINGS } from '../strings/th.ts';
import { loadCells, saveCells } from '../integrations/storage.ts';
import * as sync from '../integrations/peer-sync.ts';
import type { SyncHooks, SyncSession } from '../integrations/peer-sync.ts';
import { deriveState, mergeCells, setCell, type AppState, type Cells } from '../logic/cells.ts';
import { buildView, ownersFor, type View } from '../logic/view-model.ts';
import { buildSummaryText } from '../logic/bill-text.ts';
import { renderBody, renderClear, renderShare, type UiState } from './render.ts';
import { SHARE_ENABLED } from '../config/features.ts';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const root = byId<HTMLElement>('app');
const modalRoot = byId<HTMLElement>('modal-root');
const toastEl = byId<HTMLElement>('toast');

const ui: UiState = {
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

let cells: Cells = loadCells();
let session: SyncSession | null = null; // the active share connection

const randomId = (len: number): string => Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
const newPersonId = (): string => `p_${randomId(8)}`;
const newExtraId = (): string => `${Date.now().toString(36)}${randomId(4)}`;
const cellsKey = {
  brandField: (b: BrandId, f: string): string => `brand:${b}:${f}`,
  plate: (b: BrandId, owner: string, plate: string): string => `brand:${b}:plate:${owner}:${plate}`,
  extra: (b: BrandId, id: string): string => `brand:${b}:extra:${id}`,
  person: (id: string): string => `person:${id}`,
};

const currentState = (): AppState => deriveState(cells);

// Person mode counts into one owner at a time. Falls back to the first person.
function currentOwner(s: AppState): string {
  if (s.mode === 'table') return 'table';
  if (!ownersFor(s).includes(ui.target ?? '')) ui.target = s.people[0]?.id ?? 'shared';
  return ui.target ?? 'shared';
}

const extrasOwner = (s: AppState): string => (s.mode === 'table' ? 'table' : currentOwner(s));

function currentView(): View {
  const s = currentState();
  return buildView(s, currentOwner(s));
}

function applyTokens(brandId: BrandId): void {
  const style = document.documentElement.style;
  for (const [name, hex] of Object.entries(COLORS.PLATE)) style.setProperty(`--plate-${name}`, hex);
  for (const id of BRAND_ORDER) {
    style.setProperty(`--brand-${id}-primary`, COLORS.BRAND[BRANDS[id].theme].primary);
  }
  const current = COLORS.BRAND[BRANDS[brandId].theme];
  style.setProperty('--brand-primary', current.primary);
  style.setProperty('--brand-soft', current.soft);
  style.setProperty('--brand-border', current.border);
  style.setProperty('--font-sans', TYPOGRAPHY.FONT_STACK);
  for (const [name, size] of Object.entries(TYPOGRAPHY)) {
    if (name !== 'FONT_STACK') style.setProperty(`--${name.toLowerCase().replace(/_/g, '-')}`, size);
  }
  for (const [name, value] of Object.entries(COLORS)) {
    if (typeof value === 'string') style.setProperty(`--${name.toLowerCase().replace(/_/g, '-')}`, value);
  }
}

function render(): void {
  const s = currentState();
  const view = buildView(s, currentOwner(s));
  applyTokens(s.brandId);
  root.innerHTML = renderBody(s, view, ui);
  modalRoot.innerHTML = [
    SHARE_ENABLED && ui.share.open ? renderShare(ui.share, session !== null) : '',
    ui.clearOpen ? renderClear(BRANDS[s.brandId]) : '',
  ].join('');
  document.title = `${STRINGS.APP_TITLE} • ${BRANDS[s.brandId].shortName}`;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
}

// One place that writes cells: stores locally, pushes to the connected device, re-renders.
function commit(changes: [string, unknown][]): void {
  const now = Date.now();
  cells = changes.reduce<Cells>((acc, [key, value]) => setCell(acc, key, value, now), cells);
  saveCells(cells);
  session?.send(cells);
  render();
}

function applyRemote(remote: unknown): void {
  const result = mergeCells(cells, remote);
  if (result.rejected > 0) toast(STRINGS.TOAST_REJECTED(result.rejected));
  if (result.changed) {
    cells = result.cells;
    saveCells(cells);
    toast(STRINGS.TOAST_SYNCED);
    render();
  }
}

function shareHooks(): SyncHooks {
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

function addExtra(name: string, price: number, qty: number): void {
  const s = currentState();
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

function setPlate(brandId: BrandId, owner: string, plateId: string, count: number): void {
  commit([[cellsKey.plate(brandId, owner, plateId), count]]);
}

// Removing a person keeps their dishes and extras on the bill by moving them to the shared pool.
function removePerson(personId: string): void {
  const s = currentState();
  if (s.people.length <= 1) {
    toast(STRINGS.ERR_LAST_PERSON);
    return;
  }
  const removed = s.people.find((p) => p.id === personId);
  const changes: [string, unknown][] = [[cellsKey.person(personId), null]];
  for (const brandId of BRAND_ORDER) {
    const data = s.brands[brandId];
    const personCounts = data.plates[personId] ?? {};
    const sharedCounts = data.plates['shared'] ?? {};
    for (const plate of BRANDS[brandId].plates) {
      const moved = personCounts[plate.id] ?? 0;
      if (moved > 0) {
        changes.push([cellsKey.plate(brandId, 'shared', plate.id), Math.min(999, (sharedCounts[plate.id] ?? 0) + moved)]);
      }
      if (personCounts[plate.id] !== undefined) changes.push([cellsKey.plate(brandId, personId, plate.id), null]);
    }
    for (const ex of data.extras.filter((e) => e.owner === personId)) {
      changes.push([cellsKey.extra(brandId, ex.id), { n: ex.name, p: ex.price, q: ex.qty, o: 'shared' }]);
    }
  }
  commit(changes);
  if (ui.target === personId) ui.target = null;
  toast(STRINGS.TOAST_PERSON_REMOVED(removed?.name ?? ''));
}

function clearBrand(brandId: BrandId): void {
  const changes: [string, unknown][] = [
    [cellsKey.brandField(brandId, 'discount'), 0],
    [cellsKey.brandField(brandId, 'sc'), true],
  ];
  for (const key of Object.keys(cells)) {
    if (cells[key]?.v === null) continue;
    if (key.startsWith(`brand:${brandId}:plate:`) || key.startsWith(`brand:${brandId}:extra:`)) {
      changes.push([key, null]);
    }
  }
  commit(changes);
  ui.clearOpen = false;
  toast(STRINGS.TOAST_CLEARED(BRANDS[brandId].shortName));
}

async function copyText(text: string, okMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    toast(STRINGS.TOAST_COPY_FAILED);
  }
}

async function copySummary(): Promise<void> {
  const view = currentView();
  if (view.plateTotal === 0 && view.extraQty === 0) {
    toast(STRINGS.TOAST_EMPTY_BILL);
    return;
  }
  await copyText(buildSummaryText(view), STRINGS.TOAST_COPIED);
}

const parseIntInRange = (raw: string, min: number, max: number): number => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

async function createInvite(): Promise<void> {
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

async function acceptReply(): Promise<void> {
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

async function joinInvite(): Promise<void> {
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
    ui.share.error = err instanceof Error && err.message === 'INVALID_CODE'
      ? STRINGS.ERR_CODE_INVALID
      : STRINGS.SHARE_STATUS_FAILED;
  } finally {
    ui.share.busy = false;
    render();
  }
}

function disconnect(): void {
  session?.close();
  session = null;
  Object.assign(ui.share, { status: 'idle', invite: '', reply: '', inviteDraft: '', replyDraft: '', error: '' });
  render();
}

type Handler = (el: HTMLElement, event: Event) => void | Promise<void>;

const actions: Record<string, Handler> = {
  brand(el) {
    const id = el.dataset['brand'] as BrandId;
    if (id === currentState().brandId) return;
    commit([['cfg:brand', id]]);
    ui.target = null;
    toast(STRINGS.TOAST_BRAND(BRANDS[id].shortName));
  },
  mode(el) {
    const mode = el.dataset['mode'];
    if (mode === currentState().mode) return;
    commit([['cfg:mode', mode]]);
  },
  target(el) {
    const target = el.dataset['target'] ?? null;
    if (target === ui.target) return;
    ui.target = target;
    render();
  },
  plate(el) {
    const s = currentState();
    const owner = currentOwner(s);
    const plate = el.dataset['plate'] ?? '';
    const current = s.brands[s.brandId].plates[owner]?.[plate] ?? 0;
    const next = Math.min(999, Math.max(0, current + Number(el.dataset['delta'])));
    if (next !== current) setPlate(s.brandId, owner, plate, next);
  },
  preset(el) {
    const s = currentState();
    const preset = BRANDS[s.brandId].presets[Number(el.dataset['index'])];
    if (!preset) return;
    const text = STRINGS[preset.textKey as keyof typeof STRINGS] as unknown as { name: string };
    addExtra(text.name, preset.price, 1);
  },
  extra(el) {
    const s = currentState();
    const ex = s.brands[s.brandId].extras.find((e) => e.id === el.dataset['id']);
    if (!ex) return;
    const qty = ex.qty + Number(el.dataset['delta']);
    commit([[cellsKey.extra(s.brandId, ex.id), qty <= 0 ? null : { n: ex.name, p: ex.price, q: qty, o: ex.owner }]]);
  },
  discount(el) {
    commit([[cellsKey.brandField(currentState().brandId, 'discount'), Number(el.dataset['amount'])]]);
  },
  'add-person'() {
    const s = currentState();
    const id = newPersonId();
    const name = STRINGS.DEFAULT_PERSON_NAME(s.people.length + 1);
    commit([[cellsKey.person(id), { n: name, o: Date.now() }]]);
    if (s.mode === 'person') ui.target = id;
    render();
    toast(STRINGS.TOAST_PERSON_ADDED(name));
  },
  'remove-person'(el) {
    removePerson(el.dataset['person'] ?? '');
  },
  'open-share'() {
    if (!SHARE_ENABLED) return;
    ui.share.open = true;
    render();
  },
  'close-share'() {
    ui.share.open = false;
    render();
  },
  'close-share-backdrop'(el, event) {
    if (event.target === el) void actions['close-share']?.(el, event);
  },
  'share-tab'(el) {
    ui.share.tab = el.dataset['tab'] === 'guest' ? 'guest' : 'host';
    ui.share.error = '';
    render();
  },
  'create-invite': createInvite,
  'accept-reply': acceptReply,
  join: joinInvite,
  disconnect,
  async 'copy-code'(el) {
    const text = el.dataset['code'] === 'invite' ? ui.share.invite : ui.share.reply;
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
    if (event.target === el) void actions['close-clear']?.(el, event);
  },
  'confirm-clear'() {
    clearBrand(currentState().brandId);
  },
  copy: copySummary,
};

type ChangeHandler = (el: HTMLInputElement) => void;

const changes: Record<string, ChangeHandler> = {
  budget(el) {
    commit([[cellsKey.brandField(currentState().brandId, 'budget'), parseIntInRange(el.value, 0, 100000)]]);
  },
  discount(el) {
    commit([[cellsKey.brandField(currentState().brandId, 'discount'), parseIntInRange(el.value, 0, 100000)]]);
  },
  sc(el) {
    commit([[cellsKey.brandField(currentState().brandId, 'sc'), el.checked]]);
  },
  'equal-tax'(el) {
    commit([['cfg:equalTaxSplit', el.checked]]);
  },
  'plate-input'(el) {
    const s = currentState();
    setPlate(s.brandId, currentOwner(s), el.dataset['plate'] ?? '', parseIntInRange(el.value, 0, 999));
  },
  'person-name'(el) {
    const id = el.dataset['person'] ?? '';
    const name = el.value.trim();
    const current = cells[cellsKey.person(id)]?.v as { n: string; o: number } | null | undefined;
    if (!name || !current) {
      render();
      return;
    }
    commit([[cellsKey.person(id), { n: name.slice(0, 40), o: current.o }]]);
  },
};

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const el = target.closest<HTMLElement>('[data-action]');
  if (!el) return;
  const handler = actions[el.dataset['action'] ?? ''];
  if (handler) void handler(el, event);
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const handler = changes[target.dataset['change'] ?? ''];
  if (handler) handler(target);
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;
  const field = target.dataset['shareDraft'];
  if (field === 'reply') ui.share.replyDraft = target.value;
  if (field === 'invite') ui.share.inviteDraft = target.value;
});

document.addEventListener('submit', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement) || !target.matches('[data-form="custom"]')) return;
  event.preventDefault();
  const field = (n: string): HTMLInputElement => {
    const el = target.querySelector<HTMLInputElement>(`[name="${n}"]`);
    if (!el) throw new Error(`Missing field ${n}`);
    return el;
  };
  const price = Number(field('extraPrice').value);
  if (!Number.isInteger(price) || price < 0 || price > 100000) {
    toast(STRINGS.ERR_PRICE_INVALID);
    return;
  }
  const name = field('extraName').value.trim().slice(0, 60) || STRINGS.EXTRA_DEFAULT_NAME;
  addExtra(name, price, parseIntInRange(field('extraQty').value, 1, 99));
  target.reset();
  field('extraQty').value = '1';
});

document.addEventListener('toggle', (event) => {
  const target = event.target;
  if (target instanceof HTMLDetailsElement && target.matches('[data-tax-details]')) ui.taxOpen = target.open;
}, true);

// Boot: first run gets two person rows so the user can type real names right away.
// Fixed ids: two phones that both start fresh merge into the same two people, not four.
if (!Object.keys(cells).some((k) => k.startsWith('person:'))) {
  const now = Date.now();
  cells = [1, 2].reduce<Cells>(
    (acc, n) => setCell(acc, cellsKey.person(`p_default${n}`), { n: STRINGS.DEFAULT_PERSON_NAME(n), o: n }, now),
    cells,
  );
  saveCells(cells);
}
render();
