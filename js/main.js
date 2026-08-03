// main.js — מסך הבית, מנוע היום, ניתוב תחנות ותגמולים.

import { loadContent, content, itemsOfSets, itemsOfDays, getText, dayPlan, totalDays } from './content.js';
import { load, save, freshState, todayISO, daysBetween, exportState, importState } from './storage.js';
import { buildQueue, warmupQueue, record, masteryReport } from './srs.js';
import { initTTS, warmup as warmTTS, hasHebrewVoice, stopSpeaking } from './tts.js';
import { sfx, unlockAudio, setSfxEnabled } from './sfx.js';
import { el, clear, btn, modal, toast, crystalBurst, fmtTime, $ } from './ui.js';
import { mountSpellMix, mountTwoPaths, mountFlash } from './games/spell.js';
import { mountVocabMix } from './games/vocab.js';
import { mountGrammarMix } from './games/grammar.js';
import { mountReading } from './games/reading.js';
import { mountWriting } from './games/writing.js';
import { mountMixed } from './games/mixed.js';
import { mountBoss } from './games/boss.js';
import { mountWorld, renderGrid, SKINS } from './world.js';
import { queuePush, trySync } from './sync.js';

const XP_PER_CORRECT = 10;
const CRYSTALS_PER_CORRECT = 2;
const STATIONS_TO_COMPLETE = 2;

let state = load();
let app;

/* ---------- אתחול ---------- */

async function init() {
  app = document.getElementById('app');
  app.innerHTML = '<div class="boot">טוען את המכרה…</div>';
  try {
    await loadContent();
  } catch (e) {
    app.innerHTML = `<div class="boot err">${e.message}<br><small>אם פתחת את הקובץ ישירות מהדיסק — צריך להריץ שרת מקומי.</small></div>`;
    return;
  }
  setSfxEnabled(state.settings.sfx);
  applyFontScale();
  initTTS();
  if (!state.name) renderOnboarding();
  else renderHome();
  trySync(state);
}

function persist() {
  save(state);
  queuePush(state);
}

function applyFontScale() {
  document.documentElement.style.setProperty('--font-scale', state.settings.fontScale);
}

const allItems = () => [...content().items.values()];

/* ---------- כניסה ראשונה ---------- */

function renderOnboarding() {
  const input = el('input', { class: 'name-input', type: 'text', placeholder: 'איך קוראים לך?', dir: 'rtl', maxlength: 14 });
  const go = btn('בוא נתחיל', () => {
    // המחווה הראשונה — כאן פותחים את הקול ואת האודיו של iOS
    warmTTS();
    unlockAudio();
    state.name = (input.value || 'כורה').trim().slice(0, 14);
    persist();
    setTimeout(() => {
      if (!hasHebrewVoice()) {
        toast('לא נמצא קול עברית במכשיר — התרגילים יעבדו במצב הצגה במקום הקראה', 4000);
      }
      renderHome();
    }, 150);
  });

  clear(app).append(
    el(
      'div',
      { class: 'screen onboard' },
      el('div', { class: 'logo-big', text: '⛏️' }),
      el('h1', { text: 'מכרה המילים' }),
      el('p', { class: 'sub', text: '28 ימים · כל יום 2–3 תחנות של עשר דקות' }),
      input,
      go
    )
  );
}

/* ---------- מסך הבית ---------- */

function level() {
  return Math.floor(state.xp / 250) + 1;
}

function renderHome() {
  stopSpeaking();
  const days = content().curriculum.days;
  const doneCount = Object.keys(state.completedDays).length;
  const today = dayPlan(state.day) || days[days.length - 1];
  const finishedAll = doneCount >= totalDays();

  const header = el(
    'header',
    { class: 'home-head' },
    el(
      'div',
      { class: 'hh-left' },
      el('button', {
        class: 'logo',
        type: 'button',
        text: '⛏️',
        onpointerdown: startParentHold,
        onpointerup: cancelParentHold,
        onpointerleave: cancelParentHold,
      }),
      el('div', {}, el('b', { text: state.name }), el('small', { text: `רמה ${level()}` }))
    ),
    el(
      'div',
      { class: 'hh-right' },
      el('span', { class: 'pill', text: `🔥 ${state.streak.count}` }),
      el('span', { class: 'pill', text: `💎 ${state.crystals}` })
    )
  );

  const todayCard = finishedAll
    ? el(
        'div',
        { class: 'today-card done' },
        el('h2', { text: 'סיימת את כל 28 הימים 🏆' }),
        el('p', { text: 'אפשר לחזור על כל יום, או להמשיך לבנות בבסיס.' }),
        btn('חזרה חופשית', () => startFreeReview())
      )
    : el(
        'div',
        { class: 'today-card' },
        el('span', { class: 'day-tag', text: `יום ${today.d} מתוך 28` }),
        el('h2', { text: today.title }),
        el('p', { class: 'goal', text: today.goal || '' }),
        el(
          'div',
          { class: 'strand-row' },
          strandChip(today.strand),
          el('span', { class: 'mins', text: '≈ 20 דקות' })
        ),
        btn(state.dayState?.d === today.d ? 'המשך את היום' : 'התחל', () => startDay(today.d))
      );

  const map = el(
    'div',
    { class: 'daymap' },
    days.map((d) => {
      const done = !!state.completedDays[d.d];
      const cur = d.d === state.day;
      const locked = d.d > state.day;
      return el(
        'button',
        {
          class: 'daydot' + (done ? ' done' : '') + (cur ? ' cur' : '') + (locked ? ' locked' : ''),
          type: 'button',
          disabled: locked,
          title: d.title,
          onclick: () => startDay(d.d),
        },
        el('b', { text: d.d }),
        d.strand === 'boss' ? el('i', { text: '🗿' }) : el('i', { text: content().strands[d.strand]?.icon || '•' })
      );
    })
  );

  clear(app).append(
    el(
      'div',
      { class: 'screen home' },
      header,
      todayCard,
      el('div', { class: 'section-title', text: 'המסע' }),
      map,
      el(
        'div',
        { class: 'home-actions' },
        el('button', { class: 'tile-btn', type: 'button', onclick: openWorld }, el('span', { text: '🏰' }), el('b', { text: 'הבסיס שלי' })),
        el('button', { class: 'tile-btn', type: 'button', onclick: openStats }, el('span', { text: '📊' }), el('b', { text: 'ההתקדמות שלי' })),
        el('button', { class: 'tile-btn', type: 'button', onclick: openSettings }, el('span', { text: '⚙️' }), el('b', { text: 'הגדרות' }))
      ),
      el('div', { class: 'mini-world' }, renderGrid(state))
    )
  );
}

function strandChip(strand) {
  const s = content().strands[strand];
  if (!s) return el('span', { class: 'chip strand', text: 'קרב בוס' });
  return el('span', { class: 'chip strand', style: { '--c': s.color } }, `${s.icon} ${s.title}`);
}

/* ---------- מנוע היום ---------- */

function startDay(d) {
  const plan = dayPlan(d);
  if (!plan) return;
  if (!state.dayState || state.dayState.d !== d) {
    state.dayState = { d, done: [], startedAt: Date.now(), correct: 0, total: 0 };
  }
  persist();
  runNextStation();
}

function runNextStation() {
  const ds = state.dayState;
  const plan = dayPlan(ds.d);
  const idx = ds.done.length;
  if (idx >= plan.stations.length) return finishDay();

  const st = plan.stations[idx];
  const ctx = buildStationContext(plan, st, idx);
  if (!ctx) {
    // תחנה שאין בה מה להריץ (למשל חימום ביום הראשון) — מדלגים בשקט
    ds.done.push({ g: st.g, skipped: true });
    return runNextStation();
  }
  mountStation(st, ctx);
}

function buildStationContext(plan, st, idx) {
  const base = {
    state,
    day: plan.d,
    stationIndex: idx,
    subtitle: `${plan.title} · תחנה ${idx + 1}/${plan.stations.length}`,
    onResult: (item, correct, ms) => {
      if (!item) return;
      record(state, item, correct, ms);
      state.dayState.total++;
      if (correct) {
        state.dayState.correct++;
        state.xp += XP_PER_CORRECT;
        state.crystals += CRYSTALS_PER_CORRECT;
      }
      save(state);
    },
    onFinish: (summary) => onStationDone(st, summary),
    onChange: () => persist(),
    quit: () => {
      stopSpeaking();
      persist();
      renderHome();
    },
  };

  switch (st.g) {
    case 'warmup': {
      const items = warmupQueue(state, allItems(), 8);
      if (items.length < 4) return null;
      return { ...base, items, pool: allItems(), subtitle: 'חימום — חזרה על מה שכבר עשית' };
    }
    case 'vocab-mix':
    case 'grammar-mix':
    case 'spell-mix':
    case 'spell-two-paths':
    case 'spell-flash': {
      const pool = itemsOfSets(st.sets);
      if (!pool.length) return null;
      const items = buildQueue(state, pool, Math.min(st.n || 12, pool.length));
      return { ...base, items, pool };
    }
    case 'reading': {
      const text = getText(st.text);
      if (!text) return null;
      return { ...base, text };
    }
    case 'writing':
      return { ...base, text: getText(st.text), pool: allItems() };
    case 'boss': {
      const pool = itemsOfDays(st.fromDays);
      if (!pool.length) return null;
      const items = buildQueue(state, pool, Math.min(st.n || 20, pool.length), { newRatio: 0.15 });
      return { ...base, items, pool, final: !!st.final };
    }
    case 'world':
      return { ...base };
    default:
      return null;
  }
}

function mountStation(st, ctx) {
  clear(app);
  const root = el('div', { class: 'screen station-screen' });
  app.append(root);
  switch (st.g) {
    case 'warmup': return mountMixed(root, ctx);
    case 'vocab-mix': return mountVocabMix(root, ctx);
    case 'grammar-mix': return mountGrammarMix(root, ctx);
    case 'spell-mix': return mountSpellMix(root, ctx);
    case 'spell-two-paths': return mountTwoPaths(root, ctx);
    case 'spell-flash': return mountFlash(root, ctx);
    case 'reading': return mountReading(root, ctx);
    case 'writing': return mountWriting(root, ctx);
    case 'boss': return mountBoss(root, ctx);
    case 'world': return mountWorld(root, ctx);
  }
}

function onStationDone(st, summary) {
  const ds = state.dayState;
  ds.done.push({ g: st.g, ...summary });
  state.log.push({
    ts: Date.now(),
    day: ds.d,
    station: st.g,
    correct: summary.correct,
    total: summary.answered,
    ms: summary.ms,
  });
  persist();
  renderStationSummary(st, summary);
}

// כמה תחנות "אמיתיות" נדרשות היום וכמה כבר נעשו.
// תחנת חימום שדולגה ותחנת בנייה אינן נספרות — אחרת יום בוס (בוס + עולם) לא היה נסגר לעולם.
function stationTally(plan, ds) {
  const done = ds.done.filter((d) => !d.skipped && d.g !== 'world').length;
  const skipped = ds.done.filter((d) => d.skipped).length;
  const total = plan.stations.filter((s) => s.g !== 'world').length - skipped;
  return { done, total, need: Math.min(STATIONS_TO_COMPLETE, Math.max(1, total)) };
}

function renderStationSummary(st, summary) {
  const plan = dayPlan(state.dayState.d);
  const doneCount = state.dayState.done.length;
  const isLast = doneCount >= plan.stations.length;
  const enough = stationTally(plan, state.dayState).done >= stationTally(plan, state.dayState).need;
  const pct = Math.round((summary.accuracy || 0) * 100);
  const gained = summary.correct * CRYSTALS_PER_CORRECT;

  sfx.chest();

  const actions = el('div', { class: 'row gap center' });
  if (!isLast) {
    const next = plan.stations[doneCount];
    actions.append(
      btn(enough ? 'תחנת בונוס' : 'לתחנה הבאה', () => runNextStation()),
      enough ? btn('מספיק להיום', () => finishDay(), 'ghost') : null
    );
  } else {
    actions.append(btn('סיים את היום', () => finishDay()));
  }

  clear(app).append(
    el(
      'div',
      { class: 'screen summary' },
      el('div', { class: 'chest', text: '🎁' }),
      el('h2', { text: summary.noScore ? 'יפה!' : `${pct}% נכון` }),
      summary.noScore ? null : el('p', { class: 'sub', text: `${summary.correct} מתוך ${summary.answered} · ${fmtTime(summary.ms)}` }),
      el('div', { class: 'reward-row' }, el('span', { text: `💎 +${gained}` }), el('span', { text: `⭐ +${summary.correct * XP_PER_CORRECT}` })),
      actions
    )
  );
  crystalBurst($('.chest'), 5);
}

function finishDay() {
  const ds = state.dayState;
  if (!ds) return renderHome();
  const plan = dayPlan(ds.d);
  const tally = stationTally(plan, ds);
  const realStations = tally.done;

  if (realStations < tally.need && !state.completedDays[ds.d]) {
    // לא מספיק תחנות — שומרים התקדמות אבל היום לא נסגר
    persist();
    toast('היום נשמר. צריך שתי תחנות כדי לסגור אותו');
    return renderHome();
  }

  const already = !!state.completedDays[ds.d];
  state.completedDays[ds.d] = {
    date: todayISO(),
    stations: realStations,
    correct: ds.correct,
    total: ds.total,
    ms: Date.now() - ds.startedAt,
  };

  if (!already) {
    updateStreak();
    if (ds.d === state.day && state.day < totalDays()) state.day++;
  }
  state.dayState = null;
  persist();
  trySync(state);

  const reward = plan.reward;
  if (reward && !state.world.unlocked.includes(reward.id)) {
    state.world.unlocked.push(reward.id);
    persist();
    return renderReward(plan, reward);
  }
  renderDayDone(plan);
}

function updateStreak() {
  const t = todayISO();
  const last = state.streak.last;
  if (last === t) return;
  const gap = last ? daysBetween(last, t) : 999;
  if (gap === 1) state.streak.count++;
  else if (gap > 1 && state.streak.shields > 0 && gap === 2) {
    state.streak.shields--;
    state.streak.count++;
    toast('מגן הרצף הופעל — הרצף נשמר 🛡️');
  } else state.streak.count = 1;
  state.streak.last = t;
  if (state.streak.count % 7 === 0) {
    state.streak.shields++;
    toast('קיבלת מגן רצף 🛡️');
  }
}

function renderDayDone(plan) {
  sfx.levelup();
  clear(app).append(
    el(
      'div',
      { class: 'screen summary big' },
      el('div', { class: 'chest', text: '🏅' }),
      el('h2', { text: `יום ${plan.d} הושלם` }),
      el('p', { class: 'sub', text: `רצף: ${state.streak.count} ימים · 💎 ${state.crystals}` }),
      btn('לבנות בבסיס', () => openWorld()),
      btn('חזרה למפה', () => renderHome(), 'ghost')
    )
  );
}

function renderReward(plan, reward) {
  sfx.levelup();
  const skin = SKINS[reward.id];
  clear(app).append(
    el(
      'div',
      { class: 'screen summary big reward' },
      el('div', { class: 'chest big-emoji', text: skin?.emoji || '🎁' }),
      el('h2', { text: 'פתחת פריט חדש!' }),
      el('p', { class: 'sub', text: reward.name }),
      reward.certificate ? el('p', { class: 'cert', text: `סיימת את כל 28 הימים, ${state.name}. זו לא מתנה — זה משהו שעבדת עליו חודש.` }) : null,
      btn('מגניב', () => renderDayDone(plan))
    )
  );
}

function startFreeReview() {
  const pool = allItems().filter((i) => state.srs[i.id]);
  if (pool.length < 5) return toast('אין עדיין מספיק חומר לחזרה');
  state.dayState = { d: state.day, done: [], startedAt: Date.now(), correct: 0, total: 0 };
  const items = buildQueue(state, pool, 20, { newRatio: 0 });
  mountStation(
    { g: 'warmup' },
    {
      state,
      items,
      pool,
      subtitle: 'חזרה חופשית',
      onResult: (item, correct, ms) => {
        record(state, item, correct, ms);
        if (correct) {
          state.xp += XP_PER_CORRECT;
          state.crystals += CRYSTALS_PER_CORRECT;
        }
        save(state);
      },
      onFinish: () => {
        persist();
        renderHome();
      },
      quit: () => renderHome(),
    }
  );
}

/* ---------- מסכי משנה ---------- */

function openWorld() {
  clear(app);
  const root = el('div', { class: 'screen station-screen' });
  app.append(root);
  mountWorld(root, {
    state,
    onChange: () => persist(),
    onFinish: () => renderHome(),
    quit: () => renderHome(),
  });
}

function openStats() {
  const rep = masteryReport(state, allItems());
  const strands = content().strands;
  const rows = Object.entries(state.stats.byStrand).map(([k, v]) => {
    const meta = strands[k];
    const pct = v.t ? Math.round((v.c / v.t) * 100) : 0;
    return el(
      'div',
      { class: 'stat-row' },
      el('span', { class: 'st-name', text: `${meta?.icon || ''} ${meta?.title || k}` }),
      el('div', { class: 'st-bar' }, el('i', { style: { width: pct + '%', background: meta?.color || '#888' } })),
      el('b', { text: pct + '%' })
    );
  });

  modal(
    el(
      'div',
      { class: 'sheet' },
      el('h2', { text: 'ההתקדמות שלי' }),
      el('p', { class: 'sub', text: `${Object.keys(state.completedDays).length} ימים · רצף ${state.streak.count} · רמה ${level()}` }),
      rows.length ? el('div', {}, rows) : el('p', { text: 'עוד לא תרגלת מספיק כדי להראות גרפים.' }),
      el('div', { class: 'section-title', text: 'מילים שסימנת כלא מוכרות' }),
      state.glossary.length
        ? el('div', { class: 'chips' }, state.glossary.slice(-20).map((g) => el('span', { class: 'chip', text: g.w })))
        : el('p', { class: 'hint', text: 'עוד לא סימנת מילים בטקסטים.' })
    )
  );
}

function openSettings() {
  const s = state.settings;
  const row = (label, node) => el('div', { class: 'set-row' }, el('span', { text: label }), node);
  const toggle = (key, after) =>
    el('input', {
      type: 'checkbox',
      class: 'sw',
      checked: s[key],
      onchange: (e) => {
        s[key] = e.target.checked;
        persist();
        after?.();
      },
    });

  modal(
    el(
      'div',
      { class: 'sheet' },
      el('h2', { text: 'הגדרות' }),
      row('הקראה בעברית', toggle('speech')),
      row('הקראה עם ניקוד', toggle('nikud')),
      row('צלילים', toggle('sfx', () => setSfxEnabled(s.sfx))),
      row(
        'גודל טקסט',
        el('input', {
          type: 'range',
          min: '0.9',
          max: '1.5',
          step: '0.1',
          value: s.fontScale,
          oninput: (e) => {
            s.fontScale = parseFloat(e.target.value);
            applyFontScale();
            save(state);
          },
        })
      ),
      el('div', { class: 'section-title', text: 'גיבוי' }),
      el('p', { class: 'hint', text: 'שמור עותק של ההתקדמות למקרה שהדפדפן ימחק נתונים.' }),
      el(
        'div',
        { class: 'row gap' },
        btn('ייצא קובץ', () => {
          const blob = new Blob([exportState(state)], { type: 'application/json' });
          const a = el('a', { href: URL.createObjectURL(blob), download: `hebrew-quest-${todayISO()}.json` });
          a.click();
        }, 'ghost'),
        btn('ייבא קובץ', () => {
          const inp = el('input', { type: 'file', accept: '.json' });
          inp.addEventListener('change', async () => {
            try {
              state = importState(await inp.files[0].text());
              save(state, true);
              toast('הנתונים שוחזרו');
              renderHome();
            } catch (e) {
              toast('הקובץ לא תקין');
            }
          });
          inp.click();
        }, 'ghost')
      ),
      el('p', { class: 'hint small', text: `מזהה לדשבורד ההורה: ${state.childKey.slice(0, 8)}…` })
    )
  );
}

/* ---------- שער ההורה: לחיצה ארוכה על הלוגו ---------- */

let holdTimer = null;
function startParentHold() {
  holdTimer = setTimeout(() => {
    const pin = state.settings.parentPin;
    if (!pin) return askSetPin();
    askPin();
  }, 2500);
}
function cancelParentHold() {
  clearTimeout(holdTimer);
}

function askSetPin() {
  const inp = el('input', { type: 'tel', class: 'pin-input', maxlength: 4, placeholder: '••••' });
  const m = modal(
    el(
      'div',
      { class: 'sheet' },
      el('h2', { text: 'הגדרת קוד הורה' }),
      el('p', { class: 'sub', text: 'בחר קוד בן 4 ספרות. הוא ידרש כדי לפתוח את מסך ההורה.' }),
      inp,
      btn('שמור', () => {
        if (!/^\d{4}$/.test(inp.value)) return toast('צריך בדיוק 4 ספרות');
        state.settings.parentPin = inp.value;
        persist();
        m.close();
        openParentLink();
      })
    )
  );
}

function askPin() {
  const inp = el('input', { type: 'tel', class: 'pin-input', maxlength: 4, placeholder: '••••' });
  const m = modal(
    el(
      'div',
      { class: 'sheet' },
      el('h2', { text: 'קוד הורה' }),
      inp,
      btn('אישור', () => {
        if (inp.value !== state.settings.parentPin) return toast('קוד שגוי');
        m.close();
        openParentLink();
      })
    )
  );
}

function openParentLink() {
  const url = `${location.origin}${location.pathname.replace(/index\.html$/, '')}parent.html#${state.childKey}`;
  modal(
    el(
      'div',
      { class: 'sheet' },
      el('h2', { text: 'מסך הורה' }),
      el('p', { class: 'sub', text: 'הקישור הזה מציג את ההתקדמות מכל מכשיר. שמור אותו — הוא עצמו הסיסמה.' }),
      el('input', { class: 'link-input', value: url, readonly: true, onclick: (e) => e.target.select() }),
      el(
        'div',
        { class: 'row gap' },
        btn('העתק', async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast('הועתק');
          } catch {
            toast('סמן והעתק ידנית');
          }
        }),
        btn('פתח עכשיו', () => (location.href = url), 'ghost')
      )
    )
  );
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeunload', () => save(state, true));

// עוגן פיתוח מקומי בלבד — מאפשר לקפוץ בין ימים בזמן בדיקות
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.__hq = {
    get state() { return state; },
    jump(d) { state.day = d; state.dayState = null; save(state, true); renderHome(); },
    play(d) { state.day = d; state.dayState = null; save(state, true); startDay(d); },
    reset() {
      state = freshState();
      save(state, true);
      location.reload();
    },
    home: () => renderHome(),
  };
}
