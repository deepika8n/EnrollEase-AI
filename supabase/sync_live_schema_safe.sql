create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'staff', 'student')),
  created_at timestamptz default now()
);

create table if not exists public.students (
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
alter table public.students add column if not exists alternate_phone text;
alter table public.students add column if not exists college_name text;
alter table public.students add column if not exists current_activity text;
alter table public.students add column if not exists place text;
alter table public.students add column if not exists address text;
alter table public.students add column if not exists guardian_name text;
alter table public.students add column if not exists guardian_relation text;
alter table public.students add column if not exists guardian_phone text;
alter table public.students add column if not exists aadhaar_id text;
alter table public.students add column if not exists photo_url text;
alter table public.students add column if not exists aadhaar_document_url text;
alter table public.students add column if not exists lead_source text;
alter table public.students add column if not exists notes text;
alter table public.students add column if not exists created_at timestamptz default now();

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  course_name text not null,
  duration text,
  fee numeric(12, 2) default 0,
  batch text,
  mode text,
  active_status boolean default true
);

alter table public.courses add column if not exists duration text;
alter table public.courses add column if not exists fee numeric(12, 2) default 0;
alter table public.courses add column if not exists batch text;
alter table public.courses add column if not exists mode text;
alter table public.courses add column if not exists active_status boolean default true;

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id),
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
  student_form_status text default 'Not Sent',
  student_form_token_hash text,
  student_form_sent_at timestamptz,
  student_form_expires_at timestamptz,
  student_form_submitted_at timestamptz,
  last_payment_date date,
  payment_history jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.enrollments add column if not exists course_name text;
alter table public.enrollments add column if not exists batch text;
alter table public.enrollments add column if not exists pipeline_stage text default 'Enquiry';
alter table public.enrollments add column if not exists lead_date date;
alter table public.enrollments add column if not exists enrolled_date date;
alter table public.enrollments add column if not exists follow_up_date date;
alter table public.enrollments add column if not exists payment_method text;
alter table public.enrollments add column if not exists payment_plan text;
alter table public.enrollments add column if not exists total_fee numeric(12, 2) default 0;
alter table public.enrollments add column if not exists amount_paid numeric(12, 2) default 0;
alter table public.enrollments add column if not exists installments_planned integer default 1;
alter table public.enrollments add column if not exists installments_paid integer default 0;
alter table public.enrollments add column if not exists installment_amount numeric(12, 2) default 0;
alter table public.enrollments add column if not exists next_due_date date;
alter table public.enrollments add column if not exists payment_status text default 'Pending';
alter table public.enrollments add column if not exists enrollment_status text default 'Pending';
alter table public.enrollments add column if not exists verification_status text default 'Pending';
alter table public.enrollments add column if not exists remarks text;
alter table public.enrollments add column if not exists dropout_reason text;
alter table public.enrollments add column if not exists student_form_status text default 'Not Sent';
alter table public.enrollments add column if not exists student_form_token_hash text;
alter table public.enrollments add column if not exists student_form_sent_at timestamptz;
alter table public.enrollments add column if not exists student_form_expires_at timestamptz;
alter table public.enrollments add column if not exists student_form_submitted_at timestamptz;
alter table public.enrollments add column if not exists last_payment_date date;
alter table public.enrollments add column if not exists payment_history jsonb default '[]'::jsonb;
alter table public.enrollments add column if not exists created_at timestamptz default now();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  document_type text not null,
  file_url text not null,
  verification_status text default 'Pending',
  remarks text,
  uploaded_at timestamptz default now()
);

alter table public.documents add column if not exists verification_status text default 'Pending';
alter table public.documents add column if not exists remarks text;
alter table public.documents add column if not exists uploaded_at timestamptz default now();

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.enrollments(id) on delete set null,
  email_type text not null,
  status text default 'Queued',
  sent_at timestamptz default now()
);

alter table public.email_logs add column if not exists status text default 'Queued';
alter table public.email_logs add column if not exists sent_at timestamptz default now();

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  description text,
  created_at timestamptz default now()
);

alter table public.audit_logs add column if not exists description text;
alter table public.audit_logs add column if not exists created_at timestamptz default now();

create unique index if not exists courses_name_batch_unique_idx
  on public.courses (course_name, batch);

create unique index if not exists students_student_code_unique_idx
  on public.students (student_code)
  where student_code is not null;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.documents enable row level security;
alter table public.email_logs enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.students to authenticated;
grant select, insert, update on table public.courses to authenticated;
grant select, insert, update, delete on table public.enrollments to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert on table public.email_logs to authenticated;
grant select, insert on table public.audit_logs to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "students_full_access" on public.students;
drop policy if exists "courses_full_access_authenticated" on public.courses;
drop policy if exists "enrollments_full_access" on public.enrollments;
drop policy if exists "documents_full_access" on public.documents;
drop policy if exists "email_logs_full_access" on public.email_logs;
drop policy if exists "audit_logs_full_access" on public.audit_logs;

create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

create policy "profiles_upsert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "students_full_access"
on public.students for all
to authenticated
using (true)
with check (true);

create policy "courses_full_access_authenticated"
on public.courses for all
to authenticated
using (true)
with check (true);

create policy "enrollments_full_access"
on public.enrollments for all
to authenticated
using (true)
with check (true);

create policy "documents_full_access"
on public.documents for all
to authenticated
using (true)
with check (true);

create policy "email_logs_full_access"
on public.email_logs for all
to authenticated
using (true)
with check (true);

create policy "audit_logs_full_access"
on public.audit_logs for all
to authenticated
using (true)
with check (true);
