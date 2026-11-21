// Markup builders. Pure: data in, HTML string out. Every user-typed value goes through esc().
// Labels come only from strings/th.ts; no colour or font literals (they are CSS variables).
import { PLATE_BRAND_ORDER, BRANDS, type BrandDef, type BrandId } from '../config/brands.ts';
import { STRINGS } from '../strings/th.ts';
import { esc } from '../logic/escape.ts';
import { SHARE_ENABLED } from '../config/features.ts';
import { formatBaht } from '../logic/money.ts';
import { brandPlateTotal, budgetStatus, type PlateRow, type View } from '../logic/view-model.ts';
import type { AppState } from '../logic/cells.ts';

export interface ShareUi {
  open: boolean;
  tab: 'host' | 'guest';
  status: string;
  invite: string;
  reply: string;
  inviteDraft: string;
  replyDraft: string;
  busy: boolean;
  error: string;
}

export interface UiState {
  target: string | null;
  taxOpen: boolean;
  clearOpen: boolean;
  share: ShareUi;
}

type StringKey = keyof typeof STRINGS;
const txt = (key: string): string => String(STRINGS[key as StringKey]);
const fn1 = (key: string) => STRINGS[key as StringKey] as (arg: never) => string;
const baht = (satang: number): string => formatBaht(satang);
const taxBadge = (brand: BrandDef): string =>
  brand.taxType === 'plus_plus' ? STRINGS.TAX_BADGE_PLUS_PLUS : STRINGS.TAX_BADGE_VAT_INCL;
const subtotalLabel = (brand: BrandDef): string =>
  brand.taxType === 'plus_plus' ? STRINGS.SUBTOTAL_PLUS_PLUS : STRINGS.SUBTOTAL_VAT_INCL;

function targetName(state: AppState, target: string): string {
  if (target === 'shared') return STRINGS.SHARED_POOL;
  return state.people.find((p) => p.id === target)?.name ?? '';
}

function header(view: View): string {
  const brand = view.brand;
  return `
  <header class="topbar">
    <div class="brand-mark" aria-hidden="true">🍣</div>
    <div class="topbar-text">
      <div class="topbar-title">
        <h1>${esc(brand.shortName)}</h1>
        <span class="chip chip-tax">${esc(taxBadge(brand))}</span>
      </div>
      <p class="muted">${esc(txt(brand.subKey))}</p>
    </div>
    <div class="topbar-actions">
      ${SHARE_ENABLED ? `<button class="btn btn-ghost" data-action="open-share" type="button">${esc(STRINGS.BTN_SHARE)}</button>` : ""}
      <button class="btn btn-soft" data-action="open-clear" type="button">${esc(STRINGS.BTN_CLEAR)}</button>
    </div>
  </header>
  ${brand.status === 'unverified' ? `<div class="banner banner-warn" role="note">
    <strong>${esc(STRINGS.BADGE_UNVERIFIED)}</strong> ${esc(STRINGS.BANNER_UNVERIFIED)}
    <div class="muted small">${esc(txt(brand.noteKey))} · ${esc(STRINGS.BANNER_CHECKED(brand.checkedAt))}</div>
  </div>` : ''}`;
}

function brandTabs(state: AppState): string {
  return `<nav class="brand-tabs" aria-label="${esc(STRINGS.BRAND_SECTION)}">
    ${PLATE_BRAND_ORDER.map((id: BrandId) => {
      const b = BRANDS[id];
      const active = id === state.brandId;
      const count = brandPlateTotal(state, id);
      return `<button type="button" class="brand-tab${active ? ' is-active' : ''}" style="--brand-tab: var(--brand-${id}-primary)"
        data-action="brand" data-brand="${id}" aria-pressed="${active}">
        <span class="dot" aria-hidden="true"></span>
        <span>${esc(b.shortName)}</span>
        ${count > 0 ? `<span class="count">${esc(STRINGS.BRAND_COUNT(count))}</span>` : ''}
      </button>`;
    }).join('')}
  </nav>`;
}

function budgetCard(view: View): string {
  const status = budgetStatus(view.bill.grandSatang, view.budget);
  let feedback = '';
  if (status) {
    const amount = baht(Math.abs(status.remaining));
    const text = status.level === 'over' ? STRINGS.BUDGET_OVER(amount)
      : status.level === 'warn' ? STRINGS.BUDGET_WARN(amount) : STRINGS.BUDGET_OK(amount);
    feedback = `<div class="meter"><span class="meter-fill is-${status.level}" style="width: ${Math.round(status.ratio * 100)}%"></span></div>
      <p class="level-${status.level} small">${esc(text)}</p>`;
  }
  return `<section class="card">
    <div class="row-between">
      <h2>${esc(STRINGS.BUDGET_TITLE)}</h2>
      <label class="inline-field">${esc(STRINGS.BUDGET_LABEL)}
        <input type="number" min="0" step="50" inputmode="numeric" value="${view.budget || ''}" data-change="budget" class="input input-num">
      </label>
    </div>
    ${feedback || `<p class="muted small">${esc(STRINGS.BUDGET_HINT)}</p>`}
  </section>`;
}

// In table mode the chip is only a name field. In person mode it also selects the counting target.
function personChip(person: { id: string; name: string }, selectable: boolean, active: boolean): string {
  return `<div class="person-chip${active ? ' is-active' : ''}" ${selectable ? `data-action="target" data-target="${esc(person.id)}"` : ''}>
    <input class="input input-name" type="text" maxlength="40" value="${esc(person.name)}"
      placeholder="${esc(STRINGS.PERSON_NAME_PLACEHOLDER)}" aria-label="${esc(STRINGS.PERSON_NAME_LABEL)}"
      data-change="person-name" data-person="${esc(person.id)}">
    <button type="button" class="icon-btn" data-action="remove-person" data-person="${esc(person.id)}" aria-label="${esc(STRINGS.BTN_REMOVE_PERSON)}">✕</button>
  </div>`;
}

function modeCard(state: AppState, view: View): string {
  const table = state.mode === 'table';
  const chips = table
    ? state.people.map((p) => personChip(p, false, false)).join('')
    : `<button type="button" class="person-chip${view.target === 'shared' ? ' is-active' : ''}" data-action="target" data-target="shared">
         <span>${esc(STRINGS.SHARED_POOL)}</span>
       </button>` + state.people.map((p) => personChip(p, true, view.target === p.id)).join('');
  return `<section class="card">
    <div class="row-between">
      <h2>${esc(STRINGS.MODE_TITLE)}</h2>
      <button type="button" class="btn btn-soft small" data-action="add-person">${esc(STRINGS.BTN_ADD_PERSON)}</button>
    </div>
    <div class="segmented" role="group">
      <button type="button" class="${table ? 'is-active' : ''}" data-action="mode" data-mode="table" aria-pressed="${table}">${esc(STRINGS.MODE_TABLE)}</button>
      <button type="button" class="${table ? '' : 'is-active'}" data-action="mode" data-mode="person" aria-pressed="${!table}">${esc(STRINGS.MODE_PERSON)}</button>
    </div>
    <p class="muted small">${esc(table ? STRINGS.MODE_TABLE_HELP : STRINGS.MODE_PERSON_HELP)}</p>
    <p class="label">${esc(STRINGS.PEOPLE_LABEL)}</p>
    <div class="people">${chips}</div>
    ${!table ? `<p class="accent small">${esc(STRINGS.ACTIVE_TARGET(targetName(state, view.target)))}</p>` : ''}
  </section>`;
}

function platesCard(state: AppState, view: View): string {
  const rows = view.plateRows.map((p: PlateRow) => {
    const name = txt(p.nameKey);
    const total = p.count * p.price * 100;
    return `<div class="plate-row${p.count > 0 ? ' is-active' : ''}">
      <div class="plate-main">
        <span class="plate-swatch" style="--plate-fill: var(--plate-${p.color})" aria-hidden="true"><span class="plate-inner">${p.price}฿</span></span>
        <div>
          <h3>${esc(name)} <span class="price-tag">${p.price} ฿</span></h3>
          <p class="muted small">${esc(txt(p.descKey))}</p>
          ${p.count > 0 ? `<p class="accent small">${esc(STRINGS.PLATE_LINE_TOTAL(baht(total)))}</p>` : ''}
        </div>
      </div>
      <div class="stepper">
        <button type="button" class="step" data-action="plate" data-plate="${p.id}" data-delta="-1"
          aria-label="${esc(fn1('PLATE_DECREASE')(name as never))}">−</button>
        <input class="input input-count" type="number" min="0" max="999" inputmode="numeric" value="${p.count}"
          aria-label="${esc(name)}" data-change="plate-input" data-plate="${p.id}">
        <button type="button" class="step step-primary" data-action="plate" data-plate="${p.id}" data-delta="1"
          aria-label="${esc(fn1('PLATE_INCREASE')(name as never))}">+</button>
      </div>
    </div>`;
  }).join('');
  const owner = state.mode === 'table' ? '' : ` · ${esc(STRINGS.ACTIVE_TARGET(targetName(state, view.target)))}`;
  return `<section class="card">
    <div class="row-between">
      <h2>${esc(STRINGS.PLATES_TITLE(view.brand.shortName))}</h2>
      <span class="count">${esc(STRINGS.BRAND_COUNT(view.plateTotal))}</span>
    </div>
    <p class="muted small">${esc(view.brand.taxType === 'plus_plus' ? STRINGS.PLATE_SUBTITLE_PLUS_PLUS : STRINGS.PLATE_SUBTITLE_VAT_INCL)}${owner}</p>
    <div class="plates">${rows}</div>
  </section>`;
}

function extrasCard(view: View): string {
  const presets = view.brand.presets.map((preset, index) => {
    const text = STRINGS[preset.textKey as StringKey] as unknown as { name: string; sub: string };
    return `<button type="button" class="preset" data-action="preset" data-index="${index}">
      <span class="preset-top"><span aria-hidden="true">${preset.emoji}</span>
      <span class="preset-price">${preset.price === 0 ? '0 ฿' : `+${preset.price} ฿`}</span></span>
      <strong>${esc(text.name)}</strong>
      <span class="muted small">${esc(text.sub)}</span>
    </button>`;
  }).join('');
  const list = view.extras.length === 0 ? '' : `<p class="label">${esc(STRINGS.EXTRA_LIST(view.extras.length))}</p>` +
    view.extras.map((e) => `<div class="extra-row">
      <div><strong>${esc(e.name)}</strong>
        <div class="muted small">${baht(e.price * 100)} ฿ × ${e.qty} = ${baht(e.price * e.qty * 100)} ฿</div></div>
      <div class="stepper">
        <button type="button" class="step" data-action="extra" data-id="${esc(e.id)}" data-delta="-1"
          aria-label="${esc(fn1('EXTRA_DECREASE')(e.name as never))}">−</button>
        <span class="qty">${e.qty}</span>
        <button type="button" class="step step-primary" data-action="extra" data-id="${esc(e.id)}" data-delta="1"
          aria-label="${esc(fn1('EXTRA_INCREASE')(e.name as never))}">+</button>
      </div>
    </div>`).join('');
  return `<section class="card">
    <h2>${esc(STRINGS.EXTRAS_TITLE)}</h2>
    <p class="muted small">${esc(STRINGS.EXTRAS_HINT)}</p>
    <div class="presets">${presets}</div>
    <form class="custom-form" data-form="custom">
      <input class="input" name="extraName" type="text" maxlength="60" placeholder="${esc(STRINGS.EXTRA_NAME_PLACEHOLDER)}">
      <input class="input input-num" name="extraPrice" type="number" min="0" step="1" required placeholder="${esc(STRINGS.EXTRA_PRICE_PLACEHOLDER)}">
      <input class="input input-count" name="extraQty" type="number" min="1" max="99" value="1" aria-label="${esc(STRINGS.EXTRA_QTY_LABEL)}">
      <button class="btn btn-primary" type="submit">${esc(STRINGS.BTN_ADD_EXTRA)}</button>
    </form>
    <div class="extras">${list}</div>
  </section>`;
}

function tableSplit(state: AppState, view: View): string {
  const rows = view.equalShares.map((s) => `<div class="split-row"><span>${esc(s.name)}</span>
    <strong>${baht(s.grandSatang)} ฿</strong></div>`).join('');
  const per = view.equalShares[0] ? baht(view.equalShares[0].grandSatang) : baht(0);
  return `<div class="split">
    <div class="row-between"><h3>${esc(STRINGS.SPLIT_EQUAL_TITLE)} ${esc(STRINGS.PEOPLE_COUNT(state.people.length))}</h3>
      <span class="small muted">${esc(STRINGS.SPLIT_PER_PERSON)} ${per} ฿</span></div>
    ${rows}
  </div>`;
}

function personSplit(state: AppState, view: View): string {
  const rows = view.shares.map((s) => `<div class="share-card">
    <div class="row-between"><strong>${esc(s.name)} <span class="muted small">${esc(STRINGS.SPLIT_PLATES(s.plateCount))}</span></strong>
      <strong class="accent">${baht(s.grandSatang)} ฿</strong></div>
    <p class="muted small">${esc(STRINGS.SPLIT_FOOD)} ${baht(s.personalSatang + s.sharedSatang)}
      ${s.sharedSatang > 0 ? ` (${esc(STRINGS.SPLIT_SHARED)} ${baht(s.sharedSatang)})` : ''}
      ${s.discountSatang > 0 ? ` · ${esc(STRINGS.SPLIT_DISCOUNT)} -${baht(s.discountSatang)}` : ''}
      · ${esc(STRINGS.SPLIT_ADDED)} ${baht(s.addedSatang)}</p>
  </div>`).join('');
  return `<div class="split">
    <div class="row-between"><h3>${esc(STRINGS.SPLIT_INDIVIDUAL_TITLE)}</h3>
      <label class="toggle small"><input type="checkbox" data-change="equal-tax" ${state.equalTaxSplit ? 'checked' : ''}>
        ${esc(STRINGS.EQUAL_TAX_SPLIT)}</label></div>
    <p class="muted small">${esc(state.equalTaxSplit ? STRINGS.TAX_MODE_EQUAL : STRINGS.TAX_MODE_PROPORTIONAL)}</p>
    ${rows}
  </div>`;
}

function receiptCard(state: AppState, view: View, taxOpen: boolean): string {
  const { bill, brand } = view;
  const empty = view.plateTotal === 0 && view.extraQty === 0;
  const perPlate = view.plateTotal > 0 ? baht(Math.round(bill.grandSatang / view.plateTotal)) : null;
  const split = state.mode === 'table' ? tableSplit(state, view) : personSplit(state, view);
  return `<section class="card receipt">
    <div class="receipt-strip" style="background: var(--brand-primary)"></div>
    <div class="row-between">
      <div>
        <h2>${esc(STRINGS.RECEIPT_TITLE)} <span class="tag" style="background: var(--brand-soft); color: var(--brand-primary)">${esc(brand.shortName)}</span></h2>
        <p class="muted small">${esc(STRINGS.RECEIPT_COUNT(view.plateTotal, view.extraQty))}</p>
      </div>
      <label class="toggle"><input type="checkbox" data-change="sc" ${view.sc ? 'checked' : ''}> ${esc(STRINGS.SC_TOGGLE)}</label>
    </div>
    <div class="discount-row">
      <label class="label" for="discount-input">${esc(STRINGS.DISCOUNT_LABEL)}</label>
      <div class="stepper">
        <button type="button" class="chip-btn" data-action="discount" data-amount="40">-40</button>
        <button type="button" class="chip-btn" data-action="discount" data-amount="100">-100</button>
        <input id="discount-input" class="input input-num" type="number" min="0" step="1" value="${view.discount || 0}" data-change="discount">
      </div>
    </div>
    ${empty ? `<p class="muted empty">${esc(STRINGS.EMPTY_BILL)}</p>` : ''}
    <dl class="totals">
      <div><dt>${esc(subtotalLabel(brand))}</dt><dd>${baht(bill.grossSatang)} ฿</dd></div>
      ${bill.discountSatang > 0 ? `<div class="good"><dt>${esc(STRINGS.ROW_DISCOUNT)}</dt><dd>-${baht(bill.discountSatang)} ฿</dd></div>` : ''}
      <div><dt>${esc(view.sc ? STRINGS.ROW_SC : STRINGS.ROW_SC_OFF)}</dt><dd>${baht(bill.scSatang)} ฿</dd></div>
      ${brand.taxType === 'plus_plus' ? `<div><dt>${esc(STRINGS.ROW_VAT)}</dt><dd>${baht(bill.vatSatang)} ฿</dd></div>` : ''}
    </dl>
    <div class="grand">
      <div>
        <p>${esc(STRINGS.ROW_GRAND)}</p>
        <p class="muted small">${esc(perPlate ? STRINGS.AVG_PER_PLATE(perPlate) : STRINGS.AVG_EMPTY)}</p>
      </div>
      <strong>${baht(bill.grandSatang)} ฿</strong>
    </div>
    <details class="tax-details" data-tax-details${taxOpen ? ' open' : ''}>
      <summary>${esc(STRINGS.TAX_DETAILS)}</summary>
      <p class="small">${esc(STRINGS.TAX_PRE_VAT)}: ${baht(bill.grandSatang - bill.vatSatang)} ฿ · ${esc(STRINGS.TAX_VAT_AMOUNT)}: ${baht(bill.vatSatang)} ฿</p>
      <p class="muted small">${esc(brand.taxType === 'plus_plus' ? STRINGS.FOOTNOTE_PLUS_PLUS : STRINGS.FOOTNOTE_VAT_INCL)}</p>
    </details>
    ${split}
    <button type="button" class="btn btn-outline full" data-action="copy">${esc(STRINGS.BTN_COPY_SUMMARY)}</button>
  </section>`;
}

export function renderBody(state: AppState, view: View, ui: UiState): string {
  return `${header(view)}
  ${brandTabs(state)}
  <main class="layout">
    <div class="col-main">
      ${budgetCard(view)}
      ${modeCard(state, view)}
      ${platesCard(state, view)}
      ${extrasCard(view)}
    </div>
    <aside class="col-side">${receiptCard(state, view, ui.taxOpen)}</aside>
  </main>`;
}

// Share dialog. Draft text is kept in ui state so a re-render does not wipe what the user pasted.
export function renderShare(share: ShareUi, sessionActive: boolean): string {
  const tab = share.tab;
  const body = tab === 'host'
    ? `<p class="hint">${esc(STRINGS.SHARE_HOST_STEP1)}</p>
       ${share.invite
         ? `<textarea class="code" readonly rows="4" aria-label="${esc(STRINGS.SHARE_TAB_HOST)}">${esc(share.invite)}</textarea>
            <button type="button" class="btn btn-outline" data-action="copy-code" data-code="invite">${esc(STRINGS.BTN_COPY_CODE)}</button>`
         : `<button type="button" class="btn btn-primary" data-action="create-invite" ${share.busy ? 'disabled' : ''}>${esc(share.busy ? STRINGS.CODE_BUSY : STRINGS.BTN_CREATE_INVITE)}</button>`}
       <p class="hint">${esc(STRINGS.SHARE_HOST_STEP2)}</p>
       <textarea class="code" rows="3" placeholder="${esc(STRINGS.CODE_PLACEHOLDER)}" data-share-draft="reply">${esc(share.replyDraft)}</textarea>
       <button type="button" class="btn btn-primary" data-action="accept-reply">${esc(STRINGS.BTN_CONNECT)}</button>`
    : `<p class="hint">${esc(STRINGS.SHARE_GUEST_STEP1)}</p>
       <textarea class="code" rows="4" placeholder="${esc(STRINGS.CODE_PLACEHOLDER)}" data-share-draft="invite">${esc(share.inviteDraft)}</textarea>
       <button type="button" class="btn btn-primary" data-action="join" ${share.busy ? 'disabled' : ''}>${esc(share.busy ? STRINGS.CODE_BUSY : STRINGS.BTN_CREATE_REPLY)}</button>
       ${share.reply
         ? `<p class="hint">${esc(STRINGS.SHARE_GUEST_STEP2)}</p>
            <textarea class="code" readonly rows="4">${esc(share.reply)}</textarea>
            <button type="button" class="btn btn-outline" data-action="copy-code" data-code="reply">${esc(STRINGS.BTN_COPY_CODE)}</button>`
         : ''}`;
  const statusKeys: Record<string, string> = {
    idle: STRINGS.SHARE_STATUS_IDLE,
    waiting: STRINGS.SHARE_STATUS_WAITING,
    connecting: STRINGS.SHARE_STATUS_CONNECTING,
    connected: STRINGS.SHARE_STATUS_CONNECTED,
    failed: STRINGS.SHARE_STATUS_FAILED,
    closed: STRINGS.SHARE_STATUS_IDLE,
  };
  const statusText = statusKeys[share.status] ?? STRINGS.SHARE_STATUS_IDLE;
  return `<div class="modal-backdrop" data-action="close-share-backdrop">
    <section class="modal" role="dialog" aria-modal="true" aria-label="${esc(STRINGS.SHARE_TITLE)}">
      <div class="row-between"><h2>${esc(STRINGS.SHARE_TITLE)}</h2>
        <button type="button" class="icon-btn" data-action="close-share" aria-label="${esc(STRINGS.BTN_CLOSE)}">✕</button></div>
      <p class="muted small">${esc(STRINGS.SHARE_INTRO)}</p>
      <div class="segmented" role="group">
        <button type="button" class="${tab === 'host' ? 'is-active' : ''}" data-action="share-tab" data-tab="host">${esc(STRINGS.SHARE_TAB_HOST)}</button>
        <button type="button" class="${tab === 'guest' ? 'is-active' : ''}" data-action="share-tab" data-tab="guest">${esc(STRINGS.SHARE_TAB_GUEST)}</button>
      </div>
      ${body}
      ${share.error ? `<p class="level-over small">${esc(share.error)}</p>` : ''}
      <p class="status status-${esc(share.status)}">${esc(statusText)}</p>
      ${sessionActive ? `<button type="button" class="btn btn-soft" data-action="disconnect">${esc(STRINGS.BTN_DISCONNECT)}</button>` : ''}
    </section>
  </div>`;
}

export function renderClear(brand: BrandDef): string {
  return `<div class="modal-backdrop" data-action="close-clear-backdrop">
    <section class="modal modal-small" role="dialog" aria-modal="true" aria-label="${esc(STRINGS.CLEAR_TITLE)}">
      <h2>${esc(STRINGS.CLEAR_TITLE)}</h2>
      <p class="muted small">${esc(STRINGS.CLEAR_DESC(brand.shortName))}</p>
      <div class="grid-2">
        <button type="button" class="btn btn-soft" data-action="close-clear">${esc(STRINGS.BTN_CANCEL)}</button>
        <button type="button" class="btn btn-danger" data-action="confirm-clear">${esc(STRINGS.BTN_CONFIRM_CLEAR)}</button>
      </div>
    </section>
  </div>`;
}
