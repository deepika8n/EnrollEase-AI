-- EnrollEase AI student-data reset
-- This removes student-facing records only.
-- It keeps admin login/profile rows, courses, app logic, and workflow structure intact.

begin;

delete from public.email_logs;
delete from public.documents;
delete from public.enrollments;
delete from public.students;
delete from public.audit_logs;

commit;

-- Verify the reset
select 'students' as table_name, count(*) as total from public.students
union all
select 'enrollments', count(*) from public.enrollments
union all
select 'documents', count(*) from public.documents
union all
select 'email_logs', count(*) from public.email_logs
union all
select 'audit_logs', count(*) from public.audit_logs
union all
select 'courses', count(*) from public.courses
union all
select 'profiles', count(*) from public.profiles;
