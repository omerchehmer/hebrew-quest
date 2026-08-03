// games/mixed.js — נתב פריטים: מריץ כל פריט במנוע המתאים לו.
// משמש את תחנת החימום ואת קרבות הבוס, שבהם מעורבבים כל ארבעת התחומים.

import { runQueue } from './common.js';
import { quickSpell } from './spell.js';
import { quickVocab } from './vocab.js';
import { quickGrammar } from './grammar.js';

export function renderAny(item, api, state, pool) {
  if (item.kind === 'spell') return quickSpell(item, api, state);
  if (item.kind === 'vocab') return quickVocab(item, api, state, pool);
  if (item.kind === 'grammar') return quickGrammar(item, api);
  return quickSpell(item, api, state);
}

export function mountMixed(root, ctx) {
  const pool = ctx.pool || ctx.items;
  return runQueue(root, ctx, {
    subtitle: ctx.subtitle || 'חזרה מהירה על מה שכבר למדת',
    render: (item, api) => renderAny(item, api, ctx.state, pool),
  });
}
