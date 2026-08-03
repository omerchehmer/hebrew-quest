// games/spell.js — תחנות הכתיב: חצוב את האות · בנה את המילה · שני מסלולים · כרייה מהירה.

import { el, clear, speakBtn, letterTile } from '../ui.js';
import { sfx } from '../sfx.js';
import { speak } from '../tts.js';
import { shuffle } from '../srs.js';
import { runQueue, prompt, modeForItem } from './common.js';

const HE_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');

function sayOf(item, state) {
  return state.settings.nikud ? item.say || item.word : item.word;
}

/* ---------- חצוב את האות ---------- */

export function renderMine(item, api, state) {
  const gap = item.gaps[Math.floor(Math.random() * item.gaps.length)];
  const opts = shuffle([...gap.opts]);
  const text = sayOf(item, state);
  speak(text);

  const before = item.word.slice(0, gap.i);
  const after = item.word.slice(gap.i + gap.len);

  const slot = el('button', { class: 'gap-block', type: 'button', text: '?' });
  slot.addEventListener('click', () => {
    sfx.mine();
    slot.classList.add('cracked');
  });

  const wordEl = el(
    'div',
    { class: 'word-display' },
    el('span', { text: before }),
    slot,
    el('span', { text: after })
  );

  const tiles = el('div', { class: 'tiles' });
  opts.forEach((o) => {
    const t = letterTile(o, {
      onclick: () => {
        sfx.mine();
        [...tiles.children].forEach((c) => (c.disabled = true));
        const ok = o === gap.correct;
        slot.textContent = o === '' ? '·' : o;
        slot.classList.add(ok ? 'ok' : 'no');
        if (!ok) setTimeout(() => { slot.textContent = gap.correct === '' ? '·' : gap.correct; slot.classList.add('fix'); }, 500);
        api.answer(ok, {
          answer: `<b class="big-word">${item.word}</b>`,
          why: ok ? item.why : item.why || item.tip,
          speakText: text,
        });
      },
    });
    tiles.append(t);
  });

  api.setBody(
    el(
      'div',
      { class: 'game mine' },
      prompt('איזו אות חסרה?', 'הקשב למילה ובחר את האות הנכונה'),
      el('div', { class: 'row center' }, speakBtn(() => text, { big: true, label: 'שמע שוב' })),
      wordEl,
      tiles
    )
  );
}

/* ---------- בנה את המילה (דיקטה) ---------- */

export function renderBuild(item, api, state, { flash = false } = {}) {
  const target = item.word;
  const chars = target.split('');
  const text = sayOf(item, state);

  const pool = shuffle([
    ...chars,
    ...distractors(item, 3),
  ]);

  const slots = el('div', { class: 'slots' });
  const built = [];
  const tiles = el('div', { class: 'tiles wrap' });
  const checkBtn = el('button', { class: 'btn primary', type: 'button', text: 'בדוק', disabled: true });

  function renderSlots() {
    clear(slots);
    for (let i = 0; i < chars.length; i++) {
      const ch = built[i];
      slots.append(
        el('button', {
          class: 'slot' + (ch ? ' filled' : ''),
          type: 'button',
          text: ch ? ch.ch : '',
          onclick: () => {
            if (!ch) return;
            sfx.tap();
            ch.tile.disabled = false;
            ch.tile.classList.remove('used');
            built.splice(i, 1);
            renderSlots();
          },
        })
      );
    }
    checkBtn.disabled = built.length !== chars.length;
  }

  pool.forEach((ch) => {
    const t = letterTile(ch, {
      onclick: () => {
        if (built.length >= chars.length) return;
        sfx.tap();
        built.push({ ch, tile: t });
        t.disabled = true;
        t.classList.add('used');
        renderSlots();
      },
    });
    tiles.append(t);
  });

  checkBtn.addEventListener('click', () => {
    const answer = built.map((b) => b.ch).join('');
    const ok = answer === target;
    api.answer(ok, {
      answer: ok ? null : `הכתיב הנכון: <b class="big-word">${target}</b>`,
      why: item.why || (ok ? null : item.tip),
      speakText: text,
    });
  });

  const head = flash
    ? prompt('מה ראית?', 'הרכב את המילה מהזיכרון')
    : prompt('הרכב את המילה', 'הקשב וכתוב אותה מהאותיות');

  const body = el(
    'div',
    { class: 'game build' },
    head,
    flash ? null : el('div', { class: 'row center' }, speakBtn(() => text, { big: true, label: 'שמע שוב' })),
    slots,
    tiles,
    el('div', { class: 'row center' }, checkBtn)
  );

  if (flash) {
    // הבזק: המילה נראית רגע, ואז נעלמת
    const flashEl = el('div', { class: 'flash-word' }, el('b', { text: target }));
    api.setBody(el('div', { class: 'game build' }, prompt('זכור את המילה', 'היא תיעלם עוד רגע'), flashEl));
    speak(text);
    setTimeout(() => {
      api.setBody(body);
      renderSlots();
    }, 900);
  } else {
    speak(text);
    api.setBody(body);
    renderSlots();
  }
}

function distractors(item, n) {
  const wanted = new Set();
  for (const g of item.gaps) for (const o of g.opts) if (o && o !== g.correct) wanted.add(o);
  const out = [...wanted].slice(0, n);
  while (out.length < n) {
    const c = HE_LETTERS[Math.floor(Math.random() * HE_LETTERS.length)];
    if (!item.word.includes(c)) out.push(c);
  }
  return out;
}

/* ---------- שני מסלולים ---------- */

export function renderTwoPaths(item, api, state) {
  const wrong = item.wrongForms[Math.floor(Math.random() * item.wrongForms.length)];
  const text = sayOf(item, state);
  speak(text);

  const pair = shuffle([
    { w: item.word, ok: true },
    { w: wrong.form, ok: false },
  ]);

  const row = el('div', { class: 'paths' });
  pair.forEach((p) => {
    const b = el('button', {
      class: 'path',
      type: 'button',
      text: p.w,
      onclick: () => {
        sfx.mine();
        [...row.children].forEach((c) => (c.disabled = true));
        b.classList.add(p.ok ? 'ok' : 'no');
        if (!p.ok) [...row.children].find((c) => c.textContent === item.word)?.classList.add('ok');
        api.answer(p.ok, { why: item.why || item.tip, speakText: text });
      },
    });
    row.append(b);
  });

  api.setBody(
    el(
      'div',
      { class: 'game two-paths' },
      prompt('איזה כתיב נכון?', 'שני מסלולים — רק אחד מוביל למכרה'),
      el('div', { class: 'row center' }, speakBtn(() => text, { big: true, label: 'שמע שוב' })),
      row
    )
  );
}

/* ---------- מנועי התחנות ---------- */

export function mountSpellMix(root, ctx) {
  return runQueue(root, ctx, {
    subtitle: ctx.subtitle,
    render: (item, api) => {
      const mode = modeForItem(ctx.state, item, ['mine', 'build', 'two']);
      if (mode === 'mine') renderMine(item, api, ctx.state);
      else if (mode === 'build') renderBuild(item, api, ctx.state);
      else renderTwoPaths(item, api, ctx.state);
    },
  });
}

export function mountTwoPaths(root, ctx) {
  return runQueue(root, ctx, {
    subtitle: ctx.subtitle,
    render: (item, api) => renderTwoPaths(item, api, ctx.state),
  });
}

export function mountFlash(root, ctx) {
  return runQueue(root, ctx, {
    subtitle: ctx.subtitle,
    render: (item, api) => renderBuild(item, api, ctx.state, { flash: true }),
  });
}

// לשימוש בחימום ובקרבות בוס — בדיקה מהירה
export function quickSpell(item, api, state) {
  renderTwoPaths(item, api, state);
}
