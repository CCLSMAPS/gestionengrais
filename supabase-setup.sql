-- نفّذ هذا الملف مرة واحدة في Supabase > SQL Editor

-- 1) أعمدة جديدة لجدول profiles
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists permissions text[];          -- null = صلاحيات الدور الافتراضية
alter table public.profiles add column if not exists is_blocked boolean not null default false;

-- 2) السماح بدور admin (إن كان الدور مقيّدا بـ check؛ وإن كان enum نفّذ: alter type <اسم_النوع> add value 'admin';)
alter table public.profiles drop constraint if exists profiles_role_check;

-- 3) دالة تتحقق أن المستخدم الحالي مسؤول نظام
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and (
        role = 'admin'
        or exists (select 1 from public.roles r where r.code = profiles.role and coalesce(r.is_admin, false))
      )
      and not coalesce(is_blocked, false)
  );
$$;

-- 4) المسؤول يقرأ وينشئ ويعدّل كل الملفات الشخصية
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5) عيّن أول مسؤول (بعد إنشاء حسابه من Authentication > Users)
-- update public.profiles set role = 'admin' where email = 'admin@cclsadrar.com';

-- 6) أعمدة رقم بطاقة الفلاح ونوع المحصول لجدول الفواتير (للتحقق الفوري)
alter table public.invoices add column if not exists farmer_card_no text;
alter table public.invoices add column if not exists culture text;

-- 7) عمود تاريخ انتهاء صلاحية المنتج لجدول الوارد (stock_in)
alter table public.stock_in add column if not exists expiry_date date;

