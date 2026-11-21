// Controller for the split-bill screen. Its events live on its own root element, so they never
// collide with the sushi screen's delegated handlers.
import { STRINGS } from '../../strings/th.ts';
import { BILL_PRESETS } from '../../config/bill-presets.ts';
import { BRANDS, type BrandId } from '../../config/brands.ts';
import { defaultSplitData, loadSplit, saveSplit, type SplitData } from '../../integrations/split-storage.ts';
import { computeSplit, type Category, type SplitItem, type TaxRule } from '../../logic/split.ts';
import { evaluateExpression } from '../../logic/expr.ts';
import { buildSplitSummary } from '../../logic/split-text.ts';
import { renderSplit, type SplitUi } from './split-render.ts';

const root = document.getElementById('split-root');
const toastEl = document.getElementById('toast');
if (!root || !toastEl) throw new Error('Missing split-root or toast element');
const splitRoot: HTMLElement = root;
const toastNode: HTMLElement = toastEl;

const txt = (key: keyof typeof STRINGS): string => String(STRINGS[key]);
const fnStr = (key: keyof typeof STRINGS) => STRINGS[key] as unknown as (...args: (string | number)[]) => string;
const randomId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;

const RULE_FOR_CATEGORY: Record<Category, TaxRule> = { food: 'bill', drink: 'bill', alcohol: 'sc10_vat7' };

let data: SplitData = loadSplit() ?? freshData();
let ui: SplitUi = freshUi(data);

function freshData(): SplitData {
  const d = defaultSplitData();
  d.people = [
    { id: randomId('sp'), name: fnStr('BILL_DEFAULT_NAME')(1), paid: false },
    { id: randomId('sp'), name: fnStr('BILL_DEFAULT_NAME')(2), paid: false },
  ];
  return d;
}

function freshUi(d: SplitData): SplitUi {
  return {
    source: 'general',
    category: 'food',
    rule: 'bill',
    payers: d.people.map((p) => p.id),
    editing: null,
    expanded: [],
    clearConfirm: false,
    nameDraft: '',
    nameError: '',
    nameDraftItem: '',
    priceDraft: '',
    qtyDraft: '1',
    itemError: '',
  };
}

function resultNow() {
  return computeSplit(data.items, data.people.map((p) => p.id), data.settings);
}

function render(): void {
  splitRoot.innerHTML = renderSplit(data, ui, resultNow());
}

function commit(): void {
  saveSplit(data);
  render();
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string): void {
  toastNode.textContent = message;
  toastNode.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('is-visible'), 2200);
}

function resetItemForm(): void {
  ui = {
    ...ui,
    editing: null,
    nameDraftItem: '',
    priceDraft: '',
    qtyDraft: '1',
    itemError: '',
    rule: RULE_FOR_CATEGORY[ui.category],
  };
}

function saveItem(): void {
  const price = evaluateExpression(ui.priceDraft);
  if (price === null || price <= 0) {
    ui = { ...ui, itemError: txt('BILL_NEED_PRICE') };
    render();
    return;
  }
  if (ui.payers.length === 0) {
    ui = { ...ui, itemError: txt('BILL_NEED_PAYER') };
    render();
    return;
  }
  const qty = Math.min(99, Math.max(1, Number.parseInt(ui.qtyDraft, 10) || 1));
  const name = ui.nameDraftItem.trim() || txt('BILL_CAT_FOOD');
  const item: SplitItem = {
    id: ui.editing ?? randomId('it'),
    category: ui.category,
    name: name.slice(0, 60),
    unitSatang: Math.round(price * 100),
    qty,
    rule: ui.rule,
    payers: [...ui.payers],
  };
  if (ui.editing) {
    data = { ...data, items: data.items.map((i) => (i.id === item.id ? item : i)) };
    toast(txt('BILL_SAVE_ITEM'));
  } else {
    data = { ...data, items: [...data.items, item] };
    toast(fnStr('BILL_ITEM_ADDED')(item.name));
  }
  resetItemForm();
  commit();
}

function addPerson(): void {
  const name = ui.nameDraft.trim().slice(0, 24);
  if (!name) return;
  if (data.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    ui = { ...ui, nameError: txt('BILL_NAME_TAKEN') };
    render();
    return;
  }
  const id = randomId('sp');
  data = { ...data, people: [...data.people, { id, name, paid: false }] };
  ui = { ...ui, nameDraft: '', nameError: '', payers: [...ui.payers, id] };
  commit();
}

function removePerson(id: string): void {
  data = {
    ...data,
    people: data.people.filter((p) => p.id !== id),
    items: data.items.map((i) => ({ ...i, payers: i.payers.filter((x) => x !== id) })),
  };
  ui = { ...ui, payers: ui.payers.filter((x) => x !== id), expanded: ui.expanded.filter((x) => x !== id) };
  commit();
}

function setSettings(patch: Partial<SplitData['settings']>): void {
  data = { ...data, settings: { ...data.settings, ...patch } };
  commit();
}

const clickActions: Record<string, (el: HTMLElement) => void> = {
  'clear-open': () => { ui = { ...ui, clearConfirm: true }; render(); },
  'clear-cancel': () => { ui = { ...ui, clearConfirm: false }; render(); },
  'clear-yes': () => {
    data = defaultSplitData();
    data.people = freshData().people;
    ui = freshUi(data);
    saveSplit(data);
    toast(txt('BILL_CLEAR_ALL'));
    render();
  },
  cat(el) {
    const cat = el.dataset['cat'] as Category | undefined;
    if (!cat) return;
    ui = { ...ui, category: cat, rule: ui.editing ? ui.rule : RULE_FOR_CATEGORY[cat] };
    render();
  },
  rule(el) {
    const rule = el.dataset['rule'] as TaxRule | undefined;
    if (!rule) return;
    ui = { ...ui, rule };
    render();
  },
  source(el) {
    const value = el.dataset['value'];
    if (value === 'general' || value === undefined) {
      ui = { ...ui, source: 'general' };
      render();
      return;
    }
    const id = value as BrandId;
    const brand = BRANDS[id];
    if (!brand) return;
    // Brand menus show prices that already include VAT (vat_included) or add both (++); set the bill rates to match.
    const plus = brand.taxType === 'plus_plus';
    ui = { ...ui, source: id };
    setSettings({ scRate: 10, vatRate: plus ? 7 : 0, compound: plus });
  },
  preset(el) {
    const index = Number(el.dataset['index']);
    if (ui.source === 'general') {
      const preset = BILL_PRESETS[ui.category][index];
      if (!preset) return;
      ui = { ...ui, nameDraftItem: txt(preset.key), priceDraft: String(preset.price), rule: preset.rule, itemError: '' };
    } else {
      const preset = BRANDS[ui.source].presets[index];
      if (!preset) return;
      const text = STRINGS[preset.textKey as keyof typeof STRINGS] as unknown as { name: string };
      ui = { ...ui, nameDraftItem: text.name, priceDraft: String(preset.price), rule: 'bill', itemError: '' };
    }
    render();
  },
  payer(el) {
    const id = el.dataset['id'] ?? '';
    const payers = ui.payers.includes(id) ? ui.payers.filter((x) => x !== id) : [...ui.payers, id];
    ui = { ...ui, payers, itemError: '' };
    render();
  },
  'payers-all'() { ui = { ...ui, payers: data.people.map((p) => p.id) }; render(); },
  'payers-clear'() { ui = { ...ui, payers: [] }; render(); },
  'item-edit'(el) {
    const item = data.items.find((i) => i.id === el.dataset['id']);
    if (!item) return;
    ui = {
      ...ui,
      editing: item.id,
      category: item.category,
      rule: item.rule,
      payers: [...item.payers],
      nameDraftItem: item.name,
      priceDraft: String(item.unitSatang / 100),
      qtyDraft: String(item.qty),
      itemError: '',
    };
    render();
  },
  'item-cancel'() { resetItemForm(); render(); },
  'item-delete'(el) {
    const id = el.dataset['id'] ?? '';
    data = { ...data, items: data.items.filter((i) => i.id !== id) };
    if (ui.editing === id) resetItemForm();
    commit();
  },
  'remove-person'(el) { removePerson(el.dataset['id'] ?? ''); },
  paid(el) {
    const id = el.dataset['id'] ?? '';
    data = { ...data, people: data.people.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)) };
    commit();
  },
  expand(el) {
    const id = el.dataset['id'] ?? '';
    const expanded = ui.expanded.includes(id) ? ui.expanded.filter((x) => x !== id) : [...ui.expanded, id];
    ui = { ...ui, expanded };
    render();
  },
  'discount-mode'(el) {
    setSettings({ discountMode: el.dataset['value'] === 'equal' ? 'equal' : 'proportional' });
  },
  'tax-split'(el) {
    setSettings({ taxSplit: el.dataset['value'] === 'equal' ? 'equal' : 'itemized' });
  },
  async copy() {
    const text = buildSplitSummary(data.shopName, data.note, data.people, resultNow());
    try {
      await navigator.clipboard.writeText(text);
      toast(txt('BILL_COPIED'));
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      toast(txt('TOAST_COPY_FAILED'));
    }
  },
};

const changeActions: Record<string, (el: HTMLInputElement) => void> = {
  rename(el) {
    const id = el.dataset['id'] ?? '';
    const name = el.value.trim().slice(0, 24);
    if (!name) { render(); return; }
    if (data.people.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
      toast(txt('BILL_NAME_TAKEN'));
      render();
      return;
    }
    data = { ...data, people: data.people.map((p) => (p.id === id ? { ...p, name } : p)) };
    commit();
  },
  shop(el) { data = { ...data, shopName: el.value.slice(0, 60) }; saveSplit(data); },
  note(el) { data = { ...data, note: el.value.slice(0, 120) }; saveSplit(data); },
  'sc-rate'(el) { setSettings({ scRate: Math.max(0, Number(el.value) || 0) }); },
  'vat-rate'(el) { setSettings({ vatRate: Math.max(0, Number(el.value) || 0) }); },
  discount(el) {
    const baht = Math.max(0, Number(el.value) || 0);
    setSettings({ discountSatang: Math.round(baht * 100) });
  },
  compound(el) { setSettings({ compound: el.checked }); },
  round(el) { setSettings({ roundUp: el.checked }); },
};

splitRoot.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const el = target.closest<HTMLElement>('[data-split-action]');
  if (!el) return;
  const handler = clickActions[el.dataset['splitAction'] ?? ''];
  if (handler) void handler(el);
});

splitRoot.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const handler = changeActions[target.dataset['splitChange'] ?? ''];
  if (handler) handler(target);
});

splitRoot.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  switch (target.dataset['splitDraft']) {
    case 'name': ui = { ...ui, nameDraft: target.value, nameError: '' }; break;
    case 'item-name': ui = { ...ui, nameDraftItem: target.value }; break;
    case 'price': ui = { ...ui, priceDraft: target.value, itemError: '' }; break;
    case 'qty': ui = { ...ui, qtyDraft: target.value }; break;
    default: break;
  }
});

splitRoot.addEventListener('submit', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (target.dataset['splitForm'] === 'person') addPerson();
  if (target.dataset['splitForm'] === 'item') saveItem();
});

render();
