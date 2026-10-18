// =====================================================================
//  Data layer – generic, rarely changes.
//  Firebase (shared between users) or a local demo mode.
//  Data lives under dogs/koko/<collection>; a public sitter card under public/<token>.
// =====================================================================
import { firebaseConfig } from './firebase-config.js';

const DOG_ID = 'koko';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE');

export async function initStore() {
  return DEMO ? createDemo() : createFirebase();
}

async function createFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-auth.js'),
    import(FB + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try {
    db = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
    });
  } catch {
    db = F.getFirestore(app);
  }
  const col = (name) => F.collection(db, 'dogs', DOG_ID, name);
  const ref = (name, id) => F.doc(db, 'dogs', DOG_ID, name, id);
  const dogRef = F.doc(db, 'dogs', DOG_ID);
  const pubRef = (token) => F.doc(db, 'public', token);
  const who = () => auth.currentUser?.email || '';
  const now = () => new Date().toISOString();
  const opts = { includeMetadataChanges: true };

  return {
    onAuth: (cb) => A.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null)),
    login: (email, pass) => A.signInWithEmailAndPassword(auth, email.trim(), pass),
    logout: () => A.signOut(auth),

    // cb(items, { fromCache })
    watch: (name, cb, onErr) => F.onSnapshot(col(name), opts,
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })), { fromCache: s.metadata.fromCache }), onErr),
    watchProfile: (cb, onErr) => F.onSnapshot(dogRef, opts,
      (s) => cb(s.exists() ? s.data() : {}, { fromCache: s.metadata.fromCache }), onErr),
    saveProfile: (data) => F.setDoc(dogRef, { ...data, updatedBy: who(), updatedAt: now() }, { merge: true }),

    add: (name, data) => F.addDoc(col(name), { ...data, by: who(), createdAt: now() }),
    set: (name, id, data) => F.setDoc(ref(name, id), { ...data, by: who(), updatedAt: now() }, { merge: true }),
    update: (name, id, data) => F.updateDoc(ref(name, id), { ...data, updatedBy: who(), updatedAt: now() }),
    remove: (name, id) => F.deleteDoc(ref(name, id)),

    // Public (no login) – for the sitter card link
    getPublic: async (token) => { const s = await F.getDoc(pubRef(token)); return s.exists() ? s.data() : null; },
    setPublic: (token, data) => F.setDoc(pubRef(token), { ...data, updatedAt: now() }),
    removePublic: (token) => F.deleteDoc(pubRef(token)),
  };
}

// ---------------------------------------------------------------------
// Demo mode: everything lives in this browser's localStorage
// ---------------------------------------------------------------------
function createDemo() {
  const KEY = 'koko-demo-v2';
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!data) data = seed();
  data.public ||= {};
  const subs = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };
  const snapshot = (name) =>
    name === 'profile' ? { ...data.profile } : Object.entries(data[name] || {}).map(([id, v]) => ({ id, ...v }));
  const emit = (name) => (subs[name] || []).forEach((cb) => cb(snapshot(name), { fromCache: false }));
  const on = (name, cb) => {
    (subs[name] ||= []).push(cb);
    setTimeout(() => cb(snapshot(name), { fromCache: false }));
    return () => { subs[name] = subs[name].filter((x) => x !== cb); };
  };
  const newId = () => Math.random().toString(36).slice(2, 10);
  const commit = (name) => { save(); emit(name); };
  const now = () => new Date().toISOString();

  return {
    onAuth: (cb) => setTimeout(() => cb({ email: 'demo' })),
    login: async () => {},
    logout: async () => { try { localStorage.removeItem(KEY); } catch {} location.reload(); },
    watch: (name, cb) => on(name, cb),
    watchProfile: (cb) => on('profile', cb),
    saveProfile: async (d) => { data.profile = { ...data.profile, ...d }; commit('profile'); },
    add: async (name, d) => { (data[name] ||= {})[newId()] = { ...d, by: 'demo', createdAt: now() }; commit(name); },
    set: async (name, id, d) => { (data[name] ||= {})[id] = { ...(data[name][id] || {}), ...d, by: 'demo', updatedAt: now() }; commit(name); },
    update: async (name, id, d) => { Object.assign(data[name][id], d); commit(name); },
    remove: async (name, id) => { delete data[name][id]; commit(name); },
    getPublic: async (token) => data.public[token] || null,
    setPublic: async (token, d) => { data.public[token] = d; save(); },
    removePublic: async (token) => { delete data.public[token]; save(); },
  };
}

function seed() {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };
  const t0 = new Date().toISOString();
  return {
    profile: { name: 'קוקו', breed: 'מעורב', birthDate: shift(-3 * 365 - 40), vetName: 'מרפאה וטרינרית', vetPhone: '03-1234567' },
    treatments: {
      a: { name: 'תולעת הפארק', type: 'טיפול', recurring: true, every: 4, unit: 'months', lastDone: shift(-108), nextDue: shift(14), notes: '', createdAt: t0 },
      b: { name: 'פרעושים וקרציות', type: 'טיפול', recurring: true, every: 1, unit: 'months', lastDone: shift(-33), nextDue: shift(-3), notes: '', createdAt: t0 },
      c: { name: 'כלבת', type: 'חיסון', recurring: true, every: 12, unit: 'months', lastDone: shift(-60), nextDue: shift(305), notes: '', createdAt: t0 },
    },
    history: {
      h1: { name: 'תולעת הפארק', type: 'טיפול', date: shift(-108), where: '', notes: '', createdAt: t0 },
      h3: { name: 'כלבת', type: 'חיסון', date: shift(-60), where: 'מרפאה וטרינרית', notes: '', createdAt: t0 },
    },
    items: {
      i1: { name: 'אוכל יבש – דוגמה', cat: 'food', verdict: 'love', where: 'חנות החיות', price: '', notes: '', createdAt: t0 },
      i3: { name: 'כדור מצפצף', cat: 'toys', verdict: 'no', where: '', price: '', notes: '', createdAt: t0 },
    },
    weights: { w1: { date: shift(-90), kg: 11.6 }, w4: { date: shift(-5), kg: 11.7 } },
    expenses: {
      e1: { date: shift(-60), amount: 180, cat: 'vet', note: 'חיסון כלבת', createdAt: t0 },
      e2: { date: shift(-40), amount: 239, cat: 'food', note: 'שק אוכל', createdAt: t0 },
      e3: { date: shift(-10), amount: 239, cat: 'food', note: 'שק אוכל', createdAt: t0 },
      e4: { date: shift(-6), amount: 45, cat: 'toys', note: 'צעצוע', createdAt: t0 },
    },
    foodBags: {
      f1: { date: shift(-40), name: 'אוכל יבש – דוגמה', createdAt: t0 },
      f2: { date: shift(-10), name: 'אוכל יבש – דוגמה', createdAt: t0 },
    },
  };
}
