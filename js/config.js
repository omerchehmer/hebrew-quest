// config.js — הגדרות סנכרון.
// כל עוד השדות ריקים, האפליקציה עובדת מצוין — פשוט בלי דשבורד מרחוק.
// כדי להפעיל: צור פרויקט חינמי ב-supabase.com, הרץ את tools/supabase.sql,
// והדבק כאן את ה-Project URL ואת מפתח ה-anon (Settings → API).

export const SUPABASE_URL = 'https://tzcqptagyspyzdmurbkm.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6Y3FwdGFneXNweXpkbXVyYmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODA2ODQsImV4cCI6MjEwMTM1NjY4NH0.X0zOUuay6kjhFaPr6fStp7aXruvJxT3YNkNpHIJSSUw';

export const syncEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
