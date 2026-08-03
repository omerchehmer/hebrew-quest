// games/common.js — הלולאה המשותפת לכל התחנות.
// כל משחק מממש render(item, api) בלבד; התור, הלבבות, המשוב והסיום מטופלים כאן.

import { Shell, feedback, crystalBurst, el, clear } from '../ui.js';
import { sfx } from '../sfx.js';
import { speak } from '../tts.js';

export function runQueue(root, ctx, opts) {
  const {
    subtitle = '',
    hearts = 3,
    render,
    requeueWrong = true,
    onHeartsOut = null,
  } = opts;

  const queue = [...ctx.items];
  const planned = queue.length;
  const shell = new Shell(root, {
    total: planned,
    hearts,
    subtitle,
    onQuit: () => ctx.quit?.(),
  });

  let correct = 0;
  let answered = 0;
  const startedAt = performance.now();
  let itemStart = 0;
  let current = null;
  let locked = false;
  const requeued = new Set();

  const api = {
    shell,
    ctx,
    // המשחק קורא לזה כשהילד ענה
    answer(isCorrect, info = {}) {
      if (locked) return;
      locked = true;
      const ms = Math.round(performance.now() - itemStart);
      answered++;
      if (isCorrect) {
        correct++;
        sfx.correct();
        crystalBurst(api.body, 1);
      } else {
        sfx.wrong();
        shell.loseHeart();
      }
      ctx.onResult?.(current, isCorrect, ms);

      if (!isCorrect && requeueWrong && !requeued.has(current.id)) {
        requeued.add(current.id);
        queue.push(current); // הזדמנות שנייה בסוף התחנה
      }

      // אין "הפסדת" באפליקציה הזאת. הלבבות חוזרים והתרגול ממשיך מאותה נקודה.
      if (shell.hearts === 0) {
        feedback(shell, {
          correct: false,
          title: 'הלבבות חזרו — ממשיכים',
          why: info.why,
          answer: info.answer,
          onNext: () => (onHeartsOut ? onHeartsOut() : refillAndContinue()),
        });
        return;
      }

      feedback(shell, {
        correct: isCorrect,
        why: info.why,
        answer: info.answer,
        speakText: info.speakText,
        title: info.title,
        onNext: () => {
          shell.advance();
          locked = false;
          step();
        },
      });
    },
    // לתחנות שמנהלות בעצמן כמה תשובות בתוך פריט אחד (למשל סדר אירועים)
    setBody(node) {
      clear(api.body).append(node);
    },
    say(text) {
      speak(text);
    },
  };

  api.body = shell.body;

  function refillAndContinue() {
    shell.hearts = shell.maxHearts;
    shell.renderHearts();
    shell.advance();
    locked = false;
    step();
  }

  function step() {
    if (!queue.length) return finish();
    current = queue.shift();
    itemStart = performance.now();
    locked = false;
    clear(shell.foot);
    clear(api.body);
    render(current, api);
  }

  function finish() {
    const ms = Math.round(performance.now() - startedAt);
    ctx.onFinish?.({
      planned,
      answered,
      correct,
      accuracy: answered ? correct / answered : 0,
      ms,
    });
  }

  step();
  return { shell };
}

/* ---------- עזרי הצגה ---------- */

export function prompt(text, sub) {
  return el('div', { class: 'prompt' }, el('h2', { text }), sub ? el('p', { class: 'sub', html: sub }) : null);
}

export function optionList(options, onPick, { cls = '' } = {}) {
  const wrap = el('div', { class: 'options ' + cls });
  options.forEach((o, i) => {
    const b = el('button', {
      class: 'option',
      type: 'button',
      html: typeof o === 'string' ? o : o.html || o.text,
      onclick: () => {
        sfx.tap();
        [...wrap.children].forEach((c) => (c.disabled = true));
        b.classList.add('picked');
        onPick(i, b);
      },
    });
    wrap.append(b);
  });
  return wrap;
}

export function markOptions(wrap, correctIndex, pickedIndex) {
  [...wrap.children].forEach((c, i) => {
    if (i === correctIndex) c.classList.add('right');
    if (i === pickedIndex && i !== correctIndex) c.classList.add('wrong');
  });
}

// בוחר מצב תרגול לפי כמה הילד כבר מכיר את הפריט:
// חדש → תרגיל נתמך. מוכר → תרגיל הפקה. שולט → בדיקה מהירה.
export function modeForItem(state, item, modes) {
  const box = state.srs[item.id]?.box ?? 0;
  if (box === 0) return modes[0];
  if (box <= 2) return modes[1] || modes[0];
  return modes[2] || modes[1] || modes[0];
}
