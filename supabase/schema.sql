create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'staff', 'student')),
  created_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_code text,
  full_name text not null,
  email text not null unique,
  phone text not null,
  alternate_phone text,
  college_name text,
  current_activity text,
  place text,
  address text,
  guardian_name text,
  guardian_relation text,
  guardian_phone text,
  aadhaar_id text,
  photo_url text,
  aadhaar_document_url text,
  lead_source text,
  notes text,
  created_at timestamptz default now()
);

alter table public.students add column if not exists student_code text;

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  course_name text not null,
  duration text,
  fee numeric(12, 2) default 0,
  batch text,
  mode text,
  active_status boolean default true
);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  course_id uuid not null references courses(id),
  course_name text,
  batch text,
  pipeline_stage text default 'Enquiry',
  lead_date date,
  enrolled_date date,
  follow_up_date date,
  payment_method text,
  payment_plan text,
  total_fee numeric(12, 2) default 0,
  amount_paid numeric(12, 2) default 0,
  installments_planned integer default 1,
  installments_paid integer default 0,
  installment_amount numeric(12, 2) default 0,
  next_due_date date,
  payment_status text default 'Pending',
  enrollment_status text default 'Pending',
  verification_status text default 'Pending',
  remarks text,
  dropout_reason text,
  last_payment_date date,
  payment_history jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  document_type text not null,
  file_url text not null,
  verification_status text default 'Pending',
  remarks text,
  uploaded_at timestamptz default now()
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references enrollments(id) on delete set null,
  email_type text not null,
  status text default 'Queued',
  sent_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  description text,
  created_at timestamptz default now()
);

create unique index if not exists courses_name_batch_unique_idx on courses (course_name, batch);
create unique index if not exists students_student_code_unique_idx on public.students (student_code) where student_code is not null;

alter table profiles enable row level security;
alter table students enable row level security;
alter table courses enable row level security;
alter table enrollments enable row level security;
alter table documents enable row level security;
alter table email_logs enable row level security;
alter table audit_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table profiles to authenticated;
grant select, insert, update, delete on table students to authenticated;
grant select, insert, update on table courses to authenticated;
grant select, insert, update, delete on table enrollments to authenticated;
grant select, insert, update, delete on table documents to authenticated;
grant select, insert on table email_logs to authenticated;
grant select, insert on table audit_logs to authenticated;

drop policy if exists "profiles_select_authenticated" on profiles;
drop policy if exists "profiles_upsert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "students_full_access" on students;
drop policy if exists "courses_full_access_authenticated" on courses;
drop policy if exists "enrollments_full_access" on enrollments;
drop policy if exists "documents_full_access" on documents;
drop policy if exists "email_logs_full_access" on email_logs;
drop policy if exists "audit_logs_full_access" on audit_logs;

create policy "profiles_select_authenticated"
on profiles for select
to authenticated
using (true);

create policy "profiles_upsert_own"
on profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "students_full_access"
on students for all
to authenticated
using (true)
with check (true);

create policy "courses_full_access_authenticated"
on courses for all
to authenticated
using (true)
with check (true);

create policy "enrollments_full_access"
on enrollments for all
to authenticated
using (true)
with check (true);

create policy "documents_full_access"
on documents for all
to authenticated
using (true)
with check (true);

create policy "email_logs_full_access"
on email_logs for all
to authenticated
using (true)
with check (true);

create policy "audit_logs_full_access"
on audit_logs for all
to authenticated
using (true)
with check (true);

insert into courses (course_name, duration, fee, batch, mode, active_status)
values
  ('Agentic AI', '6 Months', 45000, 'Weekend Elite', 'Automation', true),
  ('Data Science', '8 Months', 52000, 'Morning Pro', 'Insights', true),
  ('Full Stack Development', '7 Months', 48000, 'Evening Launch', 'Development', true),
  ('Python Programming', '4 Months', 28000, 'Fast Track', 'Programming', true),
  ('Digital Marketing', '5 Months', 32000, 'Career Boost', 'Marketing', true)
on conflict do nothing;
