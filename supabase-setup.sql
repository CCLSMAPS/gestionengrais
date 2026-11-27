-- نفّذ هذا الملف مرة واحدة في Supabase > SQL Editor

-- 1) أعمدة جديدة لجدول profiles
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists permissions text[];          -- null = صلاحيات الدور الافتراضية
alter table public.profiles add column if not exists is_blocked boolean not null default false;

-- 2) السماح بدور admin (إن كان الدور مقيّدا بـ check؛ وإن كان enum نفّذ: alter type <اسم_النوع> add value 'admin';)
alter table public.profiles drop constraint if exists profiles_role_check;

-- 3) دوال مساعدة آمنة (SECURITY DEFINER مع search_path فارغ لمنع التلاعب بالمخطط)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.role = 'admin'
        or exists (select 1 from public.roles r where r.code = p.role and coalesce(r.is_admin, false))
      )
      and not coalesce(p.is_blocked, false)
  );
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and not exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_blocked, false)
    );
$$;

-- 4) المسؤول يقرأ وينشئ ويعدّل كل الملفات الشخصية
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5) عيّن أول مسؤول (بعد إنشاء حسابه من Authentication > Users)
-- update public.profiles set role = 'admin' where email = 'admin@cclsadrar.com';

-- 6) أعمدة رقم بطاقة الفلاح ونوع المحصول وصورة البطاقة لجدول الفواتير
alter table public.invoices add column if not exists farmer_card_no text;
alter table public.invoices add column if not exists culture text;
alter table public.invoices add column if not exists farmer_card_photo text;

-- 7) عمود تاريخ انتهاء صلاحية المنتج لجدول الوارد (stock_in)
alter table public.stock_in add column if not exists expiry_date date;

-- 8) فهارس أداء للاستعلامات المتكررة وسياسات RLS
create index if not exists idx_profiles_user_id on public.profiles (user_id);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_invoices_year on public.invoices (invoice_year);
create index if not exists idx_invoices_card on public.invoices (farmer_card_no);
create index if not exists idx_stock_in_product on public.stock_in (product_id);
create index if not exists idx_withdrawals_invoice on public.withdrawals (invoice_id);

-- 9) بذور صلاحيات الصفحات والأزرار والمزايا المتقدمة (اختياري لدعم الصلاحيات الافتراضية للمناصب)
insert into public.app_permissions (code, label, sort_order, pages) values
  ('page:analytics', 'صفحة: لوحة التحكم التحليلية', 100, array['analytics.html']),
  ('page:reception', 'صفحة: 1. استقبال الملفات', 101, array['reception.html']),
  ('page:index', 'صفحة: 2. الفواتير والوارد', 102, array['index.html']),
  ('page:bons', 'صفحة: 3. أذون الخروج', 103, array['bons.html']),
  ('page:warehouse', 'صفحة: 4. تسيير المخزن', 104, array['warehouse.html']),
  ('page:crops', 'صفحة: 5. إحصائيات الزراعات', 105, array['crops.html']),
  ('page:users', 'صفحة: 6. المستخدمون والصلاحيات', 106, array['users.html']),
  ('btn:create', 'زر: إضافة وحفظ بيانات جديدة', 200, array[]::text[]),
  ('btn:edit', 'زر: تعديل السجلات والكميات', 201, array[]::text[]),
  ('btn:delete', 'زر: حذف السجلات', 202, array[]::text[]),
  ('btn:print', 'زر: طباعة الوثائق والتقارير', 203, array[]::text[]),
  ('btn:pdf', 'زر: تصدير ملفات PDF', 204, array[]::text[]),
  ('btn:csv', 'زر: تصدير جداول CSV / Excel', 205, array[]::text[]),
  ('btn:refresh', 'زر: تحديث وإعادة تحميل البيانات', 206, array[]::text[]),
  ('feat:financials', 'ميزة: عرض الأسعار والقيم المالية (دج)', 300, array[]::text[]),
  ('feat:settings_system', 'ميزة: تعديل إعدادات المؤسسة والمخزون والنسخ الاحتياطي', 301, array[]::text[]),
  ('feat:audit_view', 'ميزة: عرض سجل النشاط والتعديلات', 302, array[]::text[])
on conflict (code) do nothing;

