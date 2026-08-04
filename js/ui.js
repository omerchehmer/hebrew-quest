// ui.js — רכיבי ממשק משותפים לכל התחנות.

import { sfx } from './sfx.js';
import { speak } from './tts.js';

export function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

// התוכן משתמש ב-**הדגשה** בנוסח השאלות. המרה בטוחה: קודם בורחים מ-HTML, ואז מדגישים.
export function mdBold(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

export const clear = (n) => {
  while (n.firstChild) n.removeChild(n.firstChild);
  return n;
};

export const $ = (sel, root = document) => root.querySelector(sel);

// כפתור "תקריא לי" — מופיע בכל מקום שיש בו טקסט.
// player: לוגיקת הקראה מותאמת (למשל משפט עם מילה חסרה) — כשקיים, גובר על getText.
export function speakBtn(getText, { label = 'הקרא', big = false, player = null } = {}) {
  return el(
    'button',
    {
      class: 'speak-btn' + (big ? ' big' : ''),
      type: 'button',
      'aria-label': 'הקרא לי',
      onclick: (e) => {
        e.stopPropagation();
        sfx.tap();
        if (player) player();
        else speak(typeof getText === 'function' ? getText() : getText);
      },
    },
    el('span', { class: 'ico', text: '🔊' }),
    big ? el('span', { text: label }) : null
  );
}

/* ---------- מעטפת תחנה: פס התקדמות, לבבות, ניקוד ---------- */

export class Shell {
  constructor(root, { total, hearts = 3, title, subtitle, onQuit }) {
    this.total = total;
    this.done = 0;
    this.hearts = hearts;
    this.maxHearts = hearts;
    this.onQuit = onQuit;

    this.bar = el('i', { class: 'fill' });
    this.heartsEl = el('div', { class: 'hearts' });
    this.body = el('div', { class: 'station-body' });
    this.foot = el('div', { class: 'station-foot' });

    this.node = el(
      'div',
      { class: 'station' },
      el(
        'header',
        { class: 'station-head' },
        el('button', { class: 'quit', type: 'button', text: '✕', onclick: () => this.onQuit?.() }),
        el('div', { class: 'bar' }, this.bar),
        this.heartsEl
      ),
      subtitle ? el('p', { class: 'station-sub', text: subtitle }) : null,
      this.body,
      this.foot
    );
    clear(root).append(this.node);
    this.renderHearts();
    this.renderBar();
  }

  renderBar() {
    this.bar.style.width = `${Math.round((this.done / this.total) * 100)}%`;
  }

  renderHearts() {
    clear(this.heartsEl);
    for (let i = 0; i < this.maxHearts; i++) {
      this.heartsEl.append(el('span', { class: 'heart' + (i < this.hearts ? '' : ' off'), text: '♥' }));
    }
  }

  advance() {
    this.done++;
    this.renderBar();
  }

  loseHeart() {
    this.hearts = Math.max(0, this.hearts - 1);
    this.renderHearts();
    sfx.heartLost();
    this.heartsEl.classList.add('shake');
    setTimeout(() => this.heartsEl.classList.remove('shake'), 400);
    return this.hearts;
  }
}

/* ---------- משוב ---------- */

export function feedback(shell, { correct, title, why, answer, onNext, speakText }) {
  const panel = el(
    'div',
    { class: 'feedback ' + (correct ? 'ok' : 'no') },
    el(
      'div',
      { class: 'fb-head' },
      el('span', { class: 'fb-ico', text: correct ? '✓' : '✕' }),
      el('strong', { text: title || (correct ? 'נכון!' : 'לא בדיוק') }),
      speakText ? speakBtn(speakText) : null
    ),
    answer ? el('div', { class: 'fb-answer', html: answer }) : null,
    why ? el('p', { class: 'fb-why', html: why }) : null,
    el('button', {
      class: 'btn primary fb-next',
      type: 'button',
      text: correct ? 'המשך' : 'הבנתי',
      onclick: () => {
        panel.remove();
        onNext?.();
      },
    })
  );
  clear(shell.foot).append(panel);
  requestAnimationFrame(() => panel.classList.add('in'));

  // תשובה נכונה בלי הסבר — ממשיכים לבד, בלי לשבור את הקצב
  if (correct && !why) {
    setTimeout(() => {
      if (panel.isConnected) {
        panel.remove();
        onNext?.();
      }
    }, 800);
  }
  return panel;
}

export function crystalBurst(target, n = 1) {
  const r = target?.getBoundingClientRect?.();
  const host = document.body;
  for (let i = 0; i < Math.min(n, 8); i++) {
    const c = el('span', { class: 'crystal-fly', text: '💎' });
    c.style.left = `${(r ? r.left + r.width / 2 : innerWidth / 2) + (Math.random() * 40 - 20)}px`;
    c.style.top = `${r ? r.top : innerHeight / 2}px`;
    c.style.animationDelay = `${i * 60}ms`;
    host.append(c);
    setTimeout(() => c.remove(), 1200);
  }
  sfx.crystal();
}

/* ---------- אריחי אותיות ---------- */

export function letterTile(ch, opts = {}) {
  return el('button', {
    class: 'tile' + (opts.class ? ' ' + opts.class : ''),
    type: 'button',
    text: ch === '' ? '∅' : ch,
    dataset: { ch },
    onclick: opts.onclick,
  });
}

/* ---------- מקלדת עברית קומפקטית ---------- */

const KB_ROWS = [
  ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
  ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
  ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ'],
];

export function hebrewKeyboard({ onKey, onBackspace, onSpace, onEnter }) {
  const rows = KB_ROWS.map((r) =>
    el(
      'div',
      { class: 'kb-row' },
      r.map((ch) =>
        el('button', {
          class: 'kb-key',
          type: 'button',
          text: ch,
          onclick: () => {
            sfx.tap();
            onKey(ch);
          },
        })
      )
    )
  );
  const last = el(
    'div',
    { class: 'kb-row' },
    el('button', { class: 'kb-key wide', type: 'button', text: '⌫', onclick: () => { sfx.tap(); onBackspace(); } }),
    el('button', { class: 'kb-key space', type: 'button', text: 'רווח', onclick: () => { sfx.tap(); onSpace(); } }),
    el('button', { class: 'kb-key wide go', type: 'button', text: 'בדוק', onclick: () => onEnter() })
  );
  return el('div', { class: 'keyboard' }, rows, last);
}

/* ---------- שונות ---------- */

export function toast(msg, ms = 2200) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

export function modal(contentNode, { onClose, dismissable = true } = {}) {
  const box = el('div', { class: 'modal-box' }, contentNode);
  const back = el('div', {
    class: 'modal',
    onclick: (e) => {
      if (e.target === back && dismissable) close();
    },
  }, box);
  function close() {
    back.classList.remove('in');
    setTimeout(() => back.remove(), 220);
    onClose?.();
  }
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add('in'));
  return { close, node: back };
}

export function btn(text, onclick, cls = 'primary') {
  return el('button', { class: `btn ${cls}`, type: 'button', text, onclick });
}

export const fmtTime = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
