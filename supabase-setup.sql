-- نفّذ هذا الملف مرة واحدة في Supabase > SQL Editor

-- 1) أعمدة جديدة لجدول profiles
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists perms text[];          -- null = صلاحيات الدور الافتراضية
alter table public.profiles add column if not exists active boolean not null default true;

-- 2) السماح بدور admin (إن كان الدور مقيّدا بـ check؛ وإن كان enum نفّذ: alter type <اسم_النوع> add value 'admin';)
alter table public.profiles drop constraint if exists profiles_role_check;

-- 3) دالة تتحقق أن المستخدم الحالي مسؤول نظام
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and coalesce(active, true));
$$;

-- 4) المسؤول يقرأ وينشئ ويعدّل كل الملفات الشخصية
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5) عيّن أول مسؤول (بعد إنشاء حسابه من Authentication > Users)
-- update public.profiles set role = 'admin' where email = 'admin@cclsadrar.com';
