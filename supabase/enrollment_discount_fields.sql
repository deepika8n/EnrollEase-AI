-- Add missing financial fields without changing existing admissions or payments.
begin;
alter table public.enrollments add column if not exists original_fee numeric(12, 2) default 0;
alter table public.enrollments add column if not exists discount_type text;
alter table public.enrollments add column if not exists discount_value numeric(12, 2) default 0;
alter table public.enrollments add column if not exists discount_amount numeric(12, 2) default 0;
notify pgrst, 'reload schema';
commit;
