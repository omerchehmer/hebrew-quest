// games/writing.js — יום 27: כתיבה עצמאית.
// רשימת בדיקה חיה + הקראה של מה שכתב (הדרך הכי טובה לתפוס משפט שבור).

import { el, clear, Shell, btn, toast, crystalBurst } from '../ui.js';
import { speak, stopSpeaking } from '../tts.js';
import { sfx } from '../sfx.js';

const CONNECTORS = ['כי', 'לכן', 'למרות', 'בגלל', 'כדי', 'אבל', 'בנוסף', 'כלומר', 'לדוגמה', 'אף על פי', 'לעומת זאת', 'בסופו של דבר'];

const TOPICS = [
  'יום שבו משהו לא הלך כמו שתכננתי',
  'המקום שהכי טוב לי בעולם',
  'משהו שהתאמנתי עליו עד שהצלחתי',
  'אם היה לי יום אחד בלי חוקים',
  'החבר הכי טוב שלי — ולמה דווקא הוא',
];

export function mountWriting(root, ctx) {
  const shell = new Shell(root, {
    total: 2,
    hearts: 3,
    subtitle: 'כתיבה — אין כאן טעויות, יש טיוטות',
    onQuit: () => { stopSpeaking(); ctx.quit?.(); },
  });
  shell.heartsEl.style.visibility = 'hidden';

  const startedAt = performance.now();
  let stage = 0;
  let score = 0;

  const bank = (ctx.pool || [])
    .filter((i) => i.kind === 'vocab' && (ctx.state.srs[i.id]?.box ?? 0) >= 1)
    .slice(0, 14);

  function task({ title, hint, minSentences, needBank, needConnector, onDone }) {
    const ta = el('textarea', { class: 'short-answer big', rows: 7, dir: 'rtl', placeholder: 'תתחיל לכתוב…' });
    const checks = el('ul', { class: 'checklist' });
    const bankRow = el(
      'div',
      { class: 'word-bank' },
      bank.map((w) =>
        el('button', {
          class: 'chip',
          type: 'button',
          text: w.w,
          onclick: () => {
            sfx.tap();
            insert(ta, w.w + ' ');
            update();
          },
        })
      )
    );

    const rules = [
      { id: 'len', label: `לפחות ${minSentences} משפטים`, test: (t) => sentences(t).length >= minSentences },
      needBank ? { id: 'bank', label: 'שתי מילים מבנק המילים', test: (t) => bank.filter((w) => t.includes(w.w)).length >= 2 } : null,
      needConnector ? { id: 'conn', label: 'מילת קישור אחת לפחות', test: (t) => CONNECTORS.some((c) => t.includes(c)) } : null,
      { id: 'end', label: 'כל משפט מסתיים בנקודה', test: (t) => t.trim().length > 20 && /[.!?]\s*$/.test(t.trim()) },
    ].filter(Boolean);

    function update() {
      const t = ta.value;
      clear(checks);
      let pass = 0;
      for (const r of rules) {
        const ok = r.test(t);
        if (ok) pass++;
        checks.append(el('li', { class: ok ? 'ok' : '', text: (ok ? '✓ ' : '○ ') + r.label }));
      }
      submit.disabled = pass < rules.length;
      counter.textContent = `${sentences(t).length} משפטים · ${t.trim().split(/\s+/).filter(Boolean).length} מילים`;
    }

    const counter = el('span', { class: 'counter' });
    const listen = el('button', {
      class: 'btn ghost',
      type: 'button',
      text: '🔊 הקשב למה שכתבת',
      onclick: () => {
        if (!ta.value.trim()) return toast('עוד לא כתבת כלום');
        speak(ta.value, { rate: 0.8 });
      },
    });
    const submit = el('button', { class: 'btn primary', type: 'button', text: 'סיימתי', disabled: true });

    submit.addEventListener('click', () => {
      ctx.state.writing.push({ day: ctx.state.day, kind: title, answer: ta.value.trim() });
      score++;
      crystalBurst(shell.body, 3);
      sfx.chest();
      onDone();
    });

    ta.addEventListener('input', update);

    clear(shell.body).append(
      el(
        'div',
        { class: 'game writing' },
        el('h2', { text: title }),
        el('p', { class: 'sub', html: hint }),
        ta,
        el('div', { class: 'row between' }, counter, listen),
        bank.length ? el('div', {}, el('p', { class: 'hint', text: 'בנק המילים שלך — הקש להוספה:' }), bankRow) : null,
        checks
      )
    );
    clear(shell.foot).append(submit);
    update();
  }

  function stage1() {
    const text = ctx.text;
    task({
      title: 'סכם את הטקסט',
      hint: text
        ? `סכם את «${text.title}» בשני משפטים משלך. לא להעתיק — לנסח מחדש.`
        : 'סכם בשני משפטים משהו שקראת השבוע.',
      minSentences: 2,
      needBank: false,
      needConnector: false,
      onDone: () => {
        shell.advance();
        stage = 1;
        stage2();
      },
    });
  }

  function stage2() {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    task({
      title: 'עכשיו פסקה משלך',
      hint: `הנושא: <b>${topic}</b><br>שלושה־ארבעה משפטים. השתמש בשתי מילים מבנק המילים ובמילת קישור אחת.`,
      minSentences: 3,
      needBank: bank.length >= 2,
      needConnector: true,
      onDone: () => {
        shell.advance();
        finish();
      },
    });
  }

  function finish() {
    ctx.onFinish?.({
      planned: 2,
      answered: 2,
      correct: score,
      accuracy: 1,
      ms: Math.round(performance.now() - startedAt),
    });
  }

  stage1();
  return { shell };
}

function sentences(t) {
  return (t || '')
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 2);
}

function insert(ta, str) {
  const s = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, s) + str + ta.value.slice(s);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = s + str.length;
}
