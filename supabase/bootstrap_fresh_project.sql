-- Fresh Supabase project bootstrap for EnrollEase AI
-- Run this in the Supabase SQL Editor after running supabase/sync_live_schema_safe.sql.

-- 1. Seed the canonical course catalog expected by the app.
insert into public.courses (course_name, duration, fee, batch, mode, active_status)
values
  ('Agentic AI', '3 Months', 45000, 'Evening', 'Automation', true),
  ('Data Science', '3 Months', 52000, 'Morning', 'Insights', true),
  ('Full Stack Development', '3 Months', 48000, 'Evening', 'Development', true),
  ('Python Programming', '2 Months', 28000, 'Afternoon', 'Programming', true),
  ('Digital Marketing', '2 Months', 32000, 'Afternoon', 'Marketing', true)
on conflict (course_name, batch) do update
set
  duration = excluded.duration,
  fee = excluded.fee,
  mode = excluded.mode,
  active_status = excluded.active_status;

-- 2. Create an admin profile row after the admin auth user exists.
-- First create the auth user from Supabase Authentication using:
--   email: admin@enrollease.ai
-- Then run this block.
insert into public.profiles (user_id, full_name, email, role)
select
  au.id,
  'Admin',
  'admin@enrollease.ai',
  'admin'
from auth.users au
where lower(au.email) = lower('admin@enrollease.ai')
on conflict (user_id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role;

-- 3. Quick verification.
select 'profiles' as table_name, count(*) as total from public.profiles
union all
select 'courses' as table_name, count(*) as total from public.courses
union all
select 'students' as table_name, count(*) as total from public.students
union all
select 'enrollments' as table_name, count(*) as total from public.enrollments;
