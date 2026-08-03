// config.js — הגדרות סנכרון.
// כל עוד השדות ריקים, האפליקציה עובדת מצוין — פשוט בלי דשבורד מרחוק.
// כדי להפעיל: צור פרויקט חינמי ב-supabase.com, הרץ את tools/supabase.sql,
// והדבק כאן את ה-Project URL ואת מפתח ה-anon (Settings → API).

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const syncEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
