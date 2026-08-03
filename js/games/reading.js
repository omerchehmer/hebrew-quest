// games/reading.js — תחנת הבנת הנקרא.
// שלב 1: קריאה (עם הקראה משפט-משפט וסימון מילים לא מוכרות).
// שלב 2: שאלות — והטקסט נשאר זמין. הבנת הנקרא היא לא מבחן זיכרון.

import { el, clear, Shell, feedback, speakBtn, btn, toast, crystalBurst, mdBold } from '../ui.js';
import { sfx } from '../sfx.js';
import { speak, speakSequence, stopSpeaking } from '../tts.js';
import { shuffle } from '../srs.js';
import { wordForms } from '../content.js';

export function mountReading(root, ctx) {
  const text = ctx.text;
  const qs = text.qs || [];
  const shell = new Shell(root, {
    total: qs.length + 1,
    hearts: 3,
    subtitle: text.focusTitle,
    onQuit: () => {
      stopSpeaking();
      ctx.quit?.();
    },
  });

  let correct = 0;
  let answered = 0;
  const startedAt = performance.now();
  let qi = 0;
  let stopSeq = null;
  let markMode = false;
  const unknown = new Set();

  const glossary = new Map((text.glossary || []).map((g) => [g.w, g.def]));

  /* ---------- שלב הקריאה ---------- */

  function buildText({ compact = false, onSentenceClick = null } = {}) {
    const wrap = el('div', { class: 'reading-text' + (compact ? ' compact' : '') });
    text.body.forEach((s, i) => {
      const sentence = el('p', { class: 'r-sentence', dataset: { i } });
      // מילים בנפרד — מאפשר סימון מילה לא מוכרת
      s.split(' ').forEach((w, wi) => {
        const forms = wordForms(w);
        const bare = forms[0];
        // מילת מילון עשויה להופיע עם תחילית: "הבעלות", "מזוויות"
        const key = forms.find((f) => glossary.has(f));
        const isGloss = !!key;
        const span = el('span', {
          class: 'r-word' + (isGloss ? ' gloss' : ''),
          text: w,
          onclick: (e) => {
            e.stopPropagation();
            if (markMode) {
              span.classList.toggle('unknown');
              if (unknown.has(bare)) unknown.delete(bare);
              else unknown.add(bare);
              sfx.tap();
              return;
            }
            if (isGloss) {
              toast(`${key} — ${glossary.get(key)}`, 3200);
            }
            speak(bare);
          },
        });
        sentence.append(span, ' ');
      });
      if (onSentenceClick) {
        sentence.classList.add('clickable');
        sentence.addEventListener('click', () => onSentenceClick(i, sentence, wrap));
      } else {
        sentence.addEventListener('click', () => speak(s));
      }
      wrap.append(sentence);
    });
    return wrap;
  }

  function readingPhase() {
    const textEl = buildText();
    const markBtn = el('button', {
      class: 'btn ghost',
      type: 'button',
      text: '🖍️ סמן מילים שלא הבנת',
      onclick: () => {
        markMode = !markMode;
        markBtn.classList.toggle('on', markMode);
        markBtn.textContent = markMode ? '✔ סיימתי לסמן' : '🖍️ סמן מילים שלא הבנת';
        toast(markMode ? 'הקש על כל מילה שלא הבנת' : 'הקש על מילה כדי לשמוע אותה');
      },
    });

    const readAll = el('button', {
      class: 'btn ghost',
      type: 'button',
      text: '🔊 הקרא לי הכול',
      onclick: () => {
        if (stopSeq) {
          stopSeq();
          stopSeq = null;
          readAll.textContent = '🔊 הקרא לי הכול';
          textEl.querySelectorAll('.r-sentence').forEach((p) => p.classList.remove('speaking'));
          return;
        }
        readAll.textContent = '⏸ עצור';
        stopSeq = speakSequence(text.body, {
          onSentence: (i) => {
            textEl.querySelectorAll('.r-sentence').forEach((p) => p.classList.remove('speaking'));
            textEl.querySelector(`.r-sentence[data-i="${i}"]`)?.classList.add('speaking');
          },
          onDone: () => {
            stopSeq = null;
            readAll.textContent = '🔊 הקרא לי הכול';
            textEl.querySelectorAll('.r-sentence').forEach((p) => p.classList.remove('speaking'));
          },
        });
      },
    });

    clear(shell.body).append(
      el(
        'div',
        { class: 'game reading' },
        el('h2', { class: 'r-title', text: text.title }),
        el('div', { class: 'row gap' }, readAll, markBtn),
        textEl,
        el('p', { class: 'hint', text: 'הקש על משפט כדי לשמוע אותו, או על מילה בודדת.' })
      )
    );
    clear(shell.foot).append(
      btn('קראתי — לשאלות', () => {
        if (stopSeq) stopSeq();
        stopSeq = null;
        harvestUnknown();
        shell.advance();
        nextQuestion();
      })
    );
  }

  // מילים שסימן כלא-מוכרות נכנסות לרשימת ההורה ולתור אוצר המילים
  function harvestUnknown() {
    if (!unknown.size) return;
    for (const w of unknown) {
      if (!ctx.state.glossary.some((g) => g.w === w)) {
        ctx.state.glossary.push({ w, textId: text.id, def: glossary.get(w) || null, day: ctx.state.day });
      }
    }
    toast(`${unknown.size} מילים נוספו לרשימה שלך`);
  }

  /* ---------- שלב השאלות ---------- */

  function questionShell(q, bodyNode, { showText = true } = {}) {
    const toggle = el('details', { class: 'text-toggle' }, el('summary', { text: '📖 הצג את הטקסט' }), buildText({ compact: true }));
    clear(shell.body).append(
      el(
        'div',
        { class: 'game reading q' },
        el('div', { class: 'qhead' }, el('span', { class: 'qnum', text: `שאלה ${qi + 1}/${qs.length}` }), el('span', { class: 'qtype', text: text.title })),
        el('p', { class: 'q-text', html: mdBold(q.q) }),
        bodyNode,
        showText ? toggle : null
      )
    );
    clear(shell.foot);
  }

  function done(ok, info) {
    answered++;
    if (ok) {
      correct++;
      sfx.correct();
      crystalBurst(shell.body, 1);
    } else {
      sfx.wrong();
      shell.loseHeart();
    }
    ctx.onResult?.(
      { id: `${text.id}:q${qi}`, strand: 'reading', skill: text.focus, kind: 'reading' },
      ok,
      0
    );
    feedback(shell, {
      correct: ok,
      ...info,
      onNext: () => {
        qi++;
        shell.advance();
        nextQuestion();
      },
    });
  }

  function nextQuestion() {
    if (qi >= qs.length) return finish();
    const q = qs[qi];
    if (q.type === 'mc') return qMulti(q);
    if (q.type === 'find') return qFind(q);
    if (q.type === 'order') return qOrder(q);
    if (q.type === 'factop') return qFactOp(q);
    if (q.type === 'short') return qShort(q);
    return qMulti(q);
  }

  function qMulti(q) {
    const wrap = el('div', { class: 'options' });
    q.opts.forEach((o, i) => {
      const b = el('button', {
        class: 'option',
        type: 'button',
        text: o,
        onclick: () => {
          sfx.tap();
          [...wrap.children].forEach((c) => (c.disabled = true));
          [...wrap.children][q.a].classList.add('right');
          if (i !== q.a) b.classList.add('wrong');
          done(i === q.a, { answer: `התשובה: <b>${q.opts[q.a]}</b>`, why: q.why });
        },
      });
      wrap.append(b);
    });
    questionShell(q, wrap);
  }

  function qFind(q) {
    const node = buildText({
      onSentenceClick: (i, sentence, wrap) => {
        wrap.querySelectorAll('.r-sentence').forEach((p) => (p.style.pointerEvents = 'none'));
        const ok = i === q.a;
        sentence.classList.add(ok ? 'found-ok' : 'found-no');
        if (!ok) wrap.querySelector(`.r-sentence[data-i="${q.a}"]`)?.classList.add('found-ok');
        speak(text.body[q.a]);
        done(ok, { answer: `«${text.body[q.a]}»`, why: q.why });
      },
    });
    node.classList.add('pickable');
    questionShell(q, el('div', {}, el('p', { class: 'hint', text: 'הקש על המשפט הנכון בתוך הטקסט' }), node), { showText: false });
  }

  function qOrder(q) {
    const target = q.items;
    const picked = [];
    const line = el('ol', { class: 'order-line' });
    const bank = el('div', { class: 'order-bank' });
    const check = el('button', { class: 'btn primary', type: 'button', text: 'בדוק', disabled: true });

    function refresh() {
      clear(line);
      picked.forEach((p, i) => {
        line.append(
          el('li', {}, el('button', {
            class: 'chip long',
            type: 'button',
            text: p.t,
            onclick: () => {
              sfx.tap();
              p.node.disabled = false;
              p.node.classList.remove('used');
              picked.splice(i, 1);
              refresh();
            },
          }))
        );
      });
      check.disabled = picked.length !== target.length;
    }

    shuffle([...target]).forEach((t) => {
      const b = el('button', {
        class: 'chip long',
        type: 'button',
        text: t,
        onclick: () => {
          sfx.tap();
          picked.push({ t, node: b });
          b.disabled = true;
          b.classList.add('used');
          refresh();
        },
      });
      bank.append(b);
    });

    check.addEventListener('click', () => {
      const ok = picked.every((p, i) => p.t === target[i]);
      done(ok, {
        answer: target.map((t, i) => `${i + 1}. ${t}`).join('<br>'),
        why: q.why,
      });
    });

    questionShell(q, el('div', {}, line, bank, el('div', { class: 'row center' }, check)));
    refresh();
  }

  function qFactOp(q) {
    const answers = new Array(q.statements.length).fill(null);
    const list = el('div', { class: 'factop' });
    const check = el('button', { class: 'btn primary', type: 'button', text: 'בדוק', disabled: true });

    q.statements.forEach((st, i) => {
      const row = el('div', { class: 'fo-row' }, el('p', { class: 'fo-text', text: st.s }));
      const bf = el('button', { class: 'fo-btn', type: 'button', text: 'עובדה' });
      const bo = el('button', { class: 'fo-btn', type: 'button', text: 'דעה' });
      const pick = (val, node) => {
        sfx.tap();
        answers[i] = val;
        bf.classList.toggle('sel', val === true);
        bo.classList.toggle('sel', val === false);
        check.disabled = answers.some((a) => a === null);
      };
      bf.addEventListener('click', () => pick(true, bf));
      bo.addEventListener('click', () => pick(false, bo));
      row.append(el('div', { class: 'fo-btns' }, bf, bo));
      list.append(row);
    });

    check.addEventListener('click', () => {
      const ok = q.statements.every((st, i) => st.fact === answers[i]);
      [...list.children].forEach((row, i) => row.classList.add(q.statements[i].fact === answers[i] ? 'ok' : 'no'));
      done(ok, {
        answer: q.statements.map((s) => `${s.fact ? '📊 עובדה' : '💭 דעה'} — ${s.s}`).join('<br>'),
        why: q.why,
      });
    });

    questionShell(q, el('div', {}, list, el('div', { class: 'row center' }, check)));
  }

  function qShort(q) {
    const ta = el('textarea', { class: 'short-answer', rows: 4, placeholder: 'כתוב כאן…', dir: 'rtl' });
    const hints = el('div', { class: 'hints' }, (q.hints || []).map((h) => el('span', { class: 'hint-chip', text: '💡 ' + h })));
    const reveal = el('button', {
      class: 'btn primary',
      type: 'button',
      text: 'סיימתי — הצג תשובה לדוגמה',
      onclick: () => {
        const written = ta.value.trim();
        ctx.state.writing.push({ day: ctx.state.day, textId: text.id, q: q.q, answer: written });
        clear(shell.foot).append(
          el(
            'div',
            { class: 'feedback ok in' },
            el('div', { class: 'fb-head' }, el('strong', { text: 'תשובה לדוגמה' })),
            el('p', { class: 'fb-why', text: q.model }),
            el('p', { class: 'fb-why', text: 'האם התשובה שלך אמרה בערך את אותו דבר?' }),
            el(
              'div',
              { class: 'row gap' },
              btn('כן, קלעתי', () => selfRate(true), 'primary'),
              btn('לא בדיוק', () => selfRate(false), 'ghost')
            )
          )
        );
      },
    });

    function selfRate(ok) {
      done(ok, { title: ok ? 'יפה' : 'בפעם הבאה נקלע', why: q.model });
    }

    questionShell(q, el('div', {}, hints, ta));
    clear(shell.foot).append(reveal);
  }

  function finish() {
    stopSpeaking();
    ctx.onFinish?.({
      planned: qs.length,
      answered,
      correct,
      accuracy: answered ? correct / answered : 0,
      ms: Math.round(performance.now() - startedAt),
    });
  }

  readingPhase();
  return { shell };
}
