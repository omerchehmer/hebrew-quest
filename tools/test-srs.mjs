// בדיקת מנוע החזרה המרווחת.  הרצה: node tools/test-srs.mjs
import { record, buildQueue, isDue, INTERVALS, MAX_BOX } from '../js/srs.js';
import { freshState, todayISO, daysBetween } from '../js/storage.js';

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) { failures++; console.log('  ❌ ' + msg); } else console.log('  ✓ ' + msg);
};

const pool = Array.from({ length: 60 }, (_, i) => ({
  id: 'it' + i,
  strand: ['spelling', 'vocab', 'grammar'][i % 3],
  skill: 'skill' + (i % 5),
  kind: 'spell',
}));

/* 1. טעות מחזירה לקופסה 1 ולחזרה מיידית */
{
  const s = freshState();
  const it = pool[0];
  record(s, it, true);
  record(s, it, true);
  record(s, it, true);
  ok(s.srs[it.id].box === 3, 'שלוש הצלחות → קופסה 3');
  record(s, it, false);
  ok(s.srs[it.id].box === 1, 'טעות אחת → חזרה לקופסה 1');
  ok(daysBetween(s.srs[it.id].due, todayISO()) >= -1, 'אחרי טעות החזרה מתוזמנת למחר לכל היותר');
  ok(s.stats.errors[it.id] === 1, 'הטעות נרשמה לדוח ההורה');
}

/* 2. חמש הצלחות מוציאות פריט מהמחזור הקרוב */
{
  const s = freshState();
  const it = pool[1];
  for (let i = 0; i < 6; i++) record(s, it, true);
  ok(s.srs[it.id].box === MAX_BOX, 'חמש הצלחות → קופסה מקסימלית');
  ok(daysBetween(todayISO(), s.srs[it.id].due) === INTERVALS[MAX_BOX], `החזרה הבאה בעוד ${INTERVALS[MAX_BOX]} יום`);
  ok(!isDue(s, it.id), 'הפריט אינו מוגש שוב היום');
}

/* 3. 200 תשובות: פריטים שגויים חוזרים הרבה יותר מפריטים נכונים */
{
  const s = freshState();
  const weak = pool.slice(0, 5).map((x) => x.id);
  const served = {};
  for (let round = 0; round < 20; round++) {
    const q = buildQueue(s, pool, 10);
    for (const it of q) {
      served[it.id] = (served[it.id] || 0) + 1;
      record(s, it, !weak.includes(it.id)); // תמיד טועה בחמישה פריטים
    }
  }
  const weakAvg = weak.reduce((a, id) => a + (served[id] || 0), 0) / weak.length;
  const restIds = pool.slice(5).map((x) => x.id);
  const restAvg = restIds.reduce((a, id) => a + (served[id] || 0), 0) / restIds.length;
  console.log(`     חלשים: ${weakAvg.toFixed(1)} הגשות · שאר: ${restAvg.toFixed(1)}`);
  ok(weakAvg > restAvg * 1.5, 'פריטים שנכשלים מוגשים לפחות פי 1.5 מהאחרים');
  ok(Object.keys(served).length > 40, 'הכיסוי רחב — לא נתקעים על אותם פריטים');
}

/* 4. יחס חדש/חזרה */
{
  const s = freshState();
  for (const it of pool.slice(0, 30)) record(s, it, false); // 30 פריטים שממתינים לחזרה
  const q = buildQueue(s, pool, 10, { newRatio: 0.3 });
  const fresh = q.filter((x) => !s.srs[x.id]).length;
  ok(q.length === 10, 'התור באורך המבוקש');
  ok(fresh >= 2 && fresh <= 4, `~30% פריטים חדשים בתור (בפועל ${fresh}/10)`);
}

/* 5. אין כפילויות בתור */
{
  const s = freshState();
  const q = buildQueue(s, pool, 20);
  ok(new Set(q.map((x) => x.id)).size === q.length, 'אין פריט שמופיע פעמיים באותה תחנה');
}

console.log(failures ? `\n${failures} בדיקות נכשלו\n` : '\n✅ כל בדיקות ה-SRS עברו\n');
process.exit(failures ? 1 : 0);
