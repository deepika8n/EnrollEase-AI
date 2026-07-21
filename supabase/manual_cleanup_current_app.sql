-- EnrollEase AI current live-app cleanup guide
-- Run these statements manually in the Supabase SQL Editor after reviewing them.
-- Replace the admin email value below with your real admin login email before deleting users.

-- =========================================================
-- 1. TABLES THE CURRENT APP STILL USES
-- Keep these:
--   public.profiles
--   public.students
--   public.courses
--   public.enrollments
--   public.documents
--   public.email_logs
--   public.audit_logs
--
-- Older tables that are not used by the current UI/code:
--   public.email_templates
--   public.pdf_records
--   public.agent_logs
-- =========================================================

-- Review current profile rows first
select id, user_id, full_name, email, role, created_at
from public.profiles
order by created_at desc;

-- Review auth users first
select id, email, created_at, last_sign_in_at
from auth.users
order by created_at desc;

-- =========================================================
-- 2. DROP OLD UNUSED TABLES
-- Uncomment only after confirming you do not need old data.
-- =========================================================

-- drop table if exists public.email_templates cascade;
-- drop table if exists public.pdf_records cascade;
-- drop table if exists public.agent_logs cascade;

-- =========================================================
-- 3. KEEP ONLY ADMIN PROFILE
-- Replace the email below with the one admin account you want to keep.
-- =========================================================

-- delete from public.profiles
-- where lower(email) <> lower('admin@enrollease.ai');

-- =========================================================
-- 4. REMOVE NON-ADMIN AUTH USERS
-- Replace the email below with the one admin account you want to keep.
-- WARNING: this deletes login credentials from Supabase Auth.
-- =========================================================

-- delete from auth.identities
-- where user_id in (
--   select id from auth.users
--   where lower(email) <> lower('admin@enrollease.ai')
-- );

-- delete from auth.sessions
-- where user_id in (
--   select id from auth.users
--   where lower(email) <> lower('admin@enrollease.ai')
-- );

-- delete from auth.users
-- where lower(email) <> lower('admin@enrollease.ai');

-- =========================================================
-- 5. OPTIONAL REVIEW QUERIES
-- =========================================================

-- Current app workflow data counts
select 'profiles' as table_name, count(*) as total from public.profiles
union all
select 'students', count(*) from public.students
union all
select 'courses', count(*) from public.courses
union all
select 'enrollments', count(*) from public.enrollments
union all
select 'documents', count(*) from public.documents
union all
select 'email_logs', count(*) from public.email_logs
union all
select 'audit_logs', count(*) from public.audit_logs;
