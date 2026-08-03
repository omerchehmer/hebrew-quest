// srs.js — חזרה מרווחת בשיטת קופסאות לייטנר.
// קופסה 1 = היום שוב. כל הצלחה מקדמת קופסה ומרחיקה את החזרה. טעות מחזירה לקופסה 1.

import { todayISO, addDays, daysBetween } from './storage.js';

// ימים עד החזרה הבאה, לפי קופסה (אינדקס 1..5).
// קופסה 1 = 0 ימים בכוונה: פריט שנכשל חייב לחזור באותו יום, לא מחר.
export const INTERVALS = [0, 0, 1, 3, 7, 16];
export const MAX_BOX = 5;

export function record(state, item, correct, ms = 0) {
  const id = item.id;
  const rec = state.srs[id] || { box: 0, due: todayISO(), seen: 0, wrong: 0 };
  rec.seen++;
  if (correct) {
    rec.box = Math.min(MAX_BOX, (rec.box || 0) + 1);
  } else {
    rec.wrong++;
    rec.box = 1;
    state.stats.errors[id] = (state.stats.errors[id] || 0) + 1;
  }
  rec.due = addDays(todayISO(), INTERVALS[rec.box]);
  rec.last = todayISO();
  rec.ms = ms;
  state.srs[id] = rec;

  const strand = item.strand || 'other';
  const skill = item.skill || 'other';
  bump(state.stats.byStrand, strand, correct);
  bump(state.stats.bySkill, skill, correct);
  return rec;
}

function bump(obj, key, correct) {
  const o = (obj[key] = obj[key] || { c: 0, t: 0 });
  o.t++;
  if (correct) o.c++;
}

export function isDue(state, id) {
  const rec = state.srs[id];
  if (!rec) return false;
  return daysBetween(rec.due, todayISO()) >= 0;
}

export function isNew(state, id) {
  return !state.srs[id];
}

// בונה תור לתחנה: ~70% חזרות שהגיע זמנן, ~30% חדש.
// חזרות "בוערות" (קופסה נמוכה, הרבה טעויות) קודמות.
export function buildQueue(state, pool, n, { newRatio = 0.3 } = {}) {
  const due = [];
  const fresh = [];
  for (const it of pool) {
    if (isNew(state, it.id)) fresh.push(it);
    else if (isDue(state, it.id)) due.push(it);
  }
  due.sort((a, b) => {
    const ra = state.srs[a.id], rb = state.srs[b.id];
    if (ra.box !== rb.box) return ra.box - rb.box;
    return (rb.wrong || 0) - (ra.wrong || 0);
  });
  shuffle(fresh);

  const wantNew = Math.round(n * newRatio);
  const wantDue = n - wantNew;
  const out = [...due.slice(0, wantDue), ...fresh.slice(0, wantNew)];

  // השלמה אם אחד הצדדים לא הספיק
  if (out.length < n) out.push(...fresh.slice(wantNew, wantNew + (n - out.length)));
  if (out.length < n) out.push(...due.slice(wantDue, wantDue + (n - out.length)));
  // ואם עדיין חסר — פריטים שנלמדו וטרם הגיע זמנם, הכי קרובים ראשונים
  if (out.length < n) {
    const rest = pool
      .filter((it) => !out.includes(it))
      .sort((a, b) => (state.srs[a.id]?.box ?? 9) - (state.srs[b.id]?.box ?? 9));
    out.push(...rest.slice(0, n - out.length));
  }
  return shuffle(out).slice(0, n);
}

// תור החימום: כל מה שהגיע זמנו, מכל התחומים, הקשה קודם.
export function warmupQueue(state, allItems, n = 8) {
  const due = allItems.filter((it) => isDue(state, it.id));
  due.sort((a, b) => {
    const ra = state.srs[a.id], rb = state.srs[b.id];
    if (ra.box !== rb.box) return ra.box - rb.box;
    return (rb.wrong || 0) - (ra.wrong || 0);
  });
  return due.slice(0, n);
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickDistractors(pool, exclude, n, keyFn = (x) => x) {
  const seen = new Set([keyFn(exclude)]);
  const out = [];
  for (const c of shuffle([...pool])) {
    const k = keyFn(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

// סטטיסטיקה לדשבורד ההורה
export function masteryReport(state, allItems) {
  const bySkill = {};
  for (const it of allItems) {
    const rec = state.srs[it.id];
    if (!rec) continue;
    const s = (bySkill[it.skill] = bySkill[it.skill] || { seen: 0, mastered: 0, weak: [] });
    s.seen++;
    if (rec.box >= 4) s.mastered++;
    else if (rec.wrong >= 2) s.weak.push(it);
  }
  return bySkill;
}
