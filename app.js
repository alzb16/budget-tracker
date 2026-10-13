'use strict';

const VERSION = '1.0';

const CATS = {
  expense: [
    ['food', 'Food', '🍜'], ['transport', 'Transport', '🚌'], ['school', 'School', '📚'],
    ['groceries', 'Groceries', '🛒'], ['bills', 'Bills', '💡'], ['load', 'Load & Data', '📶'],
    ['shopping', 'Shopping', '🛍️'], ['health', 'Health', '💊'], ['fun', 'Entertainment', '🎬'],
    ['housing', 'Rent & Housing', '🏠'], ['other', 'Other', '📦'],
  ],
  income: [
    ['allowance', 'Allowance', '💵'], ['salary', 'Salary', '💼'], ['scholarship', 'Scholarship', '🎓'],
    ['gift', 'Gift', '🎁'], ['refund', 'Refund', '↩️'], ['other-income', 'Other income', '➕'],
  ],
};
const CAT_INFO = {};
for (const type in CATS) for (const [id, name, icon] of CATS[type]) CAT_INFO[id] = { name, icon, type };

// Built-in keyword rules. Order matters: the first category with a match wins,
// so more specific names (GrabFood, Globe At Home) sit ahead of general ones.
const RULES = {
  expense: [
    ['food', ['grabfood', 'foodpanda', 'jollibee', 'mcdo', 'mcdonald', 'kfc', 'chowking', 'mang inasal', 'greenwich', 'shakey', 'bonchon', 'starbucks', 'dunkin', 'potato corner', 'turks', 'zagu', 'coffee', 'cafe', 'canteen', 'cafeteria', 'carinderia', 'milk tea', 'milktea', 'pizza', 'burger', 'restaurant', 'resto', 'bakery', 'bakeshop', '7-eleven', '7 eleven', 'ministop', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'merienda', 'meryenda', 'food', 'kain', 'ulam']],
    ['bills', ['meralco', 'maynilad', 'manila water', 'pldt', 'converge', 'globe at home', 'sky cable', 'skycable', 'electric', 'electricity', 'water bill', 'internet', 'wifi', 'kuryente', 'bill', 'bills']],
    ['transport', ['grab', 'angkas', 'joyride', 'move it', 'moveit', 'jeep', 'jeepney', 'tricycle', 'trike', 'bus', 'lrt', 'mrt', 'beep', 'taxi', 'fare', 'pamasahe', 'gas', 'gasoline', 'petron', 'shell', 'caltex', 'toll', 'easytrip', 'autosweep', 'parking', 'commute']],
    ['load', ['buy load', 'load', 'globe', 'smart', 'tnt', 'dito', 'gomo', 'prepaid', 'data promo', 'eload']],
    ['school', ['tuition', 'ateneo', 'university', 'school', 'college', 'book', 'books', 'bookstore', 'national book', 'photocopy', 'xerox', 'print', 'printing', 'org fee', 'lab fee', 'school supplies', 'readings', 'review center']],
    ['groceries', ['supermarket', 'puregold', 'savemore', 'landers', 's&r', 'grocery', 'groceries', 'palengke', 'market', 'alfamart', 'waltermart', 'shopwise']],
    ['shopping', ['shopee', 'lazada', 'zalora', 'uniqlo', 'tiktok shop', 'h&m', 'miniso', 'sm store', 'department store', 'clothes', 'shoes']],
    ['health', ['mercury', 'watsons', 'southstar', 'pharmacy', 'drugstore', 'clinic', 'hospital', 'dental', 'dentist', 'medicine', 'gamot', 'checkup', 'gym']],
    ['fun', ['netflix', 'spotify', 'youtube', 'disney', 'cinema', 'movie', 'steam', 'games', 'concert', 'ticket', 'gala']],
    ['housing', ['rent', 'dorm', 'dormitory', 'condo', 'landlord', 'laundry', 'upa']],
  ],
  income: [
    ['allowance', ['allowance', 'baon']],
    ['salary', ['salary', 'sweldo', 'payroll', 'wage', 'sahod', 'freelance']],
    ['scholarship', ['scholarship', 'stipend', 'grant']],
    ['refund', ['refund', 'reversal', 'cashback', 'bayad utang']],
    ['gift', ['gift', 'regalo', 'pamasko', 'birthday']],
  ],
};

/* ---------- storage ---------- */

const state = { tx: [], settings: { budget: 0, myNames: [] }, learned: {} };

const store = {
  db: null,
  open() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('pbt', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; resolve(); };
        req.onerror = () => resolve();
      } catch { resolve(); }
    });
  },
  get(key) {
    if (!this.db) return Promise.resolve(JSON.parse(localStorage.getItem('pbt:' + key) || 'null'));
    return new Promise((resolve) => {
      const req = this.db.transaction('kv').objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  },
  set(key, value) {
    if (!this.db) { localStorage.setItem('pbt:' + key, JSON.stringify(value)); return; }
    this.db.transaction('kv', 'readwrite').objectStore('kv').put(value, key);
  },
};

function save() { store.set('state', state); }

function applyState(data) {
  state.tx = Array.isArray(data?.tx) ? data.tx : [];
  state.settings = { budget: 0, myNames: [], ...(data?.settings || {}) };
  state.learned = data?.learned || {};
}

/* ---------- helpers ---------- */

const $ = (id) => document.getElementById(id);
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const money = (n) => peso.format(n || 0);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const parseAmount = (s) => { const n = parseFloat(String(s).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- categorising ---------- */

function hasWord(text, kw) {
  const i = text.indexOf(kw);
  if (i < 0) return false;
  const before = text[i - 1], after = text[i + kw.length];
  return !(before && /[a-z0-9]/.test(before)) && !(after && /[a-z0-9]/.test(after));
}

// Returns a category id, or '' when nothing matches (shown as Uncategorized).
function suggestCategory(type, payee, note) {
  if (type === 'transfer') return '';
  const learned = state.learned[norm(payee)];
  if (learned?.type === type && learned.category) return learned.category;
  const text = `${payee || ''} ${note || ''}`.toLowerCase();
  for (const [cat, words] of RULES[type] || []) {
    if (words.some((w) => hasWord(text, w))) return cat;
  }
  return '';
}

function isMine(payee) {
  const p = norm(payee);
  if (!p) return false;
  return state.settings.myNames.some((n) => { const m = norm(n); return m && (p.includes(m) || m.includes(p)); });
}

/* ---------- reading receipts ---------- */

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function makeDate(y, m, d) {
  y = +y; m = +m; d = +d;
  if (!(y > 2000 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function findDate(text) {
  const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  let m;
  if ((m = text.match(new RegExp(`\\b${mon}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i')))) return makeDate(m[3], MONTHS[m[1].toLowerCase()], m[2]);
  if ((m = text.match(new RegExp(`\\b(\\d{1,2})[\\s-]+${mon},?[\\s-]+(\\d{4})`, 'i')))) return makeDate(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  if ((m = text.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) return makeDate(m[1], m[2], m[3]);
  // Local apps print month first; fall back to day first when that can't be a month.
  if ((m = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/))) return +m[1] > 12 ? makeDate(m[3], m[2], m[1]) : makeDate(m[3], m[1], m[2]);
  return null;
}

const DECIMAL = /\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2}/g;
const toNum = (s) => parseFloat(s.replace(/,/g, ''));

function findAmount(lines) {
  const keys = [/total amount sent/i, /total amount/i, /amount (sent|paid|transferred|received|due)/i, /\btotal\b/i, /\bamount\b/i];
  for (const key of keys) {
    for (let i = 0; i < lines.length; i++) {
      const hit = lines[i].match(key);
      if (!hit) continue;
      const rest = lines[i].slice(hit.index + hit[0].length);
      const found = rest.match(DECIMAL) || (lines[i + 1] || '').match(DECIMAL);
      if (found && toNum(found[0]) > 0) return toNum(found[0]);
    }
  }
  const all = lines.join('\n');
  const marked = [...all.matchAll(/(?:₱|PHP|Php|php|P)\s?(\d[\d,]*\.\d{2})/g)].map((m) => toNum(m[1]));
  if (marked.length) return Math.max(...marked);
  const any = (all.match(DECIMAL) || []).map(toNum);
  return any.length ? Math.max(...any) : 0;
}

function findRef(text) {
  const m = text.match(/ref(?:erence)?\.?\s*(?:no|number|num|id|#)?\.?\s*[:#-]?\s*([A-Z0-9][A-Z0-9 -]{5,40})/i);
  if (!m) return '';
  // Stop before a digit group that is really the start of a date printed on the same line.
  const digits = text.slice(m.index + m[0].length - m[1].length).match(/^\d+(?: \d+)*(?![\d/-])/);
  if (digits && digits[0].replace(/ /g, '').length >= 6) return digits[0].replace(/ /g, '');
  const token = m[1].match(/^[A-Z0-9-]{6,}/i);
  return token ? token[0] : '';
}

const PHONE = /(\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/;

function cleanName(s) {
  return s.replace(PHONE, '').replace(/[₱|:;]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–.,]+|[\s\-–,]+$/g, '');
}

function findPayee(lines, type) {
  const outgoing = /^(?:sent to|paid to|pay to|transfer(?:red)? to|send to|recipient(?: name)?|receiver(?: name)?|merchant(?: name)?|biller(?: name)?|beneficiary(?: name)?|account name|destination account|to)\b\s*[:\-]?\s*(.*)$/i;
  const incoming = /^(?:received from|sent by|sender(?: name)?|source account|from)\b\s*[:\-]?\s*(.*)$/i;
  const order = type === 'income' ? [incoming, outgoing] : [outgoing, incoming];
  for (const label of order) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(label);
      if (!m) continue;
      for (const candidate of [m[1], lines[i + 1] || '']) {
        const name = cleanName(candidate);
        if (name.length >= 2 && name.length <= 48 && /[a-z]/i.test(name) && !/\d\.\d{2}/.test(name)) return name;
      }
    }
  }
  // One-line notices such as "You have received PHP 500.00 of GCash from JUAN D. 0917..."
  const inline = type === 'income'
    ? /\bfrom\s+([A-Z*][\w*.' -]{1,40}?)(?=\s+(?:\+?\d|on\b|with\b|via\b|w\/)|[,;]|$)/m
    : /\b(?:sent|paid|transferred)\b[^\n]*?\bto\s+([A-Z*][\w*.' -]{1,40}?)(?=\s+(?:\+?\d|on\b|with\b|via\b|w\/)|[,;]|$)/m;
  const hit = lines.join('\n').match(inline);
  if (hit && cleanName(hit[1]).length >= 2) return cleanName(hit[1]);
  // GCash-style receipts print the name directly above the mobile number.
  for (let i = 0; i < lines.length; i++) {
    if (!PHONE.test(lines[i])) continue;
    const same = cleanName(lines[i]);
    if (same.length >= 2 && same.length <= 48 && /[a-z]/i.test(same) && !/\d\.\d{2}/.test(same)) return same;
    const above = cleanName(lines[i - 1] || '');
    if (above.length >= 2 && above.length <= 48 && /[a-z]/i.test(above)) return above;
  }
  return '';
}

function parseReceipt(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const low = text.toLowerCase();
  let type = 'expense';
  let hint = '';
  if (/cash[\s-]?in/.test(low)) type = 'transfer';
  else if (/received|credited to your|money in\b/.test(low) && !/amount received by/.test(low)) type = 'income';
  if (/buy load|load purchase/.test(low)) hint = 'load';
  else if (/pay bills|bills payment|biller/.test(low)) hint = 'bills';

  const payee = findPayee(lines, type);
  if (type === 'expense' && isMine(payee)) type = 'transfer';
  const learned = state.learned[norm(payee)];
  if (learned?.type === 'transfer' && type === 'expense') type = 'transfer';

  return {
    type,
    amount: findAmount(lines),
    date: findDate(text) || today(),
    payee,
    ref: findRef(text),
    category: suggestCategory(type, payee, '') || (type === 'expense' ? hint : ''),
  };
}

let ocrWorker = null;
let onOcrProgress = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

async function readImage(blob, onProgress) {
  onOcrProgress = onProgress;
  if (!ocrWorker) {
    if (!window.Tesseract) await loadScript('vendor/tesseract/tesseract.min.js');
    const at = (p) => new URL(p, location.href).href;
    ocrWorker = await Tesseract.createWorker('eng', 1, {
      workerPath: at('vendor/tesseract/worker.min.js'),
      corePath: at('vendor/tesseract/'),
      langPath: at('vendor/tesseract/lang'),
      workerBlobURL: false,
      logger: (m) => { if (m.status === 'recognizing text' && onOcrProgress) onOcrProgress(m.progress); },
    });
  }
  const { data } = await ocrWorker.recognize(blob);
  return data.text || '';
}

/* ---------- views ---------- */

let month = today().slice(0, 7);
let filter = 'all';

const inMonth = (t) => t.date.slice(0, 7) === month;
const byNewest = (a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''));

function txRow(t) {
  const info = CAT_INFO[t.category];
  const icon = t.type === 'transfer' ? '🔁' : info ? info.icon : '❔';
  const catName = t.type === 'transfer' ? 'Transfer' : info ? info.name : '<span class="flag">Uncategorized</span>';
  const title = t.payee || t.note || (info ? info.name : t.type === 'transfer' ? 'Transfer' : 'Transaction');
  const extra = t.payee && t.note ? ' · ' + esc(t.note) : '';
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
  const cls = t.type === 'income' ? 'pos' : t.type === 'transfer' ? 'transfer' : '';
  return `<button class="tx" data-id="${esc(t.id)}">
    <span class="ico">${icon}</span>
    <span class="mid"><span class="name">${esc(title)}</span><br><span class="meta">${catName}${extra}</span></span>
    <span class="amt ${cls}">${sign}${money(t.amount)}</span>
  </button>`;
}

function renderHome() {
  const [y, m] = month.split('-').map(Number);
  $('monthLabel').textContent = new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  $('nextMonth').disabled = month >= today().slice(0, 7);

  const txs = state.tx.filter(inMonth);
  const spent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  $('incomeTotal').textContent = money(income);
  $('spentTotal').textContent = money(spent);

  const budget = state.settings.budget;
  if (!budget) {
    $('budgetCard').innerHTML = `<p class="label">Monthly budget</p>
      <p class="empty">Set a budget to see how much you have left this month.</p>
      <button class="btn primary" data-goto="settings">Set a budget</button>`;
  } else {
    const left = budget - spent;
    const ratio = spent / budget;
    const tone = ratio > 1 ? 'over' : ratio >= 0.85 ? 'warn' : '';
    let note = '';
    if (month === today().slice(0, 7)) {
      const daysLeft = new Date(y, m, 0).getDate() - new Date().getDate() + 1;
      note = left > 0 ? `${money(left / daysLeft)} a day for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}` : 'Budget used up';
    }
    $('budgetCard').innerHTML = `<p class="label">${left >= 0 ? 'Left to spend' : 'Over budget by'}</p>
      <p class="big ${left < 0 ? 'over' : ''}">${money(Math.abs(left))}</p>
      <div class="meter ${tone}" role="img" aria-label="${Math.round(ratio * 100)}% of budget spent"><i style="width:${Math.min(100, ratio * 100)}%"></i></div>
      <div class="sub"><span>${money(spent)} of ${money(budget)}</span><span>${esc(note)}</span></div>`;
  }

  const totals = {};
  for (const t of txs) if (t.type === 'expense') totals[t.category || ''] = (totals[t.category || ''] || 0) + t.amount;
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  $('breakdown').innerHTML = rows.length ? rows.map(([cat, amt]) => {
    const info = CAT_INFO[cat] || { name: 'Uncategorized', icon: '❔' };
    return `<div class="cat-row">
      <div class="cat-top"><span>${info.icon} ${esc(info.name)}</span><b>${money(amt)}<small>${Math.round((amt / spent) * 100)}%</small></b></div>
      <div class="cat-bar"><i style="width:${(amt / rows[0][1]) * 100}%"></i></div>
    </div>`;
  }).join('') : '<p class="blank">No spending recorded this month.</p>';

  const recent = [...txs].sort(byNewest).slice(0, 5);
  $('recent').innerHTML = recent.length ? recent.map(txRow).join('') : '<p class="blank">Nothing yet. Add your first transaction.</p>';
}

function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const txs = state.tx.filter((t) => {
    if (filter === 'uncat') { if (t.type === 'transfer' || t.category) return false; }
    else if (filter !== 'all' && t.type !== filter) return false;
    if (!q) return true;
    return `${t.payee} ${t.note} ${CAT_INFO[t.category]?.name || ''} ${t.ref}`.toLowerCase().includes(q);
  }).sort(byNewest);

  if (!txs.length) {
    $('allTx').innerHTML = `<p class="blank">${state.tx.length ? 'No transactions match.' : 'No transactions yet.'}</p>`;
    return;
  }
  const groups = new Map();
  for (const t of txs) { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); }
  let html = '';
  for (const [date, items] of groups) {
    const [y, m, d] = date.split('-').map(Number);
    const label = date === today() ? 'Today' : new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: y === new Date().getFullYear() ? undefined : 'numeric' });
    const net = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
    html += `<div class="day"><span>${esc(label)}</span><span>${net < 0 ? '−' : net > 0 ? '+' : ''}${money(Math.abs(net))}</span></div>
      <div class="card list">${items.map(txRow).join('')}</div>`;
  }
  $('allTx').innerHTML = html;
}

function renderSettings() {
  $('budgetInput').value = state.settings.budget ? state.settings.budget.toFixed(2) : '';
  $('myNames').value = state.settings.myNames.join(', ');
  $('version').textContent = VERSION;
  $('offlineState').textContent = navigator.onLine ? 'works offline once installed' : 'offline';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('installCard').innerHTML = standalone ? '' : `<div class="card pad"><b>Put this on your Home Screen</b>
    <p class="hint">On iPhone, open this page in Safari, tap the Share button, then “Add to Home Screen”. It then opens like an app and works without internet.</p></div>`;
}

function render() { renderHome(); renderList(); renderSettings(); }

function showTab(name) {
  for (const v of ['home', 'list', 'settings']) $('view-' + v).hidden = v !== name;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('fab').hidden = name !== 'list';
  window.scrollTo(0, 0);
}

/* ---------- add / edit sheet ---------- */

const form = { id: null, type: 'expense', category: '', catPicked: false, previewUrl: null };

function renderCats() {
  $('catWrap').hidden = form.type === 'transfer';
  $('transferHint').hidden = form.type !== 'transfer';
  $('payeeLbl').textContent = form.type === 'income' ? 'Received from' : form.type === 'transfer' ? 'Moved to' : 'Paid to';
  document.querySelectorAll('#typeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.type === form.type));
  $('catChips').innerHTML = (CATS[form.type] || []).map(([id, name, icon]) =>
    `<button class="chip ${id === form.category ? 'on' : ''}" data-cat="${id}">${icon} ${esc(name)}</button>`).join('');
  $('autoTag').hidden = form.catPicked || !form.category;
}

function autoCategorise() {
  if (form.catPicked || form.type === 'transfer') return;
  form.category = suggestCategory(form.type, $('fPayee').value, $('fNote').value);
  renderCats();
}

function setScanBox(html) { $('scanBox').innerHTML = html; }

function openSheet(tx) {
  form.id = tx?.id || null;
  form.type = tx?.type || 'expense';
  form.category = tx?.category || '';
  form.catPicked = Boolean(tx?.id && tx.category);
  $('sheetTitle').textContent = tx?.id ? 'Edit transaction' : 'New transaction';
  $('fAmount').value = tx?.amount ? tx.amount.toFixed(2) : '';
  $('fPayee').value = tx?.payee || '';
  $('fDate').value = tx?.date || today();
  $('fRef').value = tx?.ref || '';
  $('fNote').value = tx?.note || '';
  $('deleteBtn').hidden = !tx?.id;
  $('sheetScan').hidden = Boolean(tx?.id);
  setScanBox('');
  renderCats();
  $('backdrop').hidden = false;
  $('sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  $('sheet').hidden = true;
  $('backdrop').hidden = true;
  document.body.style.overflow = '';
  if (form.previewUrl) { URL.revokeObjectURL(form.previewUrl); form.previewUrl = null; }
}

function saveForm() {
  const amount = parseAmount($('fAmount').value);
  if (!(amount > 0)) { toast('Enter an amount first'); $('fAmount').focus(); return; }
  const ref = $('fRef').value.trim();
  const twin = ref && state.tx.find((t) => t.id !== form.id && t.ref && t.ref === ref);
  if (twin && !confirm(`You already saved a transaction with reference ${ref} (${money(twin.amount)} on ${twin.date}). Save this one anyway?`)) return;

  const existing = state.tx.find((t) => t.id === form.id);
  const tx = {
    id: form.id || uid(),
    type: form.type,
    amount,
    category: form.type === 'transfer' ? '' : form.category,
    date: $('fDate').value || today(),
    payee: $('fPayee').value.trim(),
    note: $('fNote').value.trim(),
    ref,
    source: existing?.source || (form.previewUrl ? 'scan' : 'manual'),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (existing) Object.assign(existing, tx); else state.tx.push(tx);

  // Remember what this payee was filed under, so next time it is automatic.
  const key = norm(tx.payee);
  if (key && (tx.type === 'transfer' || tx.category)) state.learned[key] = { type: tx.type, category: tx.category };

  save();
  if (tx.date.slice(0, 7) <= today().slice(0, 7)) month = tx.date.slice(0, 7);
  closeSheet();
  render();
  toast(existing ? 'Changes saved' : 'Saved');
}

async function scan(file) {
  if (!file) return;
  if ($('sheet').hidden) openSheet();
  if (form.previewUrl) URL.revokeObjectURL(form.previewUrl);
  form.previewUrl = URL.createObjectURL(file);
  const img = `<img src="${form.previewUrl}" alt="">`;
  setScanBox(`<div class="scan">${img}<div><p class="t">Reading screenshot…</p><p class="p">This happens on your phone. Nothing is uploaded.</p><div class="bar"><i id="scanBar"></i></div></div></div>`);
  try {
    const text = await readImage(file, (p) => { const bar = $('scanBar'); if (bar) bar.style.width = Math.round(p * 100) + '%'; });
    if ($('sheet').hidden) return;
    const r = parseReceipt(text);
    form.type = r.type;
    form.category = r.category;
    form.catPicked = false;
    if (r.amount) $('fAmount').value = r.amount.toFixed(2);
    $('fPayee').value = r.payee;
    $('fDate').value = r.date;
    $('fRef').value = r.ref;
    renderCats();
    const missing = [!r.amount && 'amount', !r.payee && 'name'].filter(Boolean);
    setScanBox(`<div class="scan">${img}<div><p class="t">${missing.length ? 'Some details could not be read' : 'Filled in from your screenshot'}</p>
      <p class="p">${missing.length ? 'Please add the ' + missing.join(' and ') + ' yourself.' : 'Check the details, then tap Save.'}</p>
      <details><summary>Text that was read</summary><pre>${esc(text.trim() || '(nothing)')}</pre></details></div></div>`);
  } catch (err) {
    console.error(err);
    setScanBox(`<div class="scan">${img}<div><p class="t">Couldn't read this screenshot</p><p class="p">You can still type the details in below.</p></div></div>`);
  }
}

/* ---------- backup ---------- */

async function shareOrDownload(filename, mime, content) {
  const file = new File([content], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function exportBackup() {
  const data = { app: 'personal-budget-tracker', version: VERSION, exportedAt: new Date().toISOString(), ...state };
  shareOrDownload(`budget-backup-${today()}.json`, 'application/json', JSON.stringify(data, null, 2));
}

function exportCsv() {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Type', 'Amount', 'Category', 'Name', 'Note', 'Reference']];
  for (const t of [...state.tx].sort(byNewest)) {
    rows.push([t.date, t.type, t.amount.toFixed(2), CAT_INFO[t.category]?.name || (t.type === 'transfer' ? 'Transfer' : 'Uncategorized'), t.payee, t.note, t.ref]);
  }
  shareOrDownload(`budget-${today()}.csv`, 'text/csv', '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n'));
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'personal-budget-tracker' || !Array.isArray(data.tx)) throw new Error('Not a backup file');
    if (!confirm(`Replace everything on this device with the backup (${data.tx.length} transactions)?`)) return;
    applyState(data);
    save();
    render();
    toast('Backup restored');
  } catch {
    toast("That file isn't a valid backup");
  }
}

/* ---------- wiring ---------- */

function shiftMonth(step) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + step, 1);
  month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  renderHome();
}

function wire() {
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) { showTab(go.dataset.goto); if (go.dataset.goto === 'settings') $('budgetInput').focus(); return; }
    const row = e.target.closest('.tx');
    if (row) { const tx = state.tx.find((t) => t.id === row.dataset.id); if (tx) openSheet(tx); }
  });
  $('prevMonth').addEventListener('click', () => shiftMonth(-1));
  $('nextMonth').addEventListener('click', () => shiftMonth(1));
  $('fab').addEventListener('click', () => openSheet());
  $('homeAdd').addEventListener('click', () => openSheet());
  $('homeScan').addEventListener('click', () => $('scanInput').click());
  $('sheetScan').addEventListener('click', () => $('scanInput').click());
  $('scanInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; scan(f); });

  $('cancelBtn').addEventListener('click', closeSheet);
  $('backdrop').addEventListener('click', closeSheet);
  $('saveBtn').addEventListener('click', saveForm);
  $('deleteBtn').addEventListener('click', () => {
    if (!confirm('Delete this transaction?')) return;
    state.tx = state.tx.filter((t) => t.id !== form.id);
    save(); closeSheet(); render(); toast('Deleted');
  });
  $('typeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.type === form.type) return;
    form.type = b.dataset.type; form.category = ''; form.catPicked = false;
    autoCategorise(); renderCats();
  });
  $('catChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    form.category = form.category === b.dataset.cat ? '' : b.dataset.cat;
    form.catPicked = true;
    renderCats();
  });
  $('fPayee').addEventListener('input', autoCategorise);
  $('fNote').addEventListener('input', autoCategorise);

  $('search').addEventListener('input', renderList);
  $('filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    filter = b.dataset.filter;
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('on', c === b));
    renderList();
  });

  $('budgetInput').addEventListener('change', (e) => {
    state.settings.budget = parseAmount(e.target.value);
    save(); render(); toast(state.settings.budget ? 'Budget saved' : 'Budget cleared');
  });
  $('myNames').addEventListener('change', (e) => {
    state.settings.myNames = e.target.value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    save(); toast('Saved');
  });
  $('exportBtn').addEventListener('click', exportBackup);
  $('csvBtn').addEventListener('click', exportCsv);
  $('importBtn').addEventListener('click', () => $('importInput').click());
  $('importInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; importBackup(f); });
  $('wipeBtn').addEventListener('click', () => {
    if (!confirm('Erase every transaction and setting on this device? This cannot be undone.')) return;
    applyState({}); save(); render(); toast('All data erased');
  });
}

async function start() {
  await store.open();
  applyState(await store.get('state'));
  wire();
  render();
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Small hook used for testing the receipt reader from the console.
window.pbt = { parseReceipt, scan, state };

start();
