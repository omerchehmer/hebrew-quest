// storage.js — שמירה מקומית. local-first: האפליקציה עובדת מלא גם בלי רשת.

const KEY = 'hq.state.v1';

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000);
};

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function randomKey() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function freshState() {
  return {
    v: 1,
    childKey: randomKey(),
    name: '',
    createdAt: todayISO(),
    settings: { nikud: true, speech: true, fontScale: 1, sfx: true, parentPin: '' },
    day: 1,
    dayState: null,
    completedDays: {},
    streak: { count: 0, last: null, shields: 0 },
    xp: 0,
    crystals: 0,
    world: { blocks: 0, placed: [], unlocked: [] },
    srs: {},
    stats: { byStrand: {}, bySkill: {}, errors: {} },
    glossary: [],
    log: [],
    writing: [],
    pending: [],
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const s = JSON.parse(raw);
    return { ...freshState(), ...s, settings: { ...freshState().settings, ...(s.settings || {}) } };
  } catch (e) {
    console.warn('שחזור מצב נכשל, מתחילים מחדש', e);
    return freshState();
  }
}

let timer = null;
export function save(state, immediate = false) {
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('שמירה נכשלה', e);
    }
  };
  if (immediate) {
    clearTimeout(timer);
    write();
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(write, 400);
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function importState(json) {
  const s = JSON.parse(json);
  if (!s || typeof s !== 'object' || !s.srs) throw new Error('קובץ לא תקין');
  return { ...freshState(), ...s };
}
