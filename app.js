import { initStore, DEMO } from './core/store.js';

const VERSION = '1.1.2';

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toISO(new Date());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (iso) => (iso ? parse(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '');
const daysUntil = (iso) => Math.round((parse(iso) - parse(today())) / 86400000);
const ym = (iso) => iso.slice(0, 7);
const nextMonth = (m) => { let [y, mo] = m.split('-').map(Number); mo++; if (mo > 12) { mo = 1; y++; } return `${y}-${pad(mo)}`; };
const prevMonth = (m) => { let [y, mo] = m.split('-').map(Number); mo--; if (mo < 1) { mo = 12; y--; } return `${y}-${pad(mo)}`; };
const monthDate = (m, day) => { const [y, mo] = m.split('-').map(Number); return `${m}-${pad(Math.min(Number(day) || 1, new Date(y, mo, 0).getDate()))}`; };
const monthName = (m) => parse(m + '-01').toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
const money = (n) => '₪' + (Number(n) || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 });
const parseAmount = (v) => parseFloat(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
const sum = (arr) => arr.reduce((a, e) => a + (Number(e.amount) || 0), 0);
const byName = (email) => (email && email !== 'demo' ? email.split('@')[0] : '');

function addInterval(iso, every, unit) {
  const d = parse(iso);
  every = Number(every) || 1;
  if (unit === 'weeks') d.setDate(d.getDate() + every * 7);
  else if (unit === 'days') d.setDate(d.getDate() + every);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + every);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return toISO(d);
}

function relDays(n) {
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === -1) return 'באיחור של יום';
  if (n < 0) return `באיחור של ${-n} ימים`;
  if (n < 45) return `בעוד ${n} ימים`;
  const m = Math.round(n / 30.4);
  return m >= 12 && m % 12 === 0 ? (m === 12 ? 'בעוד שנה' : `בעוד ${m / 12} שנים`) : `בעוד כ-${m} חודשים`;
}

const UNITS = { months: ['חודש', 'חודשים'], weeks: ['שבוע', 'שבועות'], days: ['יום', 'ימים'] };
function everyText(t) {
  const u = UNITS[t.unit] || UNITS.months;
  if (t.unit === 'months' && t.every == 12) return 'פעם בשנה';
  return t.every == 1 ? `כל ${u[0]}` : `כל ${t.every} ${u[1]}`;
}

function ageText(birth) {
  if (!birth) return '';
  const b = parse(birth), n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--;
  if (m < 0) return '';
  const y = Math.floor(m / 12), mm = m % 12;
  const ys = y === 1 ? 'שנה' : y === 2 ? 'שנתיים' : `${y} שנים`;
  const ms = mm === 1 ? 'חודש' : `${mm} חודשים`;
  if (y === 0) return `בן ${ms}`;
  return mm ? `בן ${ys} ו${ms}` : `בן ${ys}`;
}

// ---------- constants ----------
const TYPES = ['חיסון', 'תילוע', 'טיפול', 'בדיקה', 'אחר'];
const TYPE_ICON = { 'חיסון': '💉', 'תילוע': '🪱', 'טיפול': '💊', 'בדיקה': '🩺', 'אחר': '📌' };
const PRESETS = [
  { name: 'תולעת הפארק', type: 'טיפול', every: 4, unit: 'months' },
  { name: 'פרעושים וקרציות', type: 'טיפול', every: 1, unit: 'months' },
  { name: 'כלבת', type: 'חיסון', every: 12, unit: 'months' },
  { name: 'משושה', type: 'חיסון', every: 12, unit: 'months' },
  { name: 'תילוע', type: 'תילוע', every: 3, unit: 'months' },
  { name: 'בדיקה שנתית', type: 'בדיקה', every: 12, unit: 'months' },
];
const CATS = [
  ['food', 'אוכל', '🍖'], ['treats', 'חטיפים', '🦴'], ['toys', 'צעצועים', '🎾'],
  ['gear', 'ציוד', '🦮'], ['care', 'טיפוח', '🛁'], ['places', 'מקומות', '📍'], ['other', 'אחר', '📦'],
];
const catOf = (k) => CATS.find((c) => c[0] === k) || CATS[CATS.length - 1];
const EXP_CATS = [
  ['vet', 'וטרינר', '🩺'], ['insurance', 'ביטוח', '🛡️'], ['food', 'אוכל', '🍖'], ['meds', 'תרופות וטיפולים', '💊'],
  ['toys', 'ציוד וצעצועים', '🎾'], ['care', 'טיפוח', '🛁'], ['boarding', 'פנסיון ושמרטף', '🏠'], ['other', 'אחר', '📦'],
];
const expCatOf = (k) => EXP_CATS.find((c) => c[0] === k) || EXP_CATS[EXP_CATS.length - 1];
const VERDICTS = { love: ['😍', 'אהב'], ok: ['😐', 'ככה ככה'], no: ['👎', 'לא אהב'] };

// ---------- state ----------
const S = {
  user: null, profile: {}, treatments: [], history: [], items: [], weights: [],
  expenses: [], recurring: [], foodBags: [], ready: {},
  tab: 'home', careSeg: 'plan', itemFilter: 'all', onlyLove: false, expMonth: ym(today()),
};
let store;
let unsubs = [];
let pendingPhoto = null;

const find = (col, id) => S[col].find((x) => x.id === id);
const dogName = () => S.profile.name || 'קוקו';

// ---------- toast / errors ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function errMsg(e) {
  if (e?.code === 'permission-denied') return 'אין הרשאה – בדוק שהמייל מופיע בכללי ה-Firestore';
  return 'משהו השתבש: ' + (e?.message || e);
}
const write = (p) => Promise.resolve(p).catch((e) => toast(errMsg(e)));

// ---------- sorting ----------
function upcoming() {
  return [...S.treatments].sort((a, b) => {
    if (!a.nextDue && !b.nextDue) return a.name.localeCompare(b.name);
    if (!a.nextDue) return 1;
    if (!b.nextDue) return -1;
    return a.nextDue.localeCompare(b.nextDue);
  });
}
const sortedWeights = () => [...S.weights].sort((a, b) => a.date.localeCompare(b.date));

// ---------- views ----------
function render() {
  if (!S.user) return;
  const views = { home: viewHome, care: viewCare, items: viewItems, money: viewExpenses, weight: viewWeight };
  $('#view').innerHTML =
    (DEMO ? `<div class="demo">מצב הדגמה – הנתונים נשמרים רק בדפדפן הזה. אחרי מילוי firebase-config.js הכל יעבור לענן.</div>` : '') +
    views[S.tab]() + footer();
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === S.tab));
  const overdue = S.treatments.filter((t) => t.nextDue && daysUntil(t.nextDue) < 0).length;
  const badge = $('.nav [data-tab="care"] .badge');
  badge.textContent = overdue || '';
  badge.hidden = !overdue;
}

function footer() {
  return `<footer class="foot">גרסה ${VERSION}${S.user && !DEMO ? ` · ${esc(S.user.email)}` : ''}
    · <button class="link" data-act="logout">${DEMO ? 'איפוס הדגמה' : 'יציאה'}</button></footer>`;
}

function emptyState(text, act, label) {
  return `<div class="empty"><p>${text}</p>${act ? `<button class="btn primary" data-act="${act}">${label}</button>` : ''}</div>`;
}

function treatmentCard(t) {
  let status = 'none', when = 'לא נקבע מועד';
  if (t.nextDue) {
    const n = daysUntil(t.nextDue);
    status = n < 0 ? 'over' : n <= 14 ? 'soon' : 'ok';
    when = `<b>${relDays(n)}</b> · ${fmt(t.nextDue)}`;
  }
  return `<article class="card tcard ${status}">
    <div class="ticon">${TYPE_ICON[t.type] || '📌'}</div>
    <div class="tinfo">
      <div class="tname">${esc(t.name)}</div>
      <div class="tmeta">${when}</div>
      <div class="tsub">${t.recurring ? everyText(t) : 'חד פעמי'}${t.lastDone ? ` · בוצע לאחרונה ${fmt(t.lastDone)}` : ''}</div>
    </div>
    <div class="tactions">
      <button class="btn small primary" data-act="done" data-id="${t.id}">✓ בוצע</button>
      <button class="icon-btn" data-act="edit-treatment" data-id="${t.id}" aria-label="עריכה">⋯</button>
    </div>
  </article>`;
}

function viewHome() {
  const p = S.profile;
  const ws = sortedWeights();
  const lastW = ws[ws.length - 1];
  const up = upcoming();
  const loved = S.items.filter((i) => i.verdict === 'love')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6);
  const sub = [p.breed, ageText(p.birthDate)].filter(Boolean).map(esc).join(' · ');

  return `
  <section class="hero">
    <button class="avatar" data-act="edit-profile" aria-label="עריכת פרופיל">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : '<span>🐶</span>'}</button>
    <div class="hero-text">
      <h1>${esc(dogName())}</h1>
      ${sub ? `<p>${sub}</p>` : ''}
      ${lastW ? `<p class="muted">${lastW.kg} ק״ג</p>` : ''}
    </div>
    <button class="icon-btn" data-act="edit-profile" aria-label="עריכת פרופיל">✎</button>
  </section>

  ${foodCard()}

  <div class="sec-head"><h2>הבא בתור</h2>${up.length > 3 ? `<button class="link" data-act="go" data-to="care">הכל (${up.length})</button>` : ''}</div>
  ${up.length ? up.slice(0, 3).map(treatmentCard).join('') : emptyState('עוד לא הוספתם טיפולים וחיסונים', 'add-treatment', '+ הוספת טיפול')}

  ${p.vetName || p.vetPhone ? `
  <a class="card vet" ${p.vetPhone ? `href="tel:${esc(p.vetPhone.replace(/[^\d+]/g, ''))}"` : ''}>
    <span class="vet-icon">🩺</span>
    <span class="vet-text"><b>${esc(p.vetName || 'וטרינר')}</b>${p.vetPhone ? `<span class="muted">${esc(p.vetPhone)}</span>` : ''}</span>
    ${p.vetPhone ? '<span class="vet-call">📞</span>' : ''}
  </a>` : ''}

  ${p.notes ? `<div class="card note-card"><b>חשוב לזכור</b><p>${esc(p.notes)}</p></div>` : ''}

  <button class="card sitter-btn" data-act="sitter">
    <span class="vet-icon">🧾</span>
    <span class="vet-text"><b>כרטיס לשמרטף</b><span class="muted small">${p.sitterToken ? 'יש קישור פעיל לשיתוף' : `כל מה שמי ששומר על ${esc(dogName())} צריך לדעת`}</span></span>
    <span class="chev">‹</span>
  </button>

  <div class="sec-head"><h2>${esc(dogName())} אהב</h2><button class="link" data-act="go" data-to="items">לכל המוצרים</button></div>
  ${loved.length ? `<div class="hscroll">${loved.map(itemCard).join('')}</div>` : emptyState('קניתם משהו שהוא אהב? צלמו ושמרו', 'add-item', '+ הוספת מוצר')}
  `;
}

function viewCare() {
  const seg = S.careSeg;
  let body;
  if (seg === 'plan') {
    const up = upcoming();
    body = up.length ? up.map(treatmentCard).join('') : emptyState('אין טיפולים מתוכננים', 'add-treatment', '+ הוספת טיפול');
  } else {
    const hs = [...S.history].sort((a, b) => b.date.localeCompare(a.date));
    if (!hs.length) body = emptyState('עוד אין היסטוריה. אפשר להוסיף טיפולים שבוצעו בעבר', 'add-history', '+ רישום טיפול שבוצע');
    else {
      let year = null;
      body = `<button class="btn ghost block" data-act="add-history">+ רישום טיפול שבוצע בעבר</button><ul class="hist">`;
      for (const h of hs) {
        const y = h.date.slice(0, 4);
        if (y !== year) { year = y; body += `<li class="year">${y}</li>`; }
        body += `<li class="hrow">
          <span class="hicon">${TYPE_ICON[h.type] || '📌'}</span>
          <div class="hinfo"><b>${esc(h.name)}</b>
            <div class="muted">${fmt(h.date)}${h.where ? ` · ${esc(h.where)}` : ''}${byName(h.by) ? ` · ${esc(byName(h.by))}` : ''}</div>
            ${h.notes ? `<div class="hnote">${esc(h.notes)}</div>` : ''}
          </div>
          <button class="icon-btn" data-act="del-history" data-id="${h.id}" aria-label="מחיקה">🗑</button>
        </li>`;
      }
      body += '</ul>';
    }
  }
  return `
  <header class="vhead"><h1>טיפולים וחיסונים</h1>
    <button class="btn primary small" data-act="${seg === 'plan' ? 'add-treatment' : 'add-history'}">+ הוספה</button></header>
  <div class="seg">
    <button class="${seg === 'plan' ? 'on' : ''}" data-act="care-seg" data-seg="plan">מתוכנן</button>
    <button class="${seg === 'hist' ? 'on' : ''}" data-act="care-seg" data-seg="hist">היסטוריה</button>
  </div>
  ${body}`;
}

function itemCard(i) {
  const c = catOf(i.cat);
  const v = VERDICTS[i.verdict] || VERDICTS.ok;
  return `<button class="icard" data-act="view-item" data-id="${i.id}">
    <div class="ithumb">${i.photo ? `<img src="${esc(i.photo)}" alt="" loading="lazy">` : `<span>${c[2]}</span>`}<span class="vbadge">${v[0]}</span></div>
    <div class="iname">${esc(i.name)}</div>
    <div class="muted small">${c[1]}</div>
  </button>`;
}

function viewItems() {
  const f = S.itemFilter;
  let list = S.items.filter((i) => (f === 'all' || i.cat === f) && (!S.onlyLove || i.verdict === 'love'));
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const used = new Set(S.items.map((i) => i.cat));
  const chips = [['all', 'הכל', ''], ...CATS.filter((c) => used.has(c[0]))];
  return `
  <header class="vhead"><h1>מוצרים והמלצות</h1><button class="btn primary small" data-act="add-item">+ הוספה</button></header>
  <div class="chips scroll">
    ${chips.map((c) => `<button class="chip ${f === c[0] ? 'on' : ''}" data-act="filter" data-f="${c[0]}">${c[2]} ${c[1]}</button>`).join('')}
    <button class="chip ${S.onlyLove ? 'on' : ''}" data-act="only-love">😍 רק מה שאהב</button>
  </div>
  ${list.length ? `<div class="grid">${list.map(itemCard).join('')}</div>`
    : emptyState(S.items.length ? 'אין מוצרים בסינון הזה' : 'צלמו אוכל, חטיפים וצעצועים שקניתם, וסמנו אם הוא אהב', 'add-item', '+ הוספת מוצר')}`;
}

function weightChart(ws) {
  if (ws.length < 2) return '';
  const W = 340, H = 150, P = 24;
  const kgs = ws.map((w) => Number(w.kg));
  const min = Math.min(...kgs) - 0.5, max = Math.max(...kgs) + 0.5;
  const t0 = parse(ws[0].date).getTime(), t1 = parse(ws[ws.length - 1].date).getTime() || t0 + 1;
  const x = (d) => W - P - ((parse(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * P); // RTL: time flows right → left
  const y = (k) => H - P - ((k - min) / (max - min)) * (H - 2 * P);
  const pts = ws.map((w) => `${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  return `<div class="card chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="גרף משקל">
    <line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" class="axis"/>
    <polyline points="${pts}" class="line"/>
    ${ws.map((w) => `<circle cx="${x(w.date).toFixed(1)}" cy="${y(w.kg).toFixed(1)}" r="3.5" class="dot"/>`).join('')}
    <text x="${W - P}" y="${H - 6}" class="lbl" direction="ltr" text-anchor="end">${fmt(ws[0].date)}</text>
    <text x="${P}" y="${H - 6}" class="lbl" direction="ltr" text-anchor="start">${fmt(ws[ws.length - 1].date)}</text>
  </svg></div>`;
}

function viewWeight() {
  const ws = sortedWeights();
  const rev = [...ws].reverse();
  return `
  <header class="vhead"><h1>משקל</h1><button class="btn primary small" data-act="add-weight">+ שקילה</button></header>
  ${ws.length ? `<div class="big-num">${ws[ws.length - 1].kg} <small>ק״ג</small></div>` : ''}
  ${weightChart(ws)}
  ${rev.length ? `<ul class="wlist">${rev.map((w, i) => {
    const prev = rev[i + 1];
    const diff = prev ? (w.kg - prev.kg) : 0;
    return `<li><span>${fmt(w.date)}</span><b>${w.kg} ק״ג</b>
      <span dir="ltr" class="diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${prev && diff ? (diff > 0 ? '+' : '') + diff.toFixed(1) : ''}</span>
      <button class="icon-btn" data-act="del-weight" data-id="${w.id}" aria-label="מחיקה">🗑</button></li>`;
  }).join('')}</ul>` : emptyState('עוד לא נרשמה שקילה', 'add-weight', '+ שקילה ראשונה')}`;
}

// ---------- sheets (bottom dialogs) ----------
const dlg = () => $('#sheet');
function openSheet(title, body, onSubmit) {
  const d = dlg();
  d.innerHTML = `<form class="sheet-form" novalidate>
    <header class="sheet-head"><h3>${title}</h3><button type="button" class="icon-btn" data-act="close" aria-label="סגירה">✕</button></header>
    <div class="sheet-body">${body}</div></form>`;
  const form = d.querySelector('form');
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (onSubmit && onSubmit(Object.fromEntries(new FormData(form)), form) === false) return;
    closeSheet();
  };
  if (!d.open) d.showModal();
  d.querySelector('.sheet-body').scrollTop = 0;
  return form;
}
function closeSheet() { const d = dlg(); if (d.open) d.close(); pendingPhoto = null; }

const typeOptions = (sel) => TYPES.map((x) => `<option ${x === sel ? 'selected' : ''}>${x}</option>`).join('');
const unitOptions = (sel) => Object.entries(UNITS).map(([k, v]) => `<option value="${k}" ${k === (sel || 'months') ? 'selected' : ''}>${v[1]}</option>`).join('');
const nameList = () => `<datalist id="tnames">${[...new Set([...S.treatments.map((t) => t.name), ...PRESETS.map((p) => p.name)])].map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`;

function sheetTreatment(t) {
  const isNew = !t;
  t = t || { type: 'טיפול', recurring: true, every: 4, unit: 'months' };
  const body = `
    ${isNew ? `<p class="hint">בחירה מהירה:</p><div class="chips wrap">${PRESETS.map((p, i) => `<button type="button" class="chip" data-act="preset" data-i="${i}">${esc(p.name)}</button>`).join('')}</div>` : ''}
    <label>שם<input name="name" required value="${esc(t.name)}" placeholder="למשל: תולעת הפארק" autocomplete="off"></label>
    <label>סוג<select name="type">${typeOptions(t.type)}</select></label>
    <label class="check"><input type="checkbox" name="recurring" ${t.recurring ? 'checked' : ''}> טיפול חוזר</label>
    <div class="row rec"><span>כל</span><input name="every" type="number" min="1" inputmode="numeric" value="${t.every || 1}"><select name="unit">${unitOptions(t.unit)}</select></div>
    ${isNew ? `<label>מתי בוצע לאחרונה? <small>(לא חובה)</small><input type="date" name="lastDone" max="${today()}"></label>` : ''}
    <label>מועד הבא<input type="date" name="nextDue" value="${t.nextDue || ''}"></label>
    <p class="hint calc" id="calc"></p>
    <label>הערות<textarea name="notes" rows="2" placeholder="שם התכשיר, מינון שהווטרינר קבע...">${esc(t.notes)}</textarea></label>
    <button class="btn primary block">${isNew ? 'הוספה' : 'שמירה'}</button>
    ${!isNew ? `<div class="row gap">
      ${t.nextDue ? `<button type="button" class="btn ghost" data-act="ics" data-id="${t.id}">📅 הוספה ליומן</button>` : ''}
      <button type="button" class="btn ghost danger" data-act="del-treatment" data-id="${t.id}">מחיקה</button></div>` : ''}`;

  const f = openSheet(isNew ? 'טיפול או חיסון חדש' : 'עריכת טיפול', body, (d) => {
    const data = {
      name: d.name.trim(), type: d.type, recurring: !!d.recurring,
      every: Math.max(1, parseInt(d.every, 10) || 1), unit: d.unit,
      nextDue: d.nextDue || null, notes: (d.notes || '').trim(),
    };
    if (isNew) {
      if (d.lastDone) data.lastDone = d.lastDone;
      write(store.add('treatments', data));
      if (d.lastDone) write(store.add('history', { name: data.name, type: data.type, date: d.lastDone, where: '', notes: '' }));
      toast('נוסף ✓');
    } else {
      write(store.update('treatments', t.id, data));
      toast('נשמר ✓');
    }
  });

  const calc = f.querySelector('#calc');
  const sync = (e) => {
    f.querySelector('.rec').hidden = !f.recurring.checked;
    const base = isNew ? f.lastDone.value : t.lastDone;
    const touched = !e || ['every', 'unit', 'recurring', 'lastDone'].includes(e.target.name);
    if (base && f.recurring.checked && touched && (isNew || e)) {
      const next = addInterval(base, f.every.value, f.unit.value);
      f.nextDue.value = next;
      calc.textContent = `המועד הבא חושב אוטומטית: ${fmt(next)}`;
    } else if (!base || !f.recurring.checked) calc.textContent = '';
  };
  f.addEventListener('input', sync);
  f.addEventListener('change', sync);
  sync();
}

function sheetDone(t) {
  const body = `
    <div class="done-head">${TYPE_ICON[t.type] || '📌'} <b>${esc(t.name)}</b></div>
    <label>תאריך ביצוע<input type="date" name="date" value="${today()}" max="${today()}" required></label>
    <label>איפה / אצל מי <small>(לא חובה)</small><input name="where" placeholder="למשל: ד״ר כהן"></label>
    <label>הערות <small>(לא חובה)</small><textarea name="notes" rows="2"></textarea></label>
    <label>עלות ₪ <small>(לא חובה – תירשם בהוצאות)</small><input name="cost" inputmode="decimal" autocomplete="off"></label>
    ${t.recurring ? '<p class="hint calc" id="calc"></p>' : '<p class="hint">טיפול חד פעמי – אחרי הסימון הוא יעבור להיסטוריה.</p>'}
    <button class="btn primary block">✓ סימון כבוצע</button>`;
  const f = openSheet('סימון כבוצע', body, (d) => {
    write(store.add('history', { treatmentId: t.id, name: t.name, type: t.type, date: d.date, where: d.where.trim(), notes: d.notes.trim() }));
    const cost = parseAmount(d.cost);
    if (cost > 0) write(store.add('expenses', { date: d.date, amount: cost, cat: ['חיסון', 'בדיקה'].includes(t.type) ? 'vet' : 'meds', note: t.name }));
    if (t.recurring) {
      const next = addInterval(d.date, t.every, t.unit);
      write(store.update('treatments', t.id, { lastDone: d.date, nextDue: next }));
      toast(`✓ הפעם הבאה נקבעה ל-${fmt(next)}`);
    } else {
      write(store.remove('treatments', t.id));
      toast('סומן כבוצע ✓');
    }
  });
  if (t.recurring) {
    const sync = () => {
      const v = f.date.value;
      f.querySelector('#calc').textContent = v ? `הפעם הבאה תיקבע אוטומטית ל-${fmt(addInterval(v, t.every, t.unit))} (${everyText(t)})` : '';
    };
    f.addEventListener('input', sync);
    sync();
  }
}

function sheetHistory() {
  const body = `
    <label>מה בוצע<input name="name" list="tnames" required autocomplete="off" placeholder="למשל: כלבת"></label>${nameList()}
    <label>סוג<select name="type">${typeOptions('חיסון')}</select></label>
    <label>תאריך<input type="date" name="date" max="${today()}" required></label>
    <label>איפה / אצל מי <small>(לא חובה)</small><input name="where"></label>
    <label>הערות <small>(לא חובה)</small><textarea name="notes" rows="2"></textarea></label>
    <p class="hint">רוצים שזה גם יחזור אוטומטית? הוסיפו אותו בלשונית "מתוכנן" עם תאריך הביצוע האחרון.</p>
    <button class="btn primary block">שמירה</button>`;
  openSheet('רישום טיפול שבוצע', body, (d) => {
    write(store.add('history', { name: d.name.trim(), type: d.type, date: d.date, where: d.where.trim(), notes: d.notes.trim() }));
    toast('נשמר ✓');
  });
}

function photoPicker(current, label) {
  return `<button type="button" class="photo-pick" data-act="pick-photo">${current ? `<img src="${esc(current)}" alt="">` : `<span>📷<br>${label}</span>`}</button>
    <input type="file" accept="image/*" id="photoInput" hidden>`;
}
function bindPhoto(form, maxSide, shape = 'square') {
  const input = form.querySelector('#photoInput');
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    input.value = '';
    if (!file) return;
    const pick = form.querySelector('.photo-pick');
    try {
      const out = await cropImage(file, { shape, size: maxSide });
      if (!out) return;
      pendingPhoto = out;
      pick.innerHTML = `<img src="${pendingPhoto}" alt="">`;
      pick.classList.toggle('square', shape !== 'wide');
    } catch { toast('לא הצלחתי לקרוא את התמונה'); }
  });
}

// ---------- photo cropper: drag to move, pinch / slider to zoom ----------
function cropImage(file, { shape = 'square', size = 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.onload = () => {
      const d = document.createElement('dialog');
      d.className = 'cropper';
      d.innerHTML = `
        <div class="crop-head">${shape === 'circle' ? 'מזיזים ומגדילים עד שהפנים במרכז' : 'בוחרים איזה חלק בתמונה יישמר'}</div>
        <div class="crop-stage ${shape}" dir="ltr"><img alt=""><div class="crop-mask"></div></div>
        <div class="crop-zoom"><span>−</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="זום"><span>+</span></div>
        <p class="crop-hint">גוררים כדי להזיז · צובטים או מזיזים את הסרגל כדי להגדיל</p>
        <div class="crop-actions">
          <button type="button" class="btn ghost" data-crop="cancel">ביטול</button>
          <button type="button" class="btn primary" data-crop="ok">שימוש בתמונה</button>
        </div>`;
      document.body.appendChild(d);
      const stage = d.querySelector('.crop-stage'), im = stage.querySelector('img'), range = d.querySelector('input');
      im.src = url;
      d.showModal();

      const F = stage.clientWidth;
      const W = img.naturalWidth, H = img.naturalHeight;
      const minS = Math.max(F / W, F / H);
      let s = minS, tx = (F - W * s) / 2, ty = (F - H * s) / 2;
      const clamp = () => {
        tx = Math.min(0, Math.max(F - W * s, tx));
        ty = Math.min(0, Math.max(F - H * s, ty));
      };
      const draw = () => { clamp(); im.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`; range.value = (s / minS).toFixed(2); };
      const zoomTo = (ns, px = F / 2, py = F / 2) => {
        ns = Math.min(minS * 4, Math.max(minS, ns));
        tx = px - (px - tx) * (ns / s); ty = py - (py - ty) * (ns / s); s = ns; draw();
      };
      draw();

      const pts = new Map();
      let last = null;
      const rel = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const snapshot = () => {
        const a = [...pts.values()];
        if (a.length === 1) return { x: a[0][0], y: a[0][1] };
        const [p1, p2] = a;
        return { x: (p1[0] + p2[0]) / 2, y: (p1[1] + p2[1]) / 2, dist: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) };
      };
      stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e)); last = snapshot(); });
      stage.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, rel(e));
        const now = snapshot();
        if (last && now.dist && last.dist) {
          tx += now.x - last.x; ty += now.y - last.y;
          zoomTo(s * (now.dist / last.dist), now.x, now.y);
        } else if (last && !now.dist && !last.dist) {
          tx += now.x - last.x; ty += now.y - last.y; draw();
        }
        last = now;
      });
      const up = (e) => { pts.delete(e.pointerId); last = pts.size ? snapshot() : null; };
      stage.addEventListener('pointerup', up);
      stage.addEventListener('pointercancel', up);
      stage.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = rel(e); zoomTo(s * (e.deltaY < 0 ? 1.1 : 0.9), x, y); }, { passive: false });
      range.addEventListener('input', () => zoomTo(minS * Number(range.value)));

      const finish = (result) => { d.close(); d.remove(); URL.revokeObjectURL(url); resolve(result); };
      d.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
      d.querySelector('[data-crop="cancel"]').onclick = () => finish(null);
      d.querySelector('[data-crop="ok"]').onclick = () => {
        const srcSize = F / s;
        const outSize = Math.round(Math.min(size, srcSize));
        const c = document.createElement('canvas');
        c.width = c.height = outSize;
        c.getContext('2d').drawImage(img, -tx / s, -ty / s, srcSize, srcSize, 0, 0, outSize, outSize);
        let q = 0.82, out = c.toDataURL('image/jpeg', q);
        while (out.length > 600000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        finish(out);
      };
    };
    img.src = url;
  });
}

function sheetItem(it) {
  const isNew = !it;
  it = it || { cat: S.itemFilter !== 'all' ? S.itemFilter : 'food', verdict: 'love' };
  const body = `
    ${photoPicker(it.photo, 'צילום / תמונה')}
    <label>מה זה?<input name="name" required value="${esc(it.name)}" placeholder="למשל: אוכל יבש בטעם סלמון" autocomplete="off"></label>
    <label>קטגוריה<select name="cat">${CATS.map((c) => `<option value="${c[0]}" ${c[0] === it.cat ? 'selected' : ''}>${c[2]} ${c[1]}</option>`).join('')}</select></label>
    <div class="verdict">${Object.entries(VERDICTS).map(([k, [e, l]]) =>
      `<label><input type="radio" name="verdict" value="${k}" ${k === it.verdict ? 'checked' : ''}><span>${e}<small>${l}</small></span></label>`).join('')}</div>
    <div class="row two">
      <label>איפה קנינו<input name="where" value="${esc(it.where)}"></label>
      <label>מחיר<input name="price" value="${esc(it.price)}" inputmode="decimal"></label>
    </div>
    <label>הערות<textarea name="notes" rows="2" placeholder="טעם, גודל אריזה, למה כן / לא...">${esc(it.notes)}</textarea></label>
    <button class="btn primary block">${isNew ? 'הוספה' : 'שמירה'}</button>
    ${!isNew ? `<button type="button" class="btn ghost danger block" data-act="del-item" data-id="${it.id}">מחיקה</button>` : ''}`;
  const f = openSheet(isNew ? 'מוצר חדש' : 'עריכת מוצר', body, (d) => {
    const data = { name: d.name.trim(), cat: d.cat, verdict: d.verdict || 'ok', where: d.where.trim(), price: d.price.trim(), notes: d.notes.trim() };
    if (pendingPhoto) data.photo = pendingPhoto;
    write(isNew ? store.add('items', data) : store.update('items', it.id, data));
    toast(isNew ? 'נוסף ✓' : 'נשמר ✓');
  });
  pendingPhoto = it.photo || null;
  bindPhoto(f, 1000);
}

function sheetItemView(it) {
  const c = catOf(it.cat), v = VERDICTS[it.verdict] || VERDICTS.ok;
  const added = it.createdAt ? fmt(toISO(new Date(it.createdAt))) : '';
  const body = `
    ${it.photo ? `<img class="big-photo" src="${esc(it.photo)}" alt="">` : `<div class="big-photo ph">${c[2]}</div>`}
    <div class="view-head"><h2>${esc(it.name)}</h2><span class="pill">${v[0]} ${v[1]}</span></div>
    <dl class="facts">
      <dt>קטגוריה</dt><dd>${c[2]} ${c[1]}</dd>
      ${it.where ? `<dt>איפה קנינו</dt><dd>${esc(it.where)}</dd>` : ''}
      ${it.price ? `<dt>מחיר</dt><dd>${esc(it.price)}</dd>` : ''}
      ${added ? `<dt>נוסף</dt><dd>${added}${byName(it.by) ? ` · ${esc(byName(it.by))}` : ''}</dd>` : ''}
    </dl>
    ${it.notes ? `<p class="view-notes">${esc(it.notes)}</p>` : ''}
    <button type="button" class="btn primary block" data-act="edit-item" data-id="${it.id}">עריכה</button>`;
  openSheet(c[1], body);
}

function sheetWeight() {
  const last = sortedWeights().pop();
  const body = `
    <label>תאריך<input type="date" name="date" value="${today()}" max="${today()}" required></label>
    <label>משקל (ק״ג)<input name="kg" type="number" step="0.1" min="0.1" inputmode="decimal" required value="${last ? last.kg : ''}"></label>
    <button class="btn primary block">שמירה</button>`;
  openSheet('שקילה', body, (d) => {
    const kg = parseFloat(String(d.kg).replace(',', '.'));
    if (!kg) { toast('צריך להזין משקל'); return false; }
    write(store.add('weights', { date: d.date, kg: Math.round(kg * 10) / 10 }));
    toast('נשמר ✓');
  });
}

function sheetProfile() {
  const p = S.profile;
  const body = `
    ${photoPicker(p.photo, 'תמונה של ' + esc(dogName()))}
    <div class="row two">
      <label>שם<input name="name" value="${esc(p.name || 'קוקו')}" required></label>
      <label>גזע<input name="breed" value="${esc(p.breed)}"></label>
    </div>
    <div class="row two">
      <label>תאריך לידה<input type="date" name="birthDate" value="${esc(p.birthDate)}" max="${today()}"></label>
      <label>מספר שבב<input name="chip" value="${esc(p.chip)}" inputmode="numeric"></label>
    </div>
    <div class="row two">
      <label>וטרינר / מרפאה<input name="vetName" value="${esc(p.vetName)}"></label>
      <label>טלפון<input name="vetPhone" type="tel" value="${esc(p.vetPhone)}"></label>
    </div>
    <label>חשוב לזכור <small>(רגישויות, תרופות קבועות...)</small><textarea name="notes" rows="2">${esc(p.notes)}</textarea></label>
    <button class="btn primary block">שמירה</button>`;
  const f = openSheet('הפרופיל של ' + esc(dogName()), body, (d) => {
    const data = { name: d.name.trim(), breed: d.breed.trim(), birthDate: d.birthDate, chip: d.chip.trim(), vetName: d.vetName.trim(), vetPhone: d.vetPhone.trim(), notes: d.notes.trim() };
    if (pendingPhoto) data.photo = pendingPhoto;
    write(store.saveProfile(data));
    syncPublic(data);
    toast('נשמר ✓');
  });
  pendingPhoto = p.photo || null;
  bindPhoto(f, 600, 'circle');
}

// ---------- calendar (.ics) ----------
function downloadIcs(t) {
  if (!t.nextDue) return;
  const d = t.nextDue.replace(/-/g, '');
  const end = addInterval(t.nextDue, 1, 'days').replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const title = `${dogName()} – ${t.name}`.replace(/[,;]/g, ' ');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Koko//HE', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${t.id}-${d}@koko-app`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${title}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${t.name}.ics` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- image compression (photos are stored inside Firestore, no paid Storage needed) ----------
function compressImage(file, maxSide = 1000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let q = 0.78, out = c.toDataURL('image/jpeg', q);
      while (out.length > 600000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

// ---------- recurring expenses (auto-generated monthly, deterministic ids → no duplicates) ----------
function seedDefaults() {
  if (!S.ready.profile || !S.ready.recurring) return;
  const seeded = S.profile.seeded || {};
  if (seeded.marpet) return;
  if (!S.recurring.some((r) => r.id === 'marpet')) {
    write(store.set('recurring', 'marpet', {
      name: 'ביטוח MARPET', amount: 115, cat: 'insurance', day: 1, startDate: ym(today()) + '-01', active: true,
    }));
  }
  S.profile.seeded = { ...seeded, marpet: true };
  write(store.saveProfile({ seeded: { ...seeded, marpet: true } }));
}

function genRecurring() {
  const now = today();
  for (const r of S.recurring) {
    if (r.active === false || !r.startDate) continue;
    let m = r.lastGenerated ? nextMonth(r.lastGenerated) : ym(r.startDate);
    let last = null;
    for (let i = 0; i < 120; i++) {
      const date = monthDate(m, r.day);
      if (date > now) break;
      if (date >= r.startDate) {
        write(store.set('expenses', `r_${r.id}_${m}`, { date, amount: Number(r.amount) || 0, cat: r.cat, note: r.name, recurringId: r.id }));
      }
      last = m; m = nextMonth(m);
    }
    if (last) { r.lastGenerated = last; write(store.update('recurring', r.id, { lastGenerated: last })); }
  }
}

// ---------- expenses view ----------
function viewExpenses() {
  const m = S.expMonth;
  const list = S.expenses.filter((e) => e.date && e.date.startsWith(m)).sort((a, b) => b.date.localeCompare(a.date));
  const total = sum(list);
  const y = m.slice(0, 4);
  const yearList = S.expenses.filter((e) => e.date && e.date.startsWith(y));
  const yearTotal = sum(yearList);
  const firstMonth = yearList.length ? Math.min(...yearList.map((e) => Number(e.date.slice(5, 7)))) : 1;
  const lastMonth = y === today().slice(0, 4) ? Number(today().slice(5, 7)) : 12;
  const avg = yearTotal / Math.max(1, lastMonth - firstMonth + 1);
  const isCurrent = m >= ym(today());

  const byCat = {};
  for (const e of list) byCat[e.cat] = (byCat[e.cat] || 0) + (Number(e.amount) || 0);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;

  const rec = [...S.recurring].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return `
  <header class="vhead"><h1>הוצאות</h1><button class="btn primary small" data-act="add-expense">+ הוצאה</button></header>
  <div class="month-nav">
    <button class="icon-btn" data-act="exp-month" data-d="-1" aria-label="חודש קודם">›</button>
    <div class="mname">${monthName(m)}</div>
    <button class="icon-btn" data-act="exp-month" data-d="1" aria-label="חודש הבא" ${isCurrent ? 'disabled' : ''}>‹</button>
  </div>
  <div class="exp-total">${money(total)}</div>
  ${cats.length ? `<div class="card cats">${cats.map(([k, v]) => {
    const c = expCatOf(k);
    return `<div class="crow"><span class="cname">${c[2]} ${c[1]}</span><span class="cbar"><span style="width:${Math.max(4, Math.round((v / max) * 100))}%"></span></span><b>${money(v)}</b></div>`;
  }).join('')}</div>` : ''}
  <div class="card exp-year"><span>סה״כ ${y}: <b>${money(yearTotal)}</b></span><span class="muted">ממוצע לחודש ${money(Math.round(avg))}</span></div>

  <div class="sec-head"><h2>הוצאות קבועות</h2><button class="link" data-act="add-recurring">+ הוספה</button></div>
  ${rec.length ? rec.map((r) => {
    const c = expCatOf(r.cat);
    return `<button class="card erow" data-act="edit-recurring" data-id="${r.id}">
      <span class="eicon">${c[2]}</span>
      <span class="einfo"><b>${esc(r.name)}</b><span class="muted small">${r.active === false ? 'מושהה' : `כל חודש ב-${r.day || 1} לחודש`}</span></span>
      <span class="eamt">${money(r.amount)}<small> / חודש</small></span>
    </button>`;
  }).join('') : '<p class="muted small">אין הוצאות קבועות</p>'}

  <div class="sec-head"><h2>פירוט החודש</h2></div>
  ${list.length ? list.map((e) => {
    const c = expCatOf(e.cat);
    return `<button class="erow plain" data-act="edit-expense" data-id="${e.id}">
      <span class="eicon">${c[2]}</span>
      <span class="einfo"><b>${esc(e.note || c[1])}</b><span class="muted small">${fmt(e.date)}${e.recurringId ? ' · קבוע' : ''}${byName(e.by) ? ` · ${esc(byName(e.by))}` : ''}</span></span>
      <span class="eamt">${money(e.amount)}</span>
    </button>`;
  }).join('') : emptyState('אין הוצאות בחודש הזה', 'add-expense', '+ הוספת הוצאה')}`;
}

const expCatOptions = (sel) => EXP_CATS.map((c) => `<option value="${c[0]}" ${c[0] === sel ? 'selected' : ''}>${c[2]} ${c[1]}</option>`).join('');

function sheetExpense(e) {
  const isNew = !e;
  e = e || { date: today(), cat: 'vet' };
  const body = `
    <label>סכום ₪<input name="amount" inputmode="decimal" required value="${e.amount ?? ''}" autocomplete="off" placeholder="0"></label>
    <label>קטגוריה<select name="cat">${expCatOptions(e.cat)}</select></label>
    <label>על מה<input name="note" value="${esc(e.note)}" placeholder="למשל: ביקור אצל הווטרינר" autocomplete="off"></label>
    <label>תאריך<input type="date" name="date" value="${e.date}" required></label>
    ${e.recurringId ? '<p class="hint">זה חיוב של הוצאה קבועה. שינוי כאן משפיע רק על החודש הזה.</p>' : ''}
    <button class="btn primary block">${isNew ? 'הוספה' : 'שמירה'}</button>
    ${!isNew ? `<button type="button" class="btn ghost danger block" data-act="del-expense" data-id="${e.id}">מחיקה</button>` : ''}`;
  openSheet(isNew ? 'הוצאה חדשה' : 'עריכת הוצאה', body, (d) => {
    const amount = parseAmount(d.amount);
    if (!amount) { toast('צריך להזין סכום'); return false; }
    const data = { amount, cat: d.cat, note: d.note.trim(), date: d.date };
    write(isNew ? store.add('expenses', data) : store.update('expenses', e.id, data));
    if (isNew && ym(d.date) !== S.expMonth) S.expMonth = ym(d.date) <= ym(today()) ? ym(d.date) : S.expMonth;
    toast(isNew ? 'נוסף ✓' : 'נשמר ✓');
  });
}

function sheetRecurring(r) {
  const isNew = !r;
  r = r || { cat: 'insurance', day: 1, startDate: ym(today()) + '-01', active: true };
  const body = `
    <label>שם<input name="name" required value="${esc(r.name)}" placeholder="למשל: ביטוח" autocomplete="off"></label>
    <div class="row two">
      <label>סכום חודשי ₪<input name="amount" inputmode="decimal" required value="${r.amount ?? ''}"></label>
      <label>יום בחודש<input name="day" type="number" min="1" max="31" inputmode="numeric" value="${r.day || 1}"></label>
    </div>
    <label>קטגוריה<select name="cat">${expCatOptions(r.cat)}</select></label>
    <label>החל מתאריך<input type="date" name="startDate" value="${r.startDate}" required></label>
    <label class="check"><input type="checkbox" name="active" ${r.active !== false ? 'checked' : ''}> פעיל</label>
    <p class="hint">כל חודש החיוב נרשם לבד בהוצאות. שינוי סכום משפיע מהחיוב הבא והלאה. הקדמת "החל מתאריך" תשלים גם חודשים קודמים.</p>
    <button class="btn primary block">${isNew ? 'הוספה' : 'שמירה'}</button>
    ${!isNew ? `<button type="button" class="btn ghost danger block" data-act="del-recurring" data-id="${r.id}">מחיקה</button>` : ''}`;
  openSheet(isNew ? 'הוצאה קבועה חדשה' : 'עריכת הוצאה קבועה', body, (d) => {
    const amount = parseAmount(d.amount);
    if (!amount) { toast('צריך להזין סכום'); return false; }
    const data = {
      name: d.name.trim(), amount, cat: d.cat, active: !!d.active,
      day: Math.min(31, Math.max(1, parseInt(d.day, 10) || 1)), startDate: d.startDate,
    };
    if (isNew) write(store.add('recurring', data));
    else {
      if (d.startDate !== r.startDate) data.lastGenerated = d.startDate < r.startDate ? null : (r.lastGenerated || null);
      write(store.update('recurring', r.id, data));
    }
    toast(isNew ? 'נוסף ✓' : 'נשמר ✓');
  });
}

// ---------- food run-out ----------
const sortedBags = () => [...S.foodBags].sort((a, b) => a.date.localeCompare(b.date));
function foodStatus() {
  const bags = sortedBags();
  if (!bags.length) return null;
  const last = bags[bags.length - 1];
  const gaps = [];
  for (let i = Math.max(1, bags.length - 3); i < bags.length; i++) {
    const g = Math.round((parse(bags[i].date) - parse(bags[i - 1].date)) / 86400000);
    if (g >= 3) gaps.push(g);
  }
  const learned = gaps.length > 0;
  const est = learned ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : (Number(S.profile.food?.days) || 30);
  const runOut = addInterval(last.date, est, 'days');
  const left = daysUntil(runOut);
  const used = Math.min(1, Math.max(0, (est - left) / est));
  return { last, est, learned, runOut, left, used };
}

function foodCard() {
  const f = foodStatus();
  if (!f) {
    return `<div class="card food">
      <div class="food-top"><span class="ficon">🍖</span><div class="finfo"><b>מתי ייגמר האוכל?</b>
        <div class="muted small">מסמנים כשפותחים שק חדש, והאפליקציה תדע מתי צריך לקנות את הבא</div></div></div>
      <button class="btn primary small block" data-act="food-bag">פתחנו שק אוכל</button>
    </div>`;
  }
  const st = f.left <= 3 ? 'over' : f.left <= 7 ? 'soon' : 'ok';
  const msg = f.left < 0 ? `כנראה כבר נגמר (לפי ההערכה, לפני ${-f.left} ימים)`
    : f.left === 0 ? 'נגמר בערך היום – הזמן לקנות'
    : f.left <= 7 ? `נשארו בערך ${f.left} ימים – הזמן לקנות`
    : `נשארו בערך ${f.left} ימים`;
  return `<div class="card food ${st}">
    <div class="food-top"><span class="ficon">🍖</span>
      <div class="finfo"><b>${esc(f.last.name || 'אוכל')}</b><div class="fmsg">${msg}</div></div>
      <button class="icon-btn" data-act="food-settings" aria-label="הגדרות אוכל">⋯</button></div>
    <div class="bar"><span style="width:${Math.round(f.used * 100)}%"></span></div>
    <div class="food-foot"><span class="muted small">נפתח ${fmt(f.last.date)} · ${f.learned ? `לפי הקצב שלכם: שק לכ-${f.est} ימים` : `הערכה: שק לכ-${f.est} ימים`}</span>
      <button class="btn small ${st === 'ok' ? '' : 'primary'}" data-act="food-bag">שק חדש</button></div>
  </div>`;
}

function sheetFoodBag() {
  const bags = sortedBags(), last = bags[bags.length - 1], first = !bags.length;
  const names = [...new Set([...bags.map((b) => b.name), ...S.items.filter((i) => i.cat === 'food').map((i) => i.name)].filter(Boolean))];
  const body = `
    <label>מתי פתחתם<input type="date" name="date" value="${today()}" max="${today()}" required></label>
    <label>איזה אוכל<input name="name" list="foodnames" value="${esc(last?.name || '')}" placeholder="שם האוכל" autocomplete="off"></label>
    <datalist id="foodnames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <label>מחיר ₪ <small>(לא חובה – יירשם בהוצאות)</small><input name="price" inputmode="decimal" autocomplete="off"></label>
    ${first ? `<label>כמה זמן בערך שק מחזיק? <small>(ימים)</small><input name="days" type="number" min="3" inputmode="numeric" value="${S.profile.food?.days || 30}"></label>
      <p class="hint">מהשק השני והלאה האפליקציה תחשב לבד לפי הקצב האמיתי שלכם.</p>` : ''}
    <button class="btn primary block">שמירה</button>`;
  openSheet('פתחנו שק חדש', body, (d) => {
    const name = d.name.trim();
    write(store.add('foodBags', { date: d.date, name }));
    const price = parseAmount(d.price);
    if (price > 0) write(store.add('expenses', { date: d.date, amount: price, cat: 'food', note: name ? `שק אוכל – ${name}` : 'שק אוכל' }));
    if (first && d.days) write(store.saveProfile({ food: { ...(S.profile.food || {}), days: Math.max(3, parseInt(d.days, 10) || 30) } }));
    syncPublic({}, name);
    toast('נשמר ✓');
  });
}

function sheetFoodSettings() {
  const bags = sortedBags().reverse();
  const body = `
    <label>הערכה כשאין מספיק היסטוריה <small>(ימים לשק)</small><input name="days" type="number" min="3" inputmode="numeric" value="${S.profile.food?.days || 30}"></label>
    <p class="hint">אחרי שני שקים ומעלה החישוב נעשה לפי ממוצע הזמן בין השקים האחרונים.</p>
    <button class="btn primary block">שמירה</button>
    <h3 class="sub-title">שקים שנפתחו</h3>
    <ul class="hist">${bags.map((b) => `<li class="hrow"><span class="hicon">🍖</span>
      <div class="hinfo"><b>${esc(b.name || 'אוכל')}</b><div class="muted">${fmt(b.date)}</div></div>
      <button type="button" class="icon-btn" data-act="del-bag" data-id="${b.id}" aria-label="מחיקה">🗑</button></li>`).join('')}</ul>`;
  openSheet('אוכל', body, (d) => {
    write(store.saveProfile({ food: { ...(S.profile.food || {}), days: Math.max(3, parseInt(d.days, 10) || 30) } }));
    toast('נשמר ✓');
  });
}

// ---------- sitter card ----------
const SITTER_FIELDS = [
  ['feeding', '🍖', 'אוכל', 'כמה ומתי? למשל: כוס בבוקר וכוס בערב'],
  ['meds', '💊', 'תרופות וטיפולים', 'אם יש תרופה קבועה – מה, כמה ומתי'],
  ['walks', '🚶', 'טיולים ושגרה', 'כמה טיולים ביום, שעות, איפה הוא אוהב'],
  ['behavior', '🐾', 'התנהגות', 'מה מלחיץ אותו, עם אילו כלבים להיזהר, פקודות שהוא מכיר'],
  ['other', '📝', 'עוד דברים', 'איפה הרצועה, איפה הוא ישן, מה אסור לו...'],
];

function buildPublic(profileOverride = {}, foodName) {
  const p = { ...S.profile, ...profileOverride };
  const s = p.sitter || {};
  return {
    name: p.name || 'קוקו', photo: p.photo || '', breed: p.breed || '', birthDate: p.birthDate || '',
    chip: p.chip || '', vetName: p.vetName || '', vetPhone: p.vetPhone || '', notes: p.notes || '',
    foodName: foodName ?? (foodStatus()?.last.name || ''),
    feeding: s.feeding || '', meds: s.meds || '', walks: s.walks || '', behavior: s.behavior || '', other: s.other || '',
    contacts: [[s.c1n, s.c1p], [s.c2n, s.c2p]].filter(([n, ph]) => n || ph).map(([n, ph]) => ({ name: n || '', phone: ph || '' })),
  };
}
function syncPublic(profileOverride = {}, foodName) {
  const token = S.profile.sitterToken;
  if (token) write(store.setPublic(token, buildPublic(profileOverride, foodName)));
}
const sitterLink = (token) => `${location.origin}${location.pathname}?s=${token}`;

function sheetSitter() {
  const s = S.profile.sitter || {}, token = S.profile.sitterToken;
  const body = `
    <p class="hint">הפרטים כאן, יחד עם השם, התמונה, פרטי הווטרינר ו"חשוב לזכור" מהפרופיל, יופיעו בכרטיס. מי שמקבל את הקישור רואה רק את הכרטיס – לא את שאר האפליקציה.</p>
    ${SITTER_FIELDS.map(([k, icon, label, ph]) => `<label>${icon} ${label}<textarea name="${k}" rows="2" placeholder="${ph}">${esc(s[k])}</textarea></label>`).join('')}
    <p class="hint" style="margin-top:16px">📞 אנשי קשר</p>
    <div class="row two"><label>שם<input name="c1n" value="${esc(s.c1n)}"></label><label>טלפון<input name="c1p" type="tel" value="${esc(s.c1p)}"></label></div>
    <div class="row two"><label>שם<input name="c2n" value="${esc(s.c2n)}"></label><label>טלפון<input name="c2p" type="tel" value="${esc(s.c2p)}"></label></div>
    <button class="btn primary block">שמירה</button>
    <div class="share-box">
      ${token ? `<b>🔗 קישור פעיל</b>
        <div class="link-text" dir="ltr">${esc(sitterLink(token))}</div>
        <div class="row gap">
          <button type="button" class="btn primary small" data-act="sitter-share">שיתוף הקישור</button>
          <a class="btn small" href="${esc(sitterLink(token))}" target="_blank" rel="noopener">👀 תצוגה</a>
          <button type="button" class="btn ghost danger small" data-act="sitter-revoke">ביטול הקישור</button>
        </div>
        <p class="hint">כל שמירה מעדכנת את הכרטיס אוטומטית. "ביטול הקישור" מנתק אותו לגמרי.</p>`
      : `<b>🔗 שיתוף</b><p class="hint">יוצרים קישור ושולחים בוואטסאפ למי ששומר על ${esc(dogName())}.</p>
        <button type="button" class="btn primary block" data-act="sitter-create">יצירת קישור לשמרטף</button>`}
    </div>`;
  openSheet('כרטיס לשמרטף', body, (d) => {
    const sitter = {};
    for (const k of ['feeding', 'meds', 'walks', 'behavior', 'other', 'c1n', 'c1p', 'c2n', 'c2p']) sitter[k] = (d[k] || '').trim();
    write(store.saveProfile({ sitter }));
    syncPublic({ sitter });
    toast('נשמר ✓');
  });
}

function readSitterForm() {
  const f = dlg().querySelector('form');
  if (!f || !f.feeding) return null;
  const sitter = {};
  for (const k of ['feeding', 'meds', 'walks', 'behavior', 'other', 'c1n', 'c1p', 'c2n', 'c2p']) sitter[k] = (f[k].value || '').trim();
  return sitter;
}

async function createSitterLink() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const token = Array.from(bytes, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const sitter = readSitterForm() || S.profile.sitter || {};
  try {
    await store.setPublic(token, buildPublic({ sitter }));
    await write(store.saveProfile({ sitter, sitterToken: token }));
    S.profile.sitter = sitter; S.profile.sitterToken = token;
    sheetSitter();
    toast('הקישור מוכן ✓');
  } catch (e) { toast(errMsg(e)); }
}

async function shareSitterLink() {
  const url = sitterLink(S.profile.sitterToken);
  const text = `כל מה שצריך לדעת על ${dogName()} 🐶`;
  try {
    if (navigator.share) await navigator.share({ title: text, text, url });
    else { await navigator.clipboard.writeText(url); toast('הקישור הועתק ✓'); }
  } catch (e) {
    if (e?.name !== 'AbortError') { try { await navigator.clipboard.writeText(url); toast('הקישור הועתק ✓'); } catch {} }
  }
}

function revokeSitterLink() {
  if (!confirm('לבטל את הקישור? מי שקיבל אותו כבר לא יוכל לפתוח את הכרטיס.')) return;
  const token = S.profile.sitterToken;
  write(store.removePublic(token));
  write(store.saveProfile({ sitterToken: null }));
  S.profile.sitterToken = null;
  sheetSitter();
  toast('הקישור בוטל');
}

const telHref = (ph) => `tel:${String(ph).replace(/[^\d+]/g, '')}`;
function sitterHTML(d) {
  const sub = [d.breed, ageText(d.birthDate)].filter(Boolean).map(esc).join(' · ');
  const block = (icon, title, text) => (text ? `<section class="card scard"><h3>${icon} ${title}</h3><p>${esc(text)}</p></section>` : '');
  return `
  <div class="sitter-page">
    <section class="hero sitter-hero">
      <div class="avatar">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : '<span>🐶</span>'}</div>
      <div class="hero-text"><p class="muted small">כרטיס לשמרטף</p><h1>${esc(d.name)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
    </section>
    ${d.notes ? `<section class="card scard warn"><h3>⚠️ חשוב לדעת</h3><p>${esc(d.notes)}</p></section>` : ''}
    ${block('🍖', 'אוכל', [d.foodName && `אוכל: ${d.foodName}`, d.feeding].filter(Boolean).join('\n'))}
    ${block('💊', 'תרופות וטיפולים', d.meds)}
    ${block('🚶', 'טיולים ושגרה', d.walks)}
    ${block('🐾', 'התנהגות', d.behavior)}
    ${block('📝', 'עוד דברים', d.other)}
    ${(d.contacts || []).length ? `<section class="card scard"><h3>📞 אנשי קשר</h3>${d.contacts.map((c) => `
      <a class="call-row" ${c.phone ? `href="${telHref(c.phone)}"` : ''}><span><b>${esc(c.name)}</b> <span class="muted" dir="ltr">${esc(c.phone)}</span></span>${c.phone ? '<span class="call">📞</span>' : ''}</a>`).join('')}</section>` : ''}
    ${d.vetName || d.vetPhone ? `<section class="card scard"><h3>🩺 וטרינר</h3>
      <a class="call-row" ${d.vetPhone ? `href="${telHref(d.vetPhone)}"` : ''}><span><b>${esc(d.vetName || 'וטרינר')}</b> <span class="muted" dir="ltr">${esc(d.vetPhone)}</span></span>${d.vetPhone ? '<span class="call">📞</span>' : ''}</a></section>` : ''}
    ${d.chip ? `<p class="muted small center">מספר שבב: <span dir="ltr">${esc(d.chip)}</span></p>` : ''}
    ${d.updatedAt ? `<p class="muted small center">עודכן ${fmt(toISO(new Date(d.updatedAt)))}</p>` : ''}
  </div>`;
}

async function bootSitter(token) {
  document.body.classList.add('sitter-mode');
  let d = null;
  try { d = await store.getPublic(token); } catch {}
  $('#boot').remove();
  $('#app').hidden = false;
  $('#view').innerHTML = d ? sitterHTML(d) : '<div class="empty" style="margin-top:30vh"><p>הקישור הזה כבר לא פעיל 🐾</p></div>';
  if (d) document.title = `${d.name} – כרטיס לשמרטף`;
}

// ---------- actions ----------
const ACTIONS = {
  go: (_, el) => { S.tab = el.dataset.to; render(); scrollTo(0, 0); },
  close: () => closeSheet(),
  'care-seg': (_, el) => { S.careSeg = el.dataset.seg; render(); },
  filter: (_, el) => { S.itemFilter = el.dataset.f; render(); },
  'only-love': () => { S.onlyLove = !S.onlyLove; render(); },
  'add-treatment': () => sheetTreatment(),
  'edit-treatment': (id) => sheetTreatment(find('treatments', id)),
  done: (id) => sheetDone(find('treatments', id)),
  ics: (id) => downloadIcs(find('treatments', id)),
  'del-treatment': (id) => {
    if (!confirm('למחוק את הטיפול מהרשימה? ההיסטוריה שלו תישאר.')) return;
    write(store.remove('treatments', id)); closeSheet(); toast('נמחק');
  },
  preset: (_, el) => {
    const p = PRESETS[el.dataset.i], f = dlg().querySelector('form');
    f.name.value = p.name; f.type.value = p.type; f.recurring.checked = true;
    f.every.value = p.every; f.unit.value = p.unit;
    f.dispatchEvent(new Event('change'));
    f.querySelectorAll('[data-act="preset"]').forEach((b) => b.classList.toggle('on', b === el));
  },
  'add-history': () => sheetHistory(),
  'del-history': (id) => { if (confirm('למחוק את הרישום?')) write(store.remove('history', id)); },
  'add-item': () => sheetItem(),
  'view-item': (id) => sheetItemView(find('items', id)),
  'edit-item': (id) => sheetItem(find('items', id)),
  'del-item': (id) => { if (!confirm('למחוק את המוצר?')) return; write(store.remove('items', id)); closeSheet(); toast('נמחק'); },
  'add-weight': () => sheetWeight(),
  'del-weight': (id) => { if (confirm('למחוק את השקילה?')) write(store.remove('weights', id)); },
  'edit-profile': () => sheetProfile(),
  'pick-photo': () => dlg().querySelector('#photoInput').click(),
  'exp-month': (_, el) => {
    const m = el.dataset.d === '1' ? nextMonth(S.expMonth) : prevMonth(S.expMonth);
    if (m <= ym(today())) { S.expMonth = m; render(); }
  },
  'add-expense': () => sheetExpense(),
  'edit-expense': (id) => sheetExpense(find('expenses', id)),
  'del-expense': (id) => { if (!confirm('למחוק את ההוצאה?')) return; write(store.remove('expenses', id)); closeSheet(); toast('נמחק'); },
  'add-recurring': () => sheetRecurring(),
  'edit-recurring': (id) => sheetRecurring(find('recurring', id)),
  'del-recurring': (id) => {
    if (!confirm('למחוק את ההוצאה הקבועה? חיובים שכבר נרשמו יישארו בהיסטוריה.')) return;
    write(store.remove('recurring', id)); closeSheet(); toast('נמחק');
  },
  'food-bag': () => sheetFoodBag(),
  'food-settings': () => sheetFoodSettings(),
  'del-bag': (id) => { if (confirm('למחוק את הרישום?')) { write(store.remove('foodBags', id)); closeSheet(); } },
  sitter: () => sheetSitter(),
  'sitter-create': () => createSitterLink(),
  'sitter-share': () => shareSitterLink(),
  'sitter-revoke': () => revokeSitterLink(),
  logout: () => { if (confirm(DEMO ? 'לאפס את נתוני ההדגמה?' : 'להתנתק?')) store.logout(); },
};

document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav button');
  if (nav) { S.tab = nav.dataset.tab; render(); scrollTo(0, 0); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset.id, el); }
});

$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
$('#sheet').addEventListener('close', () => { pendingPhoto = null; });

// ---------- auth / boot ----------
function startWatch() {
  const onErr = (e) => toast(errMsg(e));
  const cols = ['treatments', 'history', 'items', 'weights', 'expenses', 'recurring', 'foodBags'];
  unsubs = [
    store.watchProfile((p, m) => {
      S.profile = p || {};
      if (!m?.fromCache) { S.ready.profile = true; seedDefaults(); }
      render();
    }, onErr),
    ...cols.map((n) => store.watch(n, (arr, m) => {
      S[n] = arr;
      if (!m?.fromCache) {
        S.ready[n] = true;
        if (n === 'recurring') { seedDefaults(); genRecurring(); }
      }
      render();
    }, onErr)),
  ];
}
function stopWatch() { unsubs.forEach((u) => { try { u(); } catch {} }); unsubs = []; }

function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
}
function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  render();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, err = $('#loginErr'), btn = f.querySelector('button');
  err.textContent = ''; btn.disabled = true;
  try { await store.login(f.email.value, f.password.value); }
  catch (ex) {
    err.textContent = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(ex.code)
      ? 'מייל או סיסמה שגויים' : ex.code === 'auth/too-many-requests' ? 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות' : 'שגיאה: ' + (ex.code || ex.message);
  }
  btn.disabled = false;
});

(async () => {
  try {
    store = await initStore();
  } catch (e) {
    $('#boot').textContent = 'לא הצלחתי להתחבר ל-Firebase. בדקו חיבור לאינטרנט והגדרות.';
    return;
  }
  const sitterToken = new URLSearchParams(location.search).get('s');
  if (sitterToken) { await bootSitter(sitterToken); return; }
  $('#boot').remove();
  store.onAuth((user) => {
    S.user = user;
    stopWatch();
    if (user) { startWatch(); showApp(); } else showLogin();
  });
})();

// ---------- staying fresh on iPhone ----------
// iOS freezes home-screen apps in the background and the live connection can go stale.
// 1) Re-subscribe whenever the app comes back to the foreground.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (!S.user || document.body.classList.contains('sitter-mode')) return;
  if (Date.now() - hiddenAt > 10 * 60 * 1000) { location.reload(); return; }
  stopWatch(); startWatch();
});
window.addEventListener('online', () => { if (S.user) { stopWatch(); startWatch(); } });

// 2) Pull down from the top to refresh.
(() => {
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.innerHTML = '<span>↓</span>';
  document.body.appendChild(ind);
  let startY = null, dy = 0;
  const TH = 80;
  document.addEventListener('touchstart', (e) => {
    if (window.scrollY > 0 || $('#sheet').open || document.querySelector('.cropper') || $('#app').hidden) { startY = null; return; }
    startY = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { ind.style.transform = ''; ind.classList.remove('show'); return; }
    const pull = Math.min(dy, 130) * 0.6;
    ind.classList.add('show');
    ind.style.transform = `translate(-50%, ${pull}px) rotate(${Math.min(dy / TH, 1) * 180}deg)`;
    ind.classList.toggle('ready', dy > TH);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (startY === null) return;
    if (dy > TH) {
      ind.classList.add('spin');
      ind.innerHTML = '<span>🐾</span>';
      setTimeout(() => location.reload(), 250);
    } else { ind.style.transform = ''; ind.classList.remove('show', 'ready'); }
    startY = null;
  });
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
