// content.js — טוען את בנקי התוכן ומנרמל הכול לפריטים אחידים.
// כל פריט: {id, strand, skill, kind, ...}
// strand: vocab | grammar | spelling | reading   (מזין את הדשבורד ואת ה-SRS)

const NIKUD = /[֑-ׇ]/g;
export const stripNikud = (s) => (s || '').replace(NIKUD, '');

// תחיליות נפוצות. משמש לזיהוי מילת מילון שמופיעה בטקסט כ"הבעלות" או "מזוויות".
const PREFIX = 'הובלמכש';
export function wordForms(w) {
  const bare = stripNikud(w).replace(/[.,:;!?"'()״׳]/g, '');
  const out = [bare];
  if (bare.length > 3 && PREFIX.includes(bare[0])) out.push(bare.slice(1));
  if (bare.length > 4 && PREFIX.includes(bare[0]) && PREFIX.includes(bare[1])) out.push(bare.slice(2));
  return out;
}

const DATA = ['curriculum', 'vocab', 'grammar', 'spelling', 'texts'];

let banks = null;

export async function loadContent(base = 'data/') {
  if (banks) return banks;
  const loaded = await Promise.all(
    DATA.map((n) =>
      fetch(`${base}${n}.json`).then((r) => {
        if (!r.ok) throw new Error(`לא הצלחתי לטעון ${n}.json (${r.status})`);
        return r.json();
      })
    )
  );
  const raw = Object.fromEntries(DATA.map((n, i) => [n, loaded[i]]));

  banks = {
    curriculum: raw.curriculum,
    strands: raw.curriculum.strands,
    items: new Map(), // id -> item
    bySet: new Map(), // setKey -> item[]
    texts: new Map(), // textId -> text
    sets: new Map(), // setKey -> meta {title, skill, strand, tip, cats}
  };

  for (const [key, set] of Object.entries(raw.spelling.sets)) addSpellSet(key, set);
  for (const [key, set] of Object.entries(raw.vocab.sets)) addVocabSet(key, set);
  for (const [key, set] of Object.entries(raw.grammar.sets)) addGrammarSet(key, set);
  for (const t of raw.texts.texts) banks.texts.set(t.id, t);

  return banks;
}

export function content() {
  if (!banks) throw new Error('התוכן עוד לא נטען');
  return banks;
}

function register(setKey, item) {
  banks.items.set(item.id, item);
  if (!banks.bySet.has(setKey)) banks.bySet.set(setKey, []);
  banks.bySet.get(setKey).push(item);
}

/* ---------- כתיב ---------- */

// "{א|ע}וזן"  ->  {word:'אוזן', gaps:[{i:0,len:1,correct:'א',opts:['א','ע']}]}
// "מ{|י}ספר"  ->  correct = '' (אין אות שם)
export function parseTemplate(t) {
  let word = '';
  const gaps = [];
  let i = 0;
  while (i < t.length) {
    const open = t.indexOf('{', i);
    if (open === -1) {
      word += t.slice(i);
      break;
    }
    word += t.slice(i, open);
    const close = t.indexOf('}', open);
    if (close === -1) throw new Error(`תבנית שבורה: ${t}`);
    const opts = t.slice(open + 1, close).split('|');
    const correct = opts[0];
    gaps.push({ i: word.length, len: correct.length, correct, opts });
    word += correct;
    i = close + 1;
  }
  return { word, gaps };
}

function wrongFormsFor(word, gaps) {
  const out = [];
  for (const g of gaps) {
    for (const alt of g.opts) {
      if (alt === g.correct) continue;
      out.push({
        form: word.slice(0, g.i) + alt + word.slice(g.i + g.len),
        gap: g,
        alt,
      });
    }
  }
  return out;
}

function addSpellSet(key, set) {
  banks.sets.set(key, {
    key,
    title: set.title,
    skill: set.skill,
    strand: 'spelling',
    tip: set.tip,
  });
  const used = new Set();
  for (const row of set.items) {
    const [template, say, why] = Array.isArray(row) ? row : [row.t, row.say, row.why];
    const { word, gaps } = parseTemplate(template);
    // המזהה כולל את הסט: אותה מילה יכולה להתאמן על פער אחר ביום אחר, וזה מעקב נפרד
    let id = `sp_${key}_${word}`;
    while (used.has(id)) id += '_2';
    used.add(id);
    register(key, {
      id,
      kind: 'spell',
      strand: 'spelling',
      skill: set.skill,
      setKey: key,
      setTitle: set.title,
      tip: set.tip,
      template,
      word,
      say: say || word,
      why: why || null,
      gaps,
      wrongForms: wrongFormsFor(word, gaps),
    });
  }
}

/* ---------- אוצר מילים ---------- */

function addVocabSet(key, set) {
  banks.sets.set(key, {
    key,
    title: set.title,
    skill: set.skill,
    strand: 'vocab',
  });
  for (const w of set.words) {
    register(key, {
      ...w,
      kind: 'vocab',
      strand: 'vocab',
      skill: w.skill || set.skill,
      setKey: key,
      setTitle: set.title,
      say: w.say || w.w,
    });
  }
}

/* ---------- דקדוק ---------- */

function addGrammarSet(key, set) {
  banks.sets.set(key, {
    key,
    title: set.title,
    skill: set.skill,
    strand: 'grammar',
    tip: set.tip,
    cats: set.cats || null,
  });
  for (const it of set.items) {
    register(key, {
      ...it,
      kind: 'grammar',
      strand: 'grammar',
      skill: set.skill,
      setKey: key,
      setTitle: set.title,
      tip: set.tip,
      cats: set.cats || null,
    });
  }
}

/* ---------- שליפות ---------- */

export function itemsOfSets(setKeys) {
  const b = content();
  return setKeys.flatMap((k) => b.bySet.get(k) || []);
}

export function getItem(id) {
  return content().items.get(id) || null;
}

export function getText(id) {
  return content().texts.get(id) || null;
}

export function dayPlan(d) {
  return content().curriculum.days.find((x) => x.d === d) || null;
}

export function totalDays() {
  return content().curriculum.days.length;
}

// כל הפריטים שנלמדו בימים מסוימים — משמש לקרבות בוס
export function itemsOfDays(days) {
  const out = [];
  for (const d of days) {
    const plan = dayPlan(d);
    if (!plan) continue;
    for (const st of plan.stations) {
      if (st.sets) out.push(...itemsOfSets(st.sets));
    }
  }
  return [...new Map(out.map((i) => [i.id, i])).values()];
}
