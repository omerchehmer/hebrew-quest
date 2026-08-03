// sync.js — דחיפת התקדמות לדשבורד ההורה. best-effort בלבד:
// האפליקציה היא local-first, וכישלון סנכרון לא משפיע על המשחק.

import { SUPABASE_URL, SUPABASE_ANON_KEY, syncEnabled } from './config.js';

const PENDING_KEY = 'hq.sync.pending';
let timer = null;
let inFlight = false;

// מה נשלח החוצה: התקדמות ודיוק. בלי שם מלא, בלי הקלטות, בלי כתובות.
export function snapshot(state) {
  return {
    name: state.name,
    day: state.day,
    createdAt: state.createdAt,
    completedDays: state.completedDays,
    streak: state.streak,
    xp: state.xp,
    crystals: state.crystals,
    level: Math.floor(state.xp / 250) + 1,
    stats: state.stats,
    srs: state.srs,
    glossary: state.glossary.slice(-60),
    log: state.log.slice(-250),
    writing: state.writing.slice(-25),
    blocks: state.world.placed.length,
    unlocked: state.world.unlocked,
    updatedAt: new Date().toISOString(),
  };
}

export function queuePush(state) {
  if (!syncEnabled()) return;
  clearTimeout(timer);
  timer = setTimeout(() => trySync(state), 4000);
}

export async function trySync(state) {
  if (!syncEnabled() || inFlight || !navigator.onLine) return false;
  inFlight = true;
  try {
    // דרך RPC ולא ישירות לטבלה: כך אי אפשר לדלות רשימת ילדים עם מפתח ה-anon הגלוי
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/put_progress`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ k: state.childKey, s: snapshot(state) }),
    });
    if (!res.ok) throw new Error(`sync ${res.status}`);
    localStorage.removeItem(PENDING_KEY);
    return true;
  } catch (e) {
    // נשמור סימון שיש מה לדחוף, וננסה שוב בפעם הבאה
    localStorage.setItem(PENDING_KEY, '1');
    console.info('סנכרון נדחה', e.message);
    return false;
  } finally {
    inFlight = false;
  }
}

window.addEventListener('online', () => {
  if (localStorage.getItem(PENDING_KEY)) {
    // main.js דוחף שוב בטעינה הבאה; כאן רק מסירים את הסימון אם אין מצב זמין
  }
});
