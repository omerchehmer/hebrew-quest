// games/grammar.js — דקדוק: מיון · בחירת צורה · הטיה (הפקה) · בניית משפט · שורש.

import { el, clear, speakBtn, hebrewKeyboard, mdBold } from '../ui.js';
import { sfx } from '../sfx.js';
import { speak } from '../tts.js';
import { shuffle } from '../srs.js';
import { stripNikud } from '../content.js';
import { runQueue, prompt, optionList, markOptions } from './common.js';

const norm = (s) =>
  stripNikud(String(s || ''))
    .replace(/[.\-־"'׳״]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/* ---------- מיון לקטגוריות ---------- */

export function renderSort(item, api) {
  const cats = item.cats || [];
  speak(item.w);
  const row = el('div', { class: 'cats' });
  cats.forEach((c) => {
    const b = el('button', {
      class: 'cat',
      type: 'button',
      text: c,
      onclick: () => {
        sfx.tap();
        [...row.children].forEach((x) => (x.disabled = true));
        const ok = c === item.cat;
        b.classList.add(ok ? 'ok' : 'no');
        if (!ok) [...row.children].find((x) => x.textContent === item.cat)?.classList.add('ok');
        api.answer(ok, {
          answer: `<b>${item.w}</b> → ${item.cat}`,
          why: item.why || item.tip,
        });
      },
    });
    row.append(b);
  });

  api.setBody(
    el(
      'div',
      { class: 'game grammar' },
      prompt('לאיזו קבוצה שייכת המילה?', item.tip),
      el('div', { class: 'word-hero' }, el('b', { text: item.w }), speakBtn(() => item.w)),
      row
    )
  );
}

/* ---------- בחירת צורה נכונה ---------- */

export function renderChoose(item, api) {
  const q = el('p', { class: 'cloze', html: mdBold(item.q || '').replace('___', '______') });
  const list = optionList(item.opts, (i) => {
    markOptions(list, item.a, i);
    api.answer(i === item.a, {
      answer: item.q.includes('___') ? item.q.replace('___', `<b>${item.opts[item.a]}</b>`) : `נכון: <b>${item.opts[item.a]}</b>`,
      why: item.why,
      speakText: item.q.includes('___') ? item.q.replace('___', item.opts[item.a]) : null,
    });
  });

  api.setBody(el('div', { class: 'game grammar' }, prompt('בחר את הצורה הנכונה'), el('div', { class: 'card' }, q), list));
}

/* ---------- הטיה — הפקה עם מקלדת ---------- */

export function renderInflect(item, api) {
  let typed = '';
  const out = el('div', { class: 'typed', text: '' });
  const hint = el('p', { class: 'sub', text: item.instr });

  const check = () => {
    const ok = (item.a || []).some((a) => norm(a) === norm(typed));
    api.answer(ok, {
      answer: `התשובה: <b class="big-word">${item.a[0]}</b>`,
      why: item.why,
      speakText: item.a[0],
    });
  };

  const kb = hebrewKeyboard({
    onKey: (ch) => {
      typed += ch;
      out.textContent = typed;
    },
    onBackspace: () => {
      typed = typed.slice(0, -1);
      out.textContent = typed;
    },
    onSpace: () => {
      typed += ' ';
      out.textContent = typed;
    },
    onEnter: () => {
      if (!typed.trim()) return;
      sfx.tap();
      check();
    },
  });

  api.setBody(
    el(
      'div',
      { class: 'game grammar inflect' },
      prompt('הטה את המילה'),
      hint,
      el('div', { class: 'word-hero small' }, el('b', { text: item.q }), speakBtn(() => item.q)),
      el('div', { class: 'answer-line' }, out),
      kb
    )
  );
}

/* ---------- בניית משפט ---------- */

export function renderSentence(item, api) {
  const picked = [];
  const line = el('div', { class: 'sentence-line' });
  const bank = el('div', { class: 'tiles wrap' });
  const checkBtn = el('button', { class: 'btn primary', type: 'button', text: 'בדוק', disabled: true });

  const words = shuffle([...item.words]);

  function refresh() {
    clear(line);
    picked.forEach((p, i) => {
      line.append(
        el('button', {
          class: 'chip',
          type: 'button',
          text: p.w,
          onclick: () => {
            sfx.tap();
            p.node.disabled = false;
            p.node.classList.remove('used');
            picked.splice(i, 1);
            refresh();
          },
        })
      );
    });
    checkBtn.disabled = picked.length !== item.words.length;
  }

  words.forEach((w) => {
    const b = el('button', {
      class: 'chip',
      type: 'button',
      text: w,
      onclick: () => {
        sfx.tap();
        picked.push({ w, node: b });
        b.disabled = true;
        b.classList.add('used');
        refresh();
      },
    });
    bank.append(b);
  });

  checkBtn.addEventListener('click', () => {
    const answer = picked.map((p) => p.w).join(' ');
    const accepted = [item.a, ...(item.alts || [])].map(norm);
    const ok = accepted.includes(norm(answer));
    api.answer(ok, {
      answer: `<b>${item.a}</b>`,
      why: item.why,
      speakText: item.a,
    });
  });

  api.setBody(
    el(
      'div',
      { class: 'game grammar' },
      prompt('סדר את המילים למשפט תקין'),
      el('div', { class: 'card' }, line),
      bank,
      el('div', { class: 'row center' }, checkBtn)
    )
  );
}

/* ---------- שורש ומשפחת מילים ---------- */

export function renderRoot(item, api) {
  const all = shuffle([...item.family, item.impostor]);
  const grid = el('div', { class: 'options grid2' });
  all.forEach((w) => {
    const b = el('button', {
      class: 'option',
      type: 'button',
      text: w,
      onclick: () => {
        sfx.tap();
        [...grid.children].forEach((c) => (c.disabled = true));
        const ok = w === item.impostor;
        b.classList.add(ok ? 'right' : 'wrong');
        if (!ok) [...grid.children].find((c) => c.textContent === item.impostor)?.classList.add('right');
        api.answer(ok, {
          answer: `המתחזה: <b>${item.impostor}</b>`,
          why: item.why,
        });
      },
    });
    grid.append(b);
  });

  api.setBody(
    el(
      'div',
      { class: 'game grammar' },
      prompt('מי לא ממשפחת השורש?', `השורש: <b class="root">${item.root}</b>`),
      grid
    )
  );
}

/* ---------- מנוע התחנה ---------- */

export function renderGrammarItem(item, api) {
  switch (item.type) {
    case 'sort': return renderSort(item, api);
    case 'choose': return renderChoose(item, api);
    case 'inflect': return renderInflect(item, api);
    case 'sentence': return renderSentence(item, api);
    case 'root': return renderRoot(item, api);
    default: return renderChoose(item, api);
  }
}

export function mountGrammarMix(root, ctx) {
  return runQueue(root, ctx, {
    subtitle: ctx.subtitle,
    render: (item, api) => renderGrammarItem(item, api),
  });
}

// לחימום ולבוס: פריטי הטיה מוחלפים בבחירה מהירה כדי לא לשבור את הקצב
export function quickGrammar(item, api) {
  if (item.type === 'inflect' || item.type === 'sentence') {
    if (item.type === 'inflect') return renderInflect(item, api);
    return renderSentence(item, api);
  }
  return renderGrammarItem(item, api);
}
