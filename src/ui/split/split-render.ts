// Markup for the split-bill screen. Pure builders; every user-typed value goes through esc().
import { STRINGS } from '../../strings/th.ts';
import { esc } from '../../logic/escape.ts';
import { formatBaht } from '../../logic/money.ts';
import type { Category, PersonResult, SplitItem, SplitResult, SplitSettings, TaxRule } from '../../logic/split.ts';
import { BILL_PRESETS } from '../../config/bill-presets.ts';
import type { SplitData, SplitPerson } from '../../integrations/split-storage.ts';

type StringKey = keyof typeof STRINGS;
const txt = (key: StringKey): string => String(STRINGS[key]);
// Formatter keys hold functions; this reads them with their real signature.
const fnStr = (key: StringKey) => STRINGS[key] as unknown as (...args: (string | number)[]) => string;
const baht = (satang: number): string => formatBaht(satang);

export interface SplitUi {
  category: Category;
  rule: TaxRule;
  payers: string[];
  editing: string | null;
  expanded: string[];
  clearConfirm: boolean;
  nameDraft: string;
  nameError: string;
  nameDraftItem: string;
  priceDraft: string;
  qtyDraft: string;
  itemError: string;
}

const CATEGORY_KEYS: Record<Category, StringKey> = {
  food: 'BILL_CAT_FOOD',
  drink: 'BILL_CAT_DRINK',
  alcohol: 'BILL_CAT_ALCOHOL',
};

const RULE_KEYS: Record<TaxRule, StringKey> = {
  bill: 'BILL_RULE_BILL',
  net: 'BILL_RULE_NET',
  vat7: 'BILL_RULE_VAT7',
  sc10_vat7: 'BILL_RULE_SC_VAT',
};

const CATEGORY_ORDER: Category[] = ['food', 'drink', 'alcohol'];

function header(): string {
  return `<header class="topbar split-topbar">
    <div class="brand-mark split-mark" aria-hidden="true">🧾</div>
    <div class="topbar-text">
      <h1>${esc(txt('BILL_TITLE'))}</h1>
      <p class="muted small">${esc(txt('BILL_SUB'))}</p>
    </div>
    <div class="topbar-actions">
      <button class="btn btn-soft" type="button" data-split-action="clear-open">${esc(txt('BILL_CLEAR_ALL'))}</button>
    </div>
  </header>`;
}

function clearRow(ui: SplitUi): string {
  if (!ui.clearConfirm) return '';
  return `<div class="banner banner-warn" role="alert">
    <span>${esc(txt('BILL_CLEAR_CONFIRM'))}</span>
    <div class="row-gap">
      <button class="btn btn-soft small" type="button" data-split-action="clear-cancel">${esc(txt('BTN_CANCEL'))}</button>
      <button class="btn btn-danger small" type="button" data-split-action="clear-yes">${esc(txt('BILL_CLEAR_YES'))}</button>
    </div>
  </div>`;
}

function peopleCard(data: SplitData, ui: SplitUi): string {
  const chips = data.people.map((p: SplitPerson) => `
    <div class="person-chip">
      <input class="input input-name" type="text" maxlength="24" value="${esc(p.name)}"
        aria-label="${esc(txt('BILL_PEOPLE'))}" data-split-change="rename" data-id="${esc(p.id)}">
      <button type="button" class="icon-btn" data-split-action="remove-person" data-id="${esc(p.id)}"
        aria-label="${esc(txt('BILL_REMOVE_PERSON'))}">✕</button>
    </div>`).join('');
  return `<section class="card">
    <div class="row-between">
      <h2>${esc(txt('BILL_PEOPLE'))} <span class="muted small">(${esc(fnStr('BILL_PERSON_COUNT')(data.people.length))})</span></h2>
    </div>
    <form class="row-gap" data-split-form="person">
      <input class="input" type="text" maxlength="24" value="${esc(ui.nameDraft)}" data-split-draft="name"
        placeholder="${esc(txt('BILL_NAME_PLACEHOLDER'))}" aria-label="${esc(txt('BILL_NAME_PLACEHOLDER'))}">
      <button class="btn btn-primary" type="submit">${esc(txt('BILL_ADD_NAME'))}</button>
    </form>
    ${ui.nameError ? `<p class="level-over small">${esc(ui.nameError)}</p>` : ''}
    <div class="people">${chips}</div>
    <p class="muted small">${esc(txt('BILL_RENAME_HINT'))}</p>
  </section>`;
}

function presetsRow(ui: SplitUi): string {
  return `<div class="presets-row">
    <p class="label">${esc(txt('BILL_PRESETS'))}</p>
    <div class="chips">${BILL_PRESETS[ui.category].map((p, i) => `
      <button type="button" class="chip" data-split-action="preset" data-index="${i}">
        + ${esc(txt(p.key))} (${p.price})
      </button>`).join('')}</div>
  </div>`;
}

function itemFormCard(data: SplitData, ui: SplitUi): string {
  const editing = ui.editing !== null;
  return `<section class="card">
    <div class="row-between">
      <h2>${esc(editing ? txt('BILL_EDITING') : txt('BILL_ITEMS_TITLE'))}</h2>
      ${editing ? `<button class="btn btn-soft small" type="button" data-split-action="item-cancel">${esc(txt('BILL_CANCEL_EDIT'))}</button>` : ''}
    </div>
    <p class="label">${esc(txt('BILL_CATEGORY'))}</p>
    <div class="segmented" role="group">
      ${CATEGORY_ORDER.map((c) => `<button type="button" class="${ui.category === c ? 'is-active' : ''}"
        data-split-action="cat" data-cat="${c}" aria-pressed="${ui.category === c}">${esc(txt(CATEGORY_KEYS[c]))}</button>`).join('')}
    </div>
    ${presetsRow(ui)}
    <form class="stack" data-split-form="item">
      <label class="lbl">${esc(txt('BILL_NAME_LABEL'))}
        <input class="input" type="text" maxlength="60" value="${esc(ui.nameDraftItem)}" data-split-draft="item-name"></label>
      <div class="row two">
        <label class="lbl">${esc(txt('BILL_PRICE_LABEL'))}
          <input class="input" type="text" inputmode="decimal" value="${esc(ui.priceDraft)}" data-split-draft="price" required></label>
        <label class="lbl">${esc(txt('BILL_QTY_LABEL'))}
          <input class="input" type="number" min="1" max="99" value="${esc(ui.qtyDraft)}" data-split-draft="qty"></label>
      </div>
      ${ui.itemError ? `<p class="level-over small">${esc(ui.itemError)}</p>` : ''}
      <p class="label">${esc(txt('BILL_RULE_LABEL'))}</p>
      <div class="chips">${(Object.keys(RULE_KEYS) as TaxRule[]).map((r) => `
        <button type="button" class="chip${ui.rule === r ? ' is-active' : ''}" data-split-action="rule" data-rule="${r}"
          aria-pressed="${ui.rule === r}">${esc(txt(RULE_KEYS[r]))}</button>`).join('')}</div>
      <p class="label">${esc(txt('BILL_PAYERS'))} <span class="muted small">${esc(txt('BILL_PAYERS_HINT'))}</span></p>
      <div class="chips">
        ${data.people.map((p) => `<button type="button" class="chip${ui.payers.includes(p.id) ? ' is-active' : ''}"
          data-split-action="payer" data-id="${esc(p.id)}" aria-pressed="${ui.payers.includes(p.id)}">${esc(p.name)}</button>`).join('')}
      </div>
      <div class="row-gap">
        <button type="button" class="btn btn-soft small" data-split-action="payers-all">${esc(txt('BILL_SELECT_ALL'))}</button>
        <button type="button" class="btn btn-soft small" data-split-action="payers-clear">${esc(txt('BILL_CLEAR_PAYERS'))}</button>
      </div>
      <button class="btn btn-primary full" type="submit">${esc(editing ? txt('BILL_SAVE_ITEM') : txt('BILL_ADD_ITEM'))}</button>
    </form>
  </section>`;
}

function itemsCard(data: SplitData, ui: SplitUi): string {
  if (data.items.length === 0) {
    return `<section class="card"><h2>${esc(txt('BILL_ITEMS_TITLE'))}</h2><p class="muted empty">${esc(txt('BILL_LIST_EMPTY'))}</p></section>`;
  }
  const groups = CATEGORY_ORDER.map((c) => {
    const rows = data.items.filter((i) => i.category === c);
    if (rows.length === 0) return '';
    return `<div class="group"><p class="label">${esc(txt(CATEGORY_KEYS[c]))}</p>${rows.map((it) => itemRow(it, data, ui)).join('')}</div>`;
  }).join('');
  return `<section class="card"><h2>${esc(txt('BILL_ITEMS_TITLE'))} <span class="muted small">(${data.items.length})</span></h2>${groups}</section>`;
}

function itemRow(it: SplitItem, data: SplitData, ui: SplitUi): string {
  const payerNames = it.payers.map((id) => data.people.find((p) => p.id === id)?.name).filter((n): n is string => Boolean(n));
  const payerText = payerNames.length > 0 ? payerNames.join(', ') : txt('BILL_ITEM_NO_PAYER');
  const total = it.unitSatang * it.qty;
  return `<div class="item-row${ui.editing === it.id ? ' is-editing' : ''}">
    <div class="item-main">
      <strong>${esc(it.name)}</strong>${it.qty > 1 ? ` <span class="pill">× ${it.qty}</span>` : ''}
      <span class="pill">${esc(txt(RULE_KEYS[it.rule]))}</span>
      <div class="muted small">${esc(payerText)}</div>
    </div>
    <div class="item-side">
      <span class="tabular">${baht(total)}</span>
      <button type="button" class="icon-btn" data-split-action="item-edit" data-id="${esc(it.id)}" aria-label="${esc(txt('BILL_EDIT_ITEM'))}">✎</button>
      <button type="button" class="icon-btn" data-split-action="item-delete" data-id="${esc(it.id)}" aria-label="${esc(txt('BILL_DELETE_ITEM'))}">🗑</button>
    </div>
  </div>`;
}

function settingsCard(settings: SplitSettings, discountBaht: string): string {
  return `<section class="card">
    <h2>${esc(txt('BILL_SETTINGS_TITLE'))}</h2>
    <div class="row two">
      <label class="lbl">${esc(txt('BILL_SC_RATE'))}
        <input class="input" type="number" min="0" max="100" step="0.5" value="${settings.scRate}" data-split-change="sc-rate"></label>
      <label class="lbl">${esc(txt('BILL_VAT_RATE'))}
        <input class="input" type="number" min="0" max="100" step="0.5" value="${settings.vatRate}" data-split-change="vat-rate"></label>
    </div>
    <div class="row two">
      <label class="lbl">${esc(txt('BILL_DISCOUNT'))}
        <input class="input" type="number" min="0" step="1" value="${esc(discountBaht)}" data-split-change="discount"></label>
      <label class="lbl">&nbsp;
        <span class="segmented" role="group">
          <button type="button" class="${settings.discountMode === 'proportional' ? 'is-active' : ''}" data-split-action="discount-mode" data-value="proportional">${esc(txt('BILL_DISCOUNT_PROP'))}</button>
          <button type="button" class="${settings.discountMode === 'equal' ? 'is-active' : ''}" data-split-action="discount-mode" data-value="equal">${esc(txt('BILL_DISCOUNT_EQUAL'))}</button>
        </span></label>
    </div>
    <label class="toggle"><input type="checkbox" data-split-change="compound" ${settings.compound ? 'checked' : ''}> ${esc(txt('BILL_COMPOUND'))}</label>
    <label class="toggle"><input type="checkbox" data-split-change="round" ${settings.roundUp ? 'checked' : ''}> ${esc(txt('BILL_ROUND'))}</label>
    <p class="label">${esc(txt('BILL_TAX_ITEMIZED'))} / ${esc(txt('BILL_TAX_EQUAL'))}</p>
    <div class="segmented" role="group">
      <button type="button" class="${settings.taxSplit === 'itemized' ? 'is-active' : ''}" data-split-action="tax-split" data-value="itemized">${esc(txt('BILL_TAX_ITEMIZED'))}</button>
      <button type="button" class="${settings.taxSplit === 'equal' ? 'is-active' : ''}" data-split-action="tax-split" data-value="equal">${esc(txt('BILL_TAX_EQUAL'))}</button>
    </div>
  </section>`;
}

function personCard(p: PersonResult, data: SplitData, ui: SplitUi): string {
  const person = data.people.find((x) => x.id === p.id);
  const name = person?.name ?? '';
  const paid = person?.paid ?? false;
  const open = ui.expanded.includes(p.id);
  const lines = p.lines.map((l) => `<div class="kv small"><span>${esc(l.name)}${l.splitCount > 1 ? ` <span class="muted">(÷${l.splitCount})</span>` : ''}</span><span class="tabular">${baht(l.shareSatang)}</span></div>`).join('');
  return `<div class="person${paid ? ' is-paid' : ''}">
    <div class="row-between">
      <strong>${esc(name)}</strong>
      <button type="button" class="chip${paid ? ' is-active' : ''}" data-split-action="paid" data-id="${esc(p.id)}" aria-pressed="${paid}">
        ${esc(paid ? txt('BILL_PAID') : txt('BILL_UNPAID'))}</button>
    </div>
    <div class="amt tabular">฿${baht(p.totalSatang)}</div>
    <div class="kv small muted"><span>${esc(txt('BILL_PART_FOOD'))}</span><span class="tabular">${baht(p.foodSatang)}</span></div>
    <div class="kv small muted"><span>${esc(txt('BILL_PART_TAX'))}</span><span class="tabular">${baht(p.taxSatang)}</span></div>
    ${p.discountSatang > 0 ? `<div class="kv small ok"><span>${esc(txt('BILL_PART_DISCOUNT'))}</span><span class="tabular">-${baht(p.discountSatang)}</span></div>` : ''}
    <button type="button" class="link-btn" data-split-action="expand" data-id="${esc(p.id)}">${esc(open ? txt('BILL_HIDE_LINES') : txt('BILL_SHOW_LINES'))}</button>
    ${open ? `<div class="lines">${lines}</div>` : ''}
  </div>`;
}

function summaryCard(data: SplitData, ui: SplitUi, result: SplitResult): string {
  const persons = result.persons.map((p) => personCard(p, data, ui)).join('');
  const paidCount = data.people.filter((p) => p.paid).length;
  const sum = result.persons.reduce((a, p) => a + p.totalSatang, 0);
  const check = sum === result.totalSatang ? txt('BILL_CHECK_OK') : txt('BILL_CHECK_BAD');
  const byCat = (c: Category): number => data.items.filter((i) => i.category === c).reduce((a, i) => a + i.unitSatang * i.qty, 0);
  return `<section class="card summary-card">
    <p class="label">${esc(txt('BILL_SUMMARY_TITLE'))}</p>
    <div class="row-between">
      <h2>${esc(data.shopName.trim() || txt('BILL_SHOP_DEFAULT'))}</h2>
      <span class="small muted">${esc(fnStr('BILL_PAID_COUNT')(paidCount, data.people.length))}</span>
    </div>
    <div class="total tabular">฿${baht(result.totalSatang)}</div>
    <p class="muted small">${esc(txt('BILL_GRAND'))}</p>
    <dl class="totals">
      <div><dt>${esc(txt('BILL_FOOD'))}</dt><dd>${baht(byCat('food'))}</dd></div>
      <div><dt>${esc(txt('BILL_DRINK'))}</dt><dd>${baht(byCat('drink'))}</dd></div>
      <div><dt>${esc(txt('BILL_ALCOHOL'))}</dt><dd>${baht(byCat('alcohol'))}</dd></div>
      <div><dt>${esc(txt('BILL_TAX_TOTAL'))}</dt><dd>${baht(result.taxSatang)}</dd></div>
      ${result.discountSatang > 0 ? `<div class="good"><dt>${esc(txt('BILL_DISCOUNT_TOTAL'))}</dt><dd>-${baht(result.discountSatang)}</dd></div>` : ''}
    </dl>
    ${result.unassigned > 0 ? `<p class="level-warn small">${esc(fnStr('BILL_UNASSIGNED_NOTE')(result.unassigned))}</p>` : ''}
    <p class="muted small">${esc(check)}</p>
    <p class="label">${esc(txt('BILL_PER_PERSON'))}</p>
    <div class="persons">${persons}</div>
    <button type="button" class="btn btn-primary full" data-split-action="copy">${esc(txt('BILL_COPY'))}</button>
  </section>`;
}

export function renderSplit(data: SplitData, ui: SplitUi, result: SplitResult): string {
  const discountBaht = data.settings.discountSatang > 0 ? String(data.settings.discountSatang / 100) : '';
  return `${header()}
  <main class="layout">
    <div class="col-main">
      <section class="card">
        <input class="input" type="text" maxlength="60" value="${esc(data.shopName)}" data-split-change="shop"
          placeholder="${esc(txt('BILL_SHOP_PLACEHOLDER'))}" aria-label="${esc(txt('BILL_SHOP_PLACEHOLDER'))}">
        <input class="input" type="text" maxlength="120" value="${esc(data.note)}" data-split-change="note"
          placeholder="${esc(txt('BILL_NOTE_PLACEHOLDER'))}" aria-label="${esc(txt('BILL_NOTE_PLACEHOLDER'))}">
      </section>
      ${clearRow(ui)}
      ${peopleCard(data, ui)}
      ${itemFormCard(data, ui)}
      ${itemsCard(data, ui)}
      ${settingsCard(data.settings, discountBaht)}
    </div>
    <aside class="col-side">${summaryCard(data, ui, result)}</aside>
  </main>`;
}
