import { initStore, DEMO } from './store.js';

const VERSION = '1.0.2';

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toISO(new Date());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (iso) => (iso ? parse(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '');
const daysUntil = (iso) => Math.round((parse(iso) - parse(today())) / 86400000);
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
const VERDICTS = { love: ['😍', 'אהב'], ok: ['😐', 'ככה ככה'], no: ['👎', 'לא אהב'] };

// ---------- state ----------
const S = {
  user: null, profile: {}, treatments: [], history: [], items: [], weights: [],
  tab: 'home', careSeg: 'plan', itemFilter: 'all', onlyLove: false,
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
  const views = { home: viewHome, care: viewCare, items: viewItems, weight: viewWeight };
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

  <div class="sec-head"><h2>הבא בתור</h2>${up.length > 3 ? `<button class="link" data-act="go" data-to="care">הכל (${up.length})</button>` : ''}</div>
  ${up.length ? up.slice(0, 3).map(treatmentCard).join('') : emptyState('עוד לא הוספתם טיפולים וחיסונים', 'add-treatment', '+ הוספת טיפול')}

  ${p.vetName || p.vetPhone ? `
  <a class="card vet" ${p.vetPhone ? `href="tel:${esc(p.vetPhone.replace(/[^\d+]/g, ''))}"` : ''}>
    <span class="vet-icon">🩺</span>
    <span class="vet-text"><b>${esc(p.vetName || 'וטרינר')}</b>${p.vetPhone ? `<span class="muted">${esc(p.vetPhone)}</span>` : ''}</span>
    ${p.vetPhone ? '<span class="vet-call">📞</span>' : ''}
  </a>` : ''}

  ${p.notes ? `<div class="card note-card"><b>חשוב לזכור</b><p>${esc(p.notes)}</p></div>` : ''}

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
    ${t.recurring ? '<p class="hint calc" id="calc"></p>' : '<p class="hint">טיפול חד פעמי – אחרי הסימון הוא יעבור להיסטוריה.</p>'}
    <button class="btn primary block">✓ סימון כבוצע</button>`;
  const f = openSheet('סימון כבוצע', body, (d) => {
    write(store.add('history', { treatmentId: t.id, name: t.name, type: t.type, date: d.date, where: d.where.trim(), notes: d.notes.trim() }));
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
function bindPhoto(form, maxSide) {
  form.querySelector('#photoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const pick = form.querySelector('.photo-pick');
    pick.classList.add('loading');
    try {
      pendingPhoto = await compressImage(file, maxSide);
      pick.innerHTML = `<img src="${pendingPhoto}" alt="">`;
    } catch { toast('לא הצלחתי לקרוא את התמונה'); }
    pick.classList.remove('loading');
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
    toast('נשמר ✓');
  });
  pendingPhoto = p.photo || null;
  bindPhoto(f, 600);
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
  unsubs = [
    store.watchProfile((p) => { S.profile = p || {}; render(); }, onErr),
    ...['treatments', 'history', 'items', 'weights'].map((n) => store.watch(n, (arr) => { S[n] = arr; render(); }, onErr)),
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
  $('#boot').remove();
  store.onAuth((user) => {
    S.user = user;
    stopWatch();
    if (user) { startWatch(); showApp(); } else showLogin();
  });
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
