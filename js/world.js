// world.js — "הבסיס". הגבישים שהרווחת הופכים לבלוקים, והבסיס גדל בפועל.
// זו ההתקדמות שאפשר לראות בעיניים, לא רק מספר שעולה.

import { el, clear, Shell, btn, toast } from './ui.js';
import { sfx } from './sfx.js';

export const GRID_W = 12;
export const GRID_H = 9;

export const BLOCKS = [
  { id: 'stone', name: 'אבן', cost: 3, color: '#8d95a3', from: 1 },
  { id: 'wood', name: 'עץ', cost: 4, color: '#b3773c', from: 1 },
  { id: 'grass', name: 'דשא', cost: 4, color: '#4caf50', from: 3 },
  { id: 'glass', name: 'זכוכית', cost: 6, color: '#9fd8ff', from: 7 },
  { id: 'gold', name: 'זהב', cost: 10, color: '#f2c94c', from: 14 },
  { id: 'emerald', name: 'אמרלד', cost: 14, color: '#2dd4a8', from: 21 },
  { id: 'lava', name: 'לבה', cost: 18, color: '#ff6a3d', from: 28 },
];

export const SKINS = {
  skin_start: { name: 'חופר מתחיל', emoji: '🧑‍🔧' },
  skin_miner: { name: 'כורה מנוסה', emoji: '⛏️' },
  skin_scholar: { name: 'חוקר הכתובות', emoji: '🧙' },
  skin_legend: { name: 'אלוף המכרה', emoji: '👑' },
};

export function availableBlocks(state) {
  const maxDay = Math.max(state.day, ...Object.keys(state.completedDays).map(Number), 1);
  return BLOCKS.filter((b) => b.from <= maxDay);
}

export function renderGrid(state, { interactive = false, onPlace = null, selected = null } = {}) {
  const grid = el('div', { class: 'world-grid', style: { '--gw': GRID_W, '--gh': GRID_H } });
  const map = new Map(state.world.placed.map((p) => [`${p.x},${p.y}`, p]));

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const p = map.get(`${x},${y}`);
      const isGround = y === GRID_H - 1;
      const def = p ? BLOCKS.find((b) => b.id === p.t) : null;
      const cell = el('div', {
        class: 'cell' + (p ? ' filled' : '') + (isGround ? ' ground' : ''),
        style: p ? { background: def?.color || '#888' } : null,
        dataset: { x, y },
      });
      if (interactive) {
        cell.addEventListener('click', () => onPlace?.(x, y, p));
      }
      grid.append(cell);
    }
  }
  return grid;
}

export function mountWorld(root, ctx) {
  const state = ctx.state;
  const shell = new Shell(root, {
    total: 1,
    hearts: 3,
    subtitle: 'הבסיס שלך — בנה ממה שהרווחת',
    onQuit: () => ctx.quit?.(),
  });
  shell.heartsEl.style.visibility = 'hidden';

  let selected = availableBlocks(state)[0];
  const wrap = el('div', { class: 'game world' });

  function draw() {
    clear(wrap);
    const grid = renderGrid(state, {
      interactive: true,
      onPlace: (x, y, existing) => {
        if (existing) {
          const def = BLOCKS.find((b) => b.id === existing.t);
          state.world.placed = state.world.placed.filter((p) => !(p.x === x && p.y === y));
          state.crystals += Math.floor((def?.cost || 2) / 2);
          sfx.mine();
          ctx.onChange?.();
          draw();
          return;
        }
        if (state.crystals < selected.cost) {
          toast(`חסרים ${selected.cost - state.crystals} גבישים`);
          return;
        }
        state.crystals -= selected.cost;
        state.world.placed.push({ x, y, t: selected.id });
        sfx.mine();
        ctx.onChange?.();
        draw();
      },
    });

    const palette = el(
      'div',
      { class: 'palette' },
      availableBlocks(state).map((b) =>
        el(
          'button',
          {
            class: 'pal' + (b.id === selected.id ? ' sel' : '') + (state.crystals < b.cost ? ' poor' : ''),
            type: 'button',
            onclick: () => {
              sfx.tap();
              selected = b;
              draw();
            },
          },
          el('i', { style: { background: b.color } }),
          el('span', { text: b.name }),
          el('b', { text: `💎${b.cost}` })
        )
      )
    );

    wrap.append(
      el(
        'div',
        { class: 'world-head' },
        el('span', { class: 'crystal-count', text: `💎 ${state.crystals}` }),
        el('span', { class: 'block-count', text: `🧱 ${state.world.placed.length} בלוקים` })
      ),
      grid,
      el('p', { class: 'hint', text: 'הקש על משבצת כדי לבנות. הקש על בלוק קיים כדי לפרק אותו ולקבל חצי מהגבישים בחזרה.' }),
      palette
    );
  }

  draw();
  clear(shell.body).append(wrap);
  clear(shell.foot).append(
    btn('סיימתי לבנות', () =>
      ctx.onFinish?.({ planned: 1, answered: 1, correct: 1, accuracy: 1, ms: 0, noScore: true })
    )
  );
  return { shell };
}
