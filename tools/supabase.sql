-- הרץ את זה פעם אחת ב-Supabase → SQL Editor.
-- הטבלה סגורה לחלוטין ל-anon; הגישה עוברת רק דרך שתי פונקציות שמקבלות את המפתח.
-- כך מי שיש לו את מפתח ה-anon (שגלוי בקוד) עדיין לא יכול לדלות רשימת ילדים.

create table if not exists public.progress (
  child_key  text primary key,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;
-- שים לב: לא מוגדרת אף policy, ולכן anon אינו יכול לקרוא או לכתוב ישירות.

create or replace function public.put_progress(k text, s jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if k is null or length(k) < 24 then
    raise exception 'invalid key';
  end if;
  if pg_column_size(s) > 400000 then
    raise exception 'payload too large';
  end if;
  insert into public.progress (child_key, state, updated_at)
  values (k, s, now())
  on conflict (child_key)
  do update set state = excluded.state, updated_at = now();
end;
$$;

create or replace function public.get_progress(k text)
returns table (state jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.state, p.updated_at
  from public.progress p
  where p.child_key = k;
$$;

revoke all on function public.put_progress(text, jsonb) from public;
revoke all on function public.get_progress(text) from public;
grant execute on function public.put_progress(text, jsonb) to anon;
grant execute on function public.get_progress(text)        to anon;
