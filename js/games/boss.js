// games/boss.js — קרב בוס: חזרה מרוכזת בעטיפה של קרב.
// כל תשובה נכונה מכה בגולם. אין עונש אמיתי — טעות רק מחזירה לו קצת חיים.

import { el, clear } from '../ui.js';
import { sfx } from '../sfx.js';
import { runQueue } from './common.js';
import { renderAny } from './mixed.js';

export function mountBoss(root, ctx) {
  const total = ctx.items.length;
  let hp = total;

  const hpFill = el('i', { class: 'hp-fill' });
  const golem = el('div', { class: 'golem', text: '🗿' });
  const banner = el(
    'div',
    { class: 'boss-banner' },
    golem,
    el('div', { class: 'hp' }, hpFill),
    el('span', { class: 'boss-name', text: ctx.final ? 'הגולם הגדול' : 'גולם האבן' })
  );

  const runner = runQueue(root, ctx, {
    subtitle: ctx.subtitle || 'קרב בוס — כל תשובה נכונה מכה בו',
    hearts: 5,
    requeueWrong: false,
    render: (item, api) => {
      if (!api.shell.node.querySelector('.boss-banner')) {
        api.shell.node.insertBefore(banner, api.shell.body);
      }
      renderAny(item, api, ctx.state, ctx.pool || ctx.items);
    },
  });

  // עוטפים את onResult כדי להזיז את פס החיים
  const origOnResult = ctx.onResult;
  ctx.onResult = (item, correct, ms) => {
    if (correct) {
      hp = Math.max(0, hp - 1);
      sfx.hit();
      golem.classList.add('hurt');
      setTimeout(() => golem.classList.remove('hurt'), 260);
      if (hp === 0) {
        sfx.bossDown();
        golem.classList.add('down');
      }
    } else {
      hp = Math.min(total, hp + 0.5);
    }
    hpFill.style.width = `${Math.round((hp / total) * 100)}%`;
    origOnResult?.(item, correct, ms);
  };

  hpFill.style.width = '100%';
  return runner;
}
