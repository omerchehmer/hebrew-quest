// games/vocab.js — אוצר מילים: משמעות · השלמת משפט · שימוש נכון · נרדף/ניגוד.

import { el, speakBtn } from '../ui.js';
import { speak } from '../tts.js';
import { sfx } from '../sfx.js';
import { shuffle, pickDistractors } from '../srs.js';
import { runQueue, prompt, optionList, markOptions, modeForItem } from './common.js';

const clozeText = (item) => (item.cloze || '').replace('___', '______');

// מקריא את משפט ההשלמה בלי לגלות את המילה החסרה: חלק לפני, צליל ניטרלי, חלק אחרי.
// אחרת הקול היה בעצם פותר לילד את התרגיל לפני שהוא בחר.
function speakCloze(item) {
  const [before = '', after = ''] = (item.cloze || '').split('___');
  const b = before.trim();
  const a = after.trim();
  const playAfter = () => {
    if (a) speak(a);
  };
  if (b) {
    speak(b, { onEnd: () => { sfx.blank(); setTimeout(playAfter, 250); } });
  } else {
    sfx.blank();
    setTimeout(playAfter, 250);
  }
}

/* ---------- מילה → משמעות ---------- */

export function renderMeaning(item, api, state) {
  const opts = shuffle([
    { t: item.def, ok: true },
    ...(item.dis || []).map((d) => ({ t: d, ok: false })),
  ]);
  const correctIndex = opts.findIndex((o) => o.ok);
  speak(item.say || item.w);

  const list = optionList(
    opts.map((o) => o.t),
    (i, node) => {
      markOptions(list, correctIndex, i);
      api.answer(i === correctIndex, {
        answer: `<b class="big-word">${item.w}</b> — ${item.def}`,
        why: item.cloze ? `לדוגמה: ${item.cloze.replace('___', `<u>${item.w}</u>`)}` : null,
        speakText: item.say || item.w,
      });
    }
  );

  api.setBody(
    el(
      'div',
      { class: 'game vocab' },
      prompt('מה פירוש המילה?', item.pos ? `<span class="pos">${item.pos}</span>` : null),
      el('div', { class: 'word-hero' }, el('b', { text: item.w }), speakBtn(() => item.say || item.w)),
      list
    )
  );
}

/* ---------- השלם את המשפט ---------- */

export function renderCloze(item, api, state, pool) {
  if (!item.cloze) return renderMeaning(item, api, state);
  const others = pickDistractors(pool.filter((p) => p.kind === 'vocab'), item, 3, (x) => x.w);
  const opts = shuffle([item, ...others]);
  const correctIndex = opts.findIndex((o) => o.id === item.id);

  const sentence = el('p', { class: 'cloze', html: clozeText(item) });
  speakCloze(item);

  const list = optionList(
    opts.map((o) => o.w),
    (i) => {
      markOptions(list, correctIndex, i);
      const ok = i === correctIndex;
      if (ok) sentence.innerHTML = item.cloze.replace('___', `<u>${item.w}</u>`);
      api.answer(ok, {
        answer: item.cloze.replace('___', `<b>${item.w}</b>`),
        why: `<b>${item.w}</b> — ${item.def}`,
        speakText: item.cloze.replace('___', item.say || item.w),
      });
    }
  );

  api.setBody(
    el(
      'div',
      { class: 'game vocab' },
      prompt('איזו מילה מתאימה?'),
      el('div', { class: 'card' }, sentence, speakBtn(null, { player: () => speakCloze(item) })),
      list
    )
  );
}

/* ---------- שימוש נכון (ההבחנה הקשה) ---------- */

export function renderUsage(item, api, state, pool) {
  if (!item.ok || !item.bad || !item.bad.length) return renderCloze(item, api, state, pool);
  const opts = shuffle([
    { t: item.ok, ok: true },
    ...item.bad.slice(0, 2).map((b) => ({ t: b, ok: false })),
  ]);
  const correctIndex = opts.findIndex((o) => o.ok);

  const list = optionList(
    opts.map((o) => o.t),
    (i) => {
      markOptions(list, correctIndex, i);
      api.answer(i === correctIndex, {
        answer: `נכון: ${item.ok}`,
        why: `<b>${item.w}</b> — ${item.def}`,
        speakText: item.ok,
      });
    },
    { cls: 'tall' }
  );

  api.setBody(
    el(
      'div',
      { class: 'game vocab' },
      prompt('באיזה משפט המילה מתאימה?', `המילה: <b>${item.w}</b>`),
      el('div', { class: 'row center' }, speakBtn(() => item.say || item.w, { big: true, label: 'שמע את המילה' })),
      list
    )
  );
}

/* ---------- נרדף / ניגוד ---------- */

export function renderPair(item, api, state, pool) {
  const isAnt = !!(item.ant && item.ant.length) && (!item.syn || Math.random() < 0.5);
  const target = isAnt ? item.ant[0] : item.syn && item.syn[0];
  if (!target) return renderCloze(item, api, state, pool);

  const others = pickDistractors(pool.filter((p) => p.kind === 'vocab' && p.w !== item.w), item, 3, (x) => x.w).map(
    (x) => x.w
  );
  const opts = shuffle([target, ...others]);
  const correctIndex = opts.indexOf(target);

  const list = optionList(opts, (i) => {
    markOptions(list, correctIndex, i);
    api.answer(i === correctIndex, {
      answer: `${item.w} ${isAnt ? '↔' : '≈'} <b>${target}</b>`,
      why: `<b>${item.w}</b> — ${item.def}`,
    });
  });

  api.setBody(
    el(
      'div',
      { class: 'game vocab' },
      prompt(isAnt ? 'מה ההפך?' : 'איזו מילה קרובה במשמעות?'),
      el('div', { class: 'word-hero' }, el('b', { text: item.w }), speakBtn(() => item.say || item.w)),
      list
    )
  );
}

/* ---------- מנוע התחנה ---------- */

export function mountVocabMix(root, ctx) {
  const pool = ctx.pool || ctx.items;
  return runQueue(root, ctx, {
    subtitle: ctx.subtitle,
    render: (item, api) => {
      const mode = modeForItem(ctx.state, item, ['meaning', 'cloze', 'usage']);
      if (mode === 'meaning') renderMeaning(item, api, ctx.state);
      else if (mode === 'cloze') {
        // מדי פעם נרדף/ניגוד במקום השלמה — שובר שגרה ומרחיב את המילה
        if ((item.syn || item.ant) && Math.random() < 0.35) renderPair(item, api, ctx.state, pool);
        else renderCloze(item, api, ctx.state, pool);
      } else renderUsage(item, api, ctx.state, pool);
    },
  });
}

export function quickVocab(item, api, state, pool) {
  const box = state.srs[item.id]?.box ?? 0;
  if (box === 0) renderMeaning(item, api, state);
  else renderCloze(item, api, state, pool);
}
