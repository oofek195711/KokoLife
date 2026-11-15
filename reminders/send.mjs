// =====================================================================
//  Koko – daily Telegram reminders (runs on GitHub Actions, every hour)
//  1. Connects people who opened the "connect" link from the app (/start <code>)
//  2. Once a day, from 11:00 Israel time: sends what's 7 days or 1 day away
//     (treatments & vaccines, document expiry, food running out)
//  Secrets (GitHub → Settings → Secrets → Actions): TELEGRAM_TOKEN, FIREBASE_SA
// =====================================================================
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TOKEN = process.env.TELEGRAM_TOKEN;
const SA = process.env.FIREBASE_SA;
const TEST = process.env.TEST === 'true';
const APP_URL = process.env.APP_URL || '';
const SEND_HOUR = 11;           // Israel time
const DAYS_BEFORE = [7, 1];     // a week before and a day before

if (!TOKEN || !SA) {
  console.error('❌ Missing secrets: TELEGRAM_TOKEN and/or FIREBASE_SA (GitHub → Settings → Secrets and variables → Actions)');
  process.exit(1);
}

// ---------- dates (Israel) ----------
const TZ = 'Asia/Jerusalem';
const P = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date()).map((p) => [p.type, p.value]));
const TODAY = process.env.FAKE_TODAY || `${P.year}-${P.month}-${P.day}`;
const HOUR = process.env.FAKE_HOUR ? Number(process.env.FAKE_HOUR) : Number(P.hour);
const dayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const daysUntil = (iso) => Math.round(dayNum(iso) - dayNum(TODAY));
const addDays = (iso, n) => new Date((dayNum(iso) + n) * 864e5).toISOString().slice(0, 10);
const fmt = (iso) => { const [, m, d] = iso.split('-'); return `${Number(d)}.${Number(m)}`; };
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const when = (n) => (n < 0 ? `באיחור של ${-n} ימים` : n === 0 ? 'היום' : n === 1 ? 'מחר' : n === 7 ? 'בעוד שבוע' : `בעוד ${n} ימים`);

// ---------- Telegram ----------
async function tg(method, body = {}) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) { const e = new Error(`Telegram ${method}: ${j.description}`); e.code = j.error_code; throw e; }
  return j.result;
}
const say = (chat_id, text) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true });
// replies to people never stop the run
const reply = (chat_id, text) => say(chat_id, text).catch((e) => console.log(`reply to ${chat_id} failed: ${e.message}`));

// ---------- Firestore ----------
initializeApp({ credential: cert(JSON.parse(SA)) });
const db = getFirestore();
const dog = db.collection('dogs').doc('koko');
const sysRef = dog.collection('system').doc('telegram');
const all = async (name) => (await dog.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const TYPE_ICON = { 'חיסון': '💉', 'תילוע': '🪱', 'טיפול': '💊', 'בדיקה': '🩺', 'אחר': '📌' };
const DOC_ICON = { license: '🪪', vaccines: '💉', insurance: '🛡️', tests: '🧪', receipt: '🧾', other: '📄' };

async function main() {
  const sys = (await sysRef.get()).data() || {};
  let chats = Array.isArray(sys.chats) ? [...sys.chats] : [];
  const patch = {};

  // 1) bot name (the app builds the "connect" link from it)
  const me = await tg('getMe');
  if (sys.bot !== me.username) patch.bot = me.username;

  // 2) new messages: /start <code> connects, /stop disconnects
  const updates = await tg('getUpdates', { offset: sys.offset || 0, timeout: 0, allowed_updates: ['message'] });
  for (const u of updates) {
    patch.offset = u.update_id + 1;
    const m = u.message;
    if (!m?.text) continue;
    const chatId = m.chat.id;
    const name = m.chat.title || [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || 'משתמש';
    const [cmd, arg] = m.text.trim().split(/\s+/);
    const known = chats.some((c) => c.id === chatId);
    if (cmd === '/start') {
      if (known) await reply(chatId, '✅ כבר מחובר. תזכורות יגיעו לכאן כל יום ב-11:00.');
      else if (sys.code && arg === sys.code) {
        chats.push({ id: chatId, name, since: TODAY });
        await reply(chatId, `✅ <b>מחובר!</b>\nמעכשיו יגיעו לכאן תזכורות על קוקו – שבוע ויום לפני כל טיפול, חיסון או מסמך שפג, ב-11:00.\n\nכדי להפסיק: שלחו /stop`);
        console.log(`connected: ${name}`);
      } else {
        await reply(chatId, '🔒 כדי להתחבר, פתחו את קישור החיבור מתוך האפליקציה של קוקו (מסך הבית → התראות בטלגרם).');
      }
    } else if (cmd === '/stop' && known) {
      chats = chats.filter((c) => c.id !== chatId);
      await reply(chatId, '👋 נותקת. לא יגיעו יותר תזכורות. אפשר להתחבר שוב מהאפליקציה.');
    }
  }
  if (JSON.stringify(chats) !== JSON.stringify(sys.chats || [])) patch.chats = chats;

  // 3) daily reminders
  const due = TEST || (HOUR >= SEND_HOUR && HOUR < 21 && sys.lastSent !== TODAY);
  if (due) {
    const [profileSnap, treatments, docs, foodBags] = await Promise.all([dog.get(), all('treatments'), all('docs'), all('foodBags')]);
    const profile = profileSnap.data() || {};
    const dogName = profile.name || 'קוקו';
    const hit = (n) => (TEST ? n <= 30 : DAYS_BEFORE.includes(n));
    const lines = [];

    for (const t of treatments) {
      if (!t.nextDue) continue;
      const n = daysUntil(t.nextDue);
      if (hit(n)) lines.push({ n, text: `${TYPE_ICON[t.type] || '📌'} <b>${esc(t.name)}</b> – ${when(n)} (${fmt(t.nextDue)})` });
    }
    for (const d of docs) {
      if (!d.expiry) continue;
      const n = daysUntil(d.expiry);
      if (hit(n)) lines.push({ n, text: `${DOC_ICON[d.type] || '📄'} <b>${esc(d.title)}</b> – ${n < 0 ? 'פג תוקף' : `פג תוקף ${when(n)}`} (${fmt(d.expiry)})` });
    }
    const bags = foodBags.filter((b) => b.date).sort((a, b) => a.date.localeCompare(b.date));
    if (bags.length) {
      const gaps = [];
      for (let i = Math.max(1, bags.length - 3); i < bags.length; i++) {
        const g = Math.round(dayNum(bags[i].date) - dayNum(bags[i - 1].date));
        if (g >= 3) gaps.push(g);
      }
      const est = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : (Number(profile.food?.days) || 30);
      const runOut = addDays(bags[bags.length - 1].date, est);
      const n = daysUntil(runOut);
      if (hit(n) && n >= 0) lines.push({ n, text: `🍖 <b>האוכל</b> ייגמר בערך ${when(n)} – הזמן לקנות` });
    }

    lines.sort((a, b) => a.n - b.n);
    let text = null;
    if (lines.length) {
      text = `🐶 <b>תזכורות ל${esc(dogName)}</b>\n\n${lines.map((l) => l.text).join('\n')}`;
      if (TEST) text = `🧪 <b>הודעת בדיקה</b> – כך זה ייראה. הנה כל מה שב-30 הימים הקרובים:\n\n${lines.map((l) => l.text).join('\n')}`;
    } else if (TEST) {
      text = '🧪 <b>הודעת בדיקה</b> – הכל מחובר ✅\nאין כרגע שום דבר ב-30 הימים הקרובים.';
    }
    if (text && APP_URL) text += `\n\n<a href="${APP_URL}">לפתיחת האפליקציה ›</a>`;

    if (text) {
      if (!chats.length) console.log('⚠️ No one is connected yet – open the connect link from the app first.');
      for (const c of [...chats]) {
        try { await say(c.id, text); console.log(`sent to ${c.name}`); }
        catch (e) {
          console.log(`failed for ${c.name}: ${e.message}`);
          if (e.code === 403) { chats = chats.filter((x) => x.id !== c.id); patch.chats = chats; }
        }
      }
    } else console.log('Nothing to remind today.');
    if (!TEST) patch.lastSent = TODAY;
  } else {
    console.log(`Not sending now (Israel ${TODAY} ${HOUR}:00, last sent ${sys.lastSent || 'never'}).`);
  }

  patch.lastRun = new Date().toISOString();
  await sysRef.set(patch, { merge: true });
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
