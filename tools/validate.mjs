// ולידציה של בנקי התוכן.  הרצה: node tools/validate.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const data = (n) => JSON.parse(readFileSync(join(here, '..', 'data', `${n}.json`), 'utf8'));

const curriculum = data('curriculum');
const vocab = data('vocab');
const grammar = data('grammar');
const spelling = data('spelling');
const texts = data('texts');

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

/* ---------- כתיב ---------- */

function parseTemplate(t) {
  let word = '';
  const gaps = [];
  let i = 0;
  while (i < t.length) {
    const open = t.indexOf('{', i);
    if (open === -1) { word += t.slice(i); break; }
    word += t.slice(i, open);
    const close = t.indexOf('}', open);
    if (close === -1) throw new Error('סוגר חסר');
    const opts = t.slice(open + 1, close).split('|');
    gaps.push({ i: word.length, len: opts[0].length, correct: opts[0], opts });
    word += opts[0];
    i = close + 1;
  }
  return { word, gaps };
}

const spellIds = new Map();
let spellCount = 0;
for (const [key, set] of Object.entries(spelling.sets)) {
  if (!set.skill) err(`spelling.${key}: חסר skill`);
  for (const row of set.items) {
    const [t, say] = row;
    let parsed;
    try { parsed = parseTemplate(t); } catch (e) { err(`spelling.${key}: תבנית שבורה "${t}"`); continue; }
    const { word, gaps } = parsed;
    spellCount++;
    if (!gaps.length) err(`spelling.${key}: "${t}" — אין פער לתרגול`);
    for (const g of gaps) {
      if (g.opts.length < 2) err(`spelling.${key}: "${t}" — פער עם אפשרות אחת`);
      if (new Set(g.opts).size !== g.opts.length) err(`spelling.${key}: "${t}" — אפשרויות כפולות`);
    }
    if (/[{}]/.test(word)) err(`spelling.${key}: "${t}" — נשארו סוגריים במילה`);
    if (!/^[֐-׿\s'"־]+$/.test(word)) err(`spelling.${key}: "${word}" — תווים לא עבריים`);
    // מילה זהה בשני סטים היא לגיטימית (אותה מילה, פער אחר). כפילות באותו סט עם אותו פער — לא.
    const sig = `${key}|${word}|${gaps.map((g) => g.i + ':' + g.correct).join(',')}`;
    if (spellIds.has(sig)) err(`spelling.${key}: פריט כפול לגמרי — "${t}"`);
    else spellIds.set(sig, key);
    if (say) {
      // ההקראה היא כתיב חסר מנוקד, הכתיב הוא מלא. משווים שלד עיצורי בלי אמות קריאה.
      const skel = (s) => s.replace(/[֑-ׇ]/g, '').replace(/[וי\s]/g, '');
      if (skel(say) !== skel(word))
        err(`spelling.${key}: ההקראה "${say}" לא תואמת לכתיב "${word}"`);
    }
  }
}

/* ---------- אוצר מילים ---------- */

let vocabCount = 0;
const vocabIds = new Set();
for (const [key, set] of Object.entries(vocab.sets)) {
  for (const w of set.words) {
    vocabCount++;
    if (!w.id) err(`vocab.${key}: פריט בלי id`);
    if (vocabIds.has(w.id)) err(`vocab: id כפול ${w.id}`);
    vocabIds.add(w.id);
    if (!w.w) err(`vocab.${w.id}: חסרה מילה`);
    if (!w.def) err(`vocab.${w.id}: חסרה הגדרה`);
    if (!Array.isArray(w.dis) || w.dis.length < 3) err(`vocab.${w.id}: צריך 3 מסיחים`);
    if (w.dis?.includes(w.def)) err(`vocab.${w.id}: מסיח זהה להגדרה`);
    if (!w.cloze) warn(`vocab.${w.id}: אין משפט השלמה`);
    else if (!w.cloze.includes('___')) err(`vocab.${w.id}: משפט ההשלמה בלי ___`);
    if (w.ok && (!w.bad || !w.bad.length)) warn(`vocab.${w.id}: יש ok בלי bad`);
  }
}

/* ---------- דקדוק ---------- */

let grammarCount = 0;
const gIds = new Set();
for (const [key, set] of Object.entries(grammar.sets)) {
  for (const it of set.items) {
    grammarCount++;
    if (!it.id) err(`grammar.${key}: פריט בלי id`);
    if (gIds.has(it.id)) err(`grammar: id כפול ${it.id}`);
    gIds.add(it.id);
    if (it.type === 'sort') {
      if (!set.cats) err(`grammar.${key}: פריטי sort בלי cats בסט`);
      else if (!set.cats.includes(it.cat)) err(`grammar.${it.id}: הקטגוריה "${it.cat}" לא ברשימת cats`);
    } else if (it.type === 'choose') {
      if (!Array.isArray(it.opts) || it.opts.length < 2) err(`grammar.${it.id}: צריך לפחות 2 אפשרויות`);
      if (typeof it.a !== 'number' || it.a < 0 || it.a >= (it.opts?.length ?? 0))
        err(`grammar.${it.id}: אינדקס תשובה לא תקין`);
      if (new Set(it.opts).size !== it.opts.length) err(`grammar.${it.id}: אפשרויות כפולות`);
    } else if (it.type === 'inflect') {
      if (!Array.isArray(it.a) || !it.a.length) err(`grammar.${it.id}: אין תשובות מקובלות`);
      if (!it.instr) err(`grammar.${it.id}: אין הוראה`);
    } else if (it.type === 'sentence') {
      if (!it.words?.length || !it.a) err(`grammar.${it.id}: חסרות מילים או תשובה`);
      else {
        const s = [...it.words].sort().join(' ');
        const a = it.a.split(' ').sort().join(' ');
        if (s !== a) err(`grammar.${it.id}: המילים לא תואמות למשפט התשובה`);
      }
    } else if (it.type === 'root') {
      if (!it.family?.length || !it.impostor) err(`grammar.${it.id}: משפחה או מתחזה חסרים`);
      if (it.family?.includes(it.impostor)) err(`grammar.${it.id}: המתחזה נמצא גם במשפחה`);
    } else err(`grammar.${it.id}: סוג לא מוכר "${it.type}"`);
  }
}

/* ---------- טקסטים ---------- */

const textIds = new Set();
let qCount = 0;
for (const t of texts.texts) {
  if (textIds.has(t.id)) err(`texts: id כפול ${t.id}`);
  textIds.add(t.id);
  if (!t.body?.length) err(`texts.${t.id}: אין גוף טקסט`);
  const words = t.body.join(' ').split(/\s+/).length;
  if (words < 50) warn(`texts.${t.id}: קצר מדי (${words} מילים)`);
  if (words > 160) warn(`texts.${t.id}: ארוך מדי (${words} מילים)`);
  // אותו כלל שמנוע הקריאה משתמש בו: מילה שלמה בגוף הטקסט, עם או בלי תחילית
  const PREFIX = 'הובלמכש';
  const forms = (w) => {
    const b = w.replace(/[֑-ׇ]/g, '').replace(/[.,:;!?"'()״׳]/g, '');
    const o = [b];
    if (b.length > 3 && PREFIX.includes(b[0])) o.push(b.slice(1));
    if (b.length > 4 && PREFIX.includes(b[0]) && PREFIX.includes(b[1])) o.push(b.slice(2));
    return o;
  };
  for (const g of t.glossary || []) {
    const found = t.body.some((s) => s.split(/\s+/).some((w) => forms(w).includes(g.w)));
    if (!found) err(`texts.${t.id}: המילון מכיל "${g.w}" שלא מופיעה כמילה שלמה בגוף הטקסט`);
  }
  if (!t.qs?.length) err(`texts.${t.id}: אין שאלות`);
  t.qs?.forEach((q, i) => {
    qCount++;
    const tag = `texts.${t.id}.q${i}`;
    if (!q.q) err(`${tag}: אין נוסח שאלה`);
    if (q.type === 'mc') {
      if (!q.opts?.length) err(`${tag}: אין אפשרויות`);
      if (typeof q.a !== 'number' || q.a < 0 || q.a >= (q.opts?.length ?? 0)) err(`${tag}: אינדקס תשובה לא תקין`);
    } else if (q.type === 'find') {
      if (typeof q.a !== 'number' || q.a < 0 || q.a >= t.body.length) err(`${tag}: אינדקס משפט מחוץ לטווח`);
    } else if (q.type === 'order') {
      if (!q.items || q.items.length < 3) err(`${tag}: פחות מ-3 פריטים לסידור`);
    } else if (q.type === 'factop') {
      if (!q.statements?.length) err(`${tag}: אין היגדים`);
      q.statements?.forEach((s, j) => { if (typeof s.fact !== 'boolean') err(`${tag}.s${j}: אין סימון עובדה/דעה`); });
    } else if (q.type === 'short') {
      if (!q.model) err(`${tag}: אין תשובה לדוגמה`);
    } else err(`${tag}: סוג שאלה לא מוכר "${q.type}"`);
  });
}

/* ---------- תוכנית הלימודים ---------- */

const allSetKeys = new Set([
  ...Object.keys(spelling.sets),
  ...Object.keys(vocab.sets),
  ...Object.keys(grammar.sets),
]);

const seenDays = new Set();
const usedSets = new Set();
const usedTexts = new Set();
for (const d of curriculum.days) {
  if (seenDays.has(d.d)) err(`curriculum: יום כפול ${d.d}`);
  seenDays.add(d.d);
  if (!d.stations?.length) err(`curriculum: יום ${d.d} בלי תחנות`);
  for (const st of d.stations) {
    for (const s of st.sets || []) {
      if (!allSetKeys.has(s)) err(`curriculum: יום ${d.d} מפנה לסט לא קיים "${s}"`);
      usedSets.add(s);
    }
    if (st.text) {
      if (!textIds.has(st.text)) err(`curriculum: יום ${d.d} מפנה לטקסט לא קיים "${st.text}"`);
      usedTexts.add(st.text);
    }
    for (const fd of st.fromDays || []) {
      if (!curriculum.days.some((x) => x.d === fd)) err(`curriculum: יום ${d.d} מפנה ליום ${fd} שלא קיים`);
    }
  }
}
if (curriculum.days.length !== 28) err(`curriculum: ${curriculum.days.length} ימים במקום 28`);
for (const s of allSetKeys) if (!usedSets.has(s)) warn(`הסט "${s}" לא מופיע באף יום`);
for (const t of textIds) if (!usedTexts.has(t)) warn(`הטקסט "${t}" לא מופיע באף יום`);

/* ---------- דוח ---------- */

console.log(`\nתוכן: ${spellCount} פריטי כתיב · ${vocabCount} מילים · ${grammarCount} פריטי דקדוק · ${texts.texts.length} טקסטים (${qCount} שאלות)\n`);
for (const w of warns) console.log('  ⚠️  ' + w);
if (warns.length) console.log('');
for (const e of errors) console.log('  ❌  ' + e);
console.log(errors.length ? `\n${errors.length} שגיאות\n` : '\n✅ הכול תקין\n');
process.exit(errors.length ? 1 : 0);
