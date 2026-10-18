// Data layer: Firebase (shared between users) or local demo mode.
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
    // Offline cache: the app works without signal and syncs when back online
    db = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
    });
  } catch {
    db = F.getFirestore(app);
  }
  const col = (name) => F.collection(db, 'dogs', DOG_ID, name);
  const dogRef = F.doc(db, 'dogs', DOG_ID);
  const who = () => auth.currentUser?.email || '';
  const now = () => new Date().toISOString();

  return {
    onAuth: (cb) => A.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null)),
    login: (email, pass) => A.signInWithEmailAndPassword(auth, email.trim(), pass),
    logout: () => A.signOut(auth),
    watch: (name, cb, onErr) =>
      F.onSnapshot(col(name), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr),
    watchProfile: (cb, onErr) =>
      F.onSnapshot(dogRef, (s) => cb(s.exists() ? s.data() : {}), onErr),
    saveProfile: (data) => F.setDoc(dogRef, { ...data, updatedBy: who(), updatedAt: now() }, { merge: true }),
    add: (name, data) => F.addDoc(col(name), { ...data, by: who(), createdAt: now() }),
    update: (name, id, data) => F.updateDoc(F.doc(col(name), id), { ...data, updatedBy: who(), updatedAt: now() }),
    remove: (name, id) => F.deleteDoc(F.doc(col(name), id)),
  };
}

// ---------------------------------------------------------------------
// Demo mode: everything lives in this browser's localStorage
// ---------------------------------------------------------------------
function createDemo() {
  const KEY = 'koko-demo-v1';
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!data) data = seed();
  const subs = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };
  const snapshot = (name) =>
    name === 'profile' ? { ...data.profile } : Object.entries(data[name] || {}).map(([id, v]) => ({ id, ...v }));
  const emit = (name) => (subs[name] || []).forEach((cb) => cb(snapshot(name)));
  const on = (name, cb) => {
    (subs[name] ||= []).push(cb);
    setTimeout(() => cb(snapshot(name)));
    return () => { subs[name] = subs[name].filter((x) => x !== cb); };
  };
  const newId = () => Math.random().toString(36).slice(2, 10);
  const commit = (name) => { save(); emit(name); };

  return {
    onAuth: (cb) => setTimeout(() => cb({ email: 'demo' })),
    login: async () => {},
    logout: async () => { try { localStorage.removeItem(KEY); } catch {} location.reload(); },
    watch: (name, cb) => on(name, cb),
    watchProfile: (cb) => on('profile', cb),
    saveProfile: async (d) => { data.profile = { ...data.profile, ...d }; commit('profile'); },
    add: async (name, d) => {
      (data[name] ||= {})[newId()] = { ...d, by: 'demo', createdAt: new Date().toISOString() };
      commit(name);
    },
    update: async (name, id, d) => { Object.assign(data[name][id], d); commit(name); },
    remove: async (name, id) => { delete data[name][id]; commit(name); },
  };
}

function seed() {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };
  const t0 = new Date().toISOString();
  return {
    profile: { name: 'קוקו', breed: 'מעורב', birthDate: shift(-3 * 365 - 40), vetName: 'מרפאה וטרינרית', vetPhone: '' },
    treatments: {
      a: { name: 'תולעת הפארק', type: 'טיפול', recurring: true, every: 4, unit: 'months', lastDone: shift(-108), nextDue: shift(14), notes: '', createdAt: t0 },
      b: { name: 'פרעושים וקרציות', type: 'טיפול', recurring: true, every: 1, unit: 'months', lastDone: shift(-33), nextDue: shift(-3), notes: '', createdAt: t0 },
      c: { name: 'כלבת', type: 'חיסון', recurring: true, every: 12, unit: 'months', lastDone: shift(-60), nextDue: shift(305), notes: '', createdAt: t0 },
      d: { name: 'משושה', type: 'חיסון', recurring: true, every: 12, unit: 'months', lastDone: shift(-60), nextDue: shift(305), notes: '', createdAt: t0 },
    },
    history: {
      h1: { name: 'תולעת הפארק', type: 'טיפול', date: shift(-108), where: '', notes: '', createdAt: t0 },
      h2: { name: 'פרעושים וקרציות', type: 'טיפול', date: shift(-33), where: '', notes: '', createdAt: t0 },
      h3: { name: 'כלבת', type: 'חיסון', date: shift(-60), where: 'מרפאה וטרינרית', notes: '', createdAt: t0 },
      h4: { name: 'משושה', type: 'חיסון', date: shift(-60), where: 'מרפאה וטרינרית', notes: '', createdAt: t0 },
    },
    items: {
      i1: { name: 'אוכל יבש – דוגמה', cat: 'food', verdict: 'love', where: 'חנות החיות בשכונה', price: '', notes: 'גם אחרי שבוע עדיין מתלהב', createdAt: t0 },
      i2: { name: 'חטיף לעיסה – דוגמה', cat: 'treats', verdict: 'ok', where: '', price: '', notes: '', createdAt: t0 },
      i3: { name: 'כדור מצפצף', cat: 'toys', verdict: 'no', where: '', price: '', notes: 'שבר אותו תוך יומיים', createdAt: t0 },
    },
    weights: {
      w1: { date: shift(-150), kg: 11.2 }, w2: { date: shift(-90), kg: 11.6 },
      w3: { date: shift(-45), kg: 11.9 }, w4: { date: shift(-5), kg: 11.7 },
    },
  };
}
