grant usage on schema public to authenticated;

grant select, insert, update on table public.students to authenticated;
grant select, insert, update on table public.courses to authenticated;
grant select, insert, update on table public.enrollments to authenticated;
grant select, insert, update on table public.documents to authenticated;

alter table public.students add column if not exists alternate_phone text;
alter table public.students add column if not exists college_name text;
alter table public.students add column if not exists current_activity text;
alter table public.students add column if not exists place text;
alter table public.students add column if not exists guardian_relation text;
alter table public.students add column if not exists aadhaar_id text;
alter table public.students add column if not exists photo_url text;
alter table public.students add column if not exists aadhaar_document_url text;
alter table public.students add column if not exists lead_source text;
alter table public.students add column if not exists notes text;

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
alter table public.enrollments add column if not exists dropout_reason text;
alter table public.enrollments add column if not exists last_payment_date date;
alter table public.enrollments add column if not exists payment_history jsonb default '[]'::jsonb;

alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.documents enable row level security;

drop policy if exists "students_full_access" on public.students;
drop policy if exists "courses_read_authenticated" on public.courses;
drop policy if exists "courses_full_access_authenticated" on public.courses;
drop policy if exists "enrollments_full_access" on public.enrollments;
drop policy if exists "documents_full_access" on public.documents;

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

update public.courses set duration = '6 Months', fee = 45000, active_status = true
where course_name = 'Agentic AI' and batch = 'Weekend Elite';

update public.courses set duration = '8 Months', fee = 52000, active_status = true
where course_name = 'Data Science' and batch = 'Morning Pro';

update public.courses set duration = '7 Months', fee = 48000, active_status = true
where course_name = 'Full Stack Development' and batch = 'Evening Launch';

update public.courses set duration = '4 Months', fee = 28000, active_status = true
where course_name = 'Python Programming' and batch = 'Fast Track';

update public.courses set duration = '5 Months', fee = 32000, active_status = true
where course_name = 'Digital Marketing' and batch = 'Career Boost';

insert into public.courses (course_name, duration, fee, batch, active_status)
select 'Agentic AI', '6 Months', 45000, 'Weekend Elite', true
where not exists (
  select 1 from public.courses where course_name = 'Agentic AI' and batch = 'Weekend Elite'
);

insert into public.courses (course_name, duration, fee, batch, active_status)
select 'Data Science', '8 Months', 52000, 'Morning Pro', true
where not exists (
  select 1 from public.courses where course_name = 'Data Science' and batch = 'Morning Pro'
);

insert into public.courses (course_name, duration, fee, batch, active_status)
select 'Full Stack Development', '7 Months', 48000, 'Evening Launch', true
where not exists (
  select 1 from public.courses where course_name = 'Full Stack Development' and batch = 'Evening Launch'
);

insert into public.courses (course_name, duration, fee, batch, active_status)
select 'Python Programming', '4 Months', 28000, 'Fast Track', true
where not exists (
  select 1 from public.courses where course_name = 'Python Programming' and batch = 'Fast Track'
);

insert into public.courses (course_name, duration, fee, batch, active_status)
select 'Digital Marketing', '5 Months', 32000, 'Career Boost', true
where not exists (
  select 1 from public.courses where course_name = 'Digital Marketing' and batch = 'Career Boost'
);

update public.enrollments
set
  lead_date = coalesce(lead_date, created_at::date),
  enrolled_date = coalesce(
    enrolled_date,
    case
      when enrollment_status = 'Active'
        or enrollment_status = 'Completed'
        or payment_status in ('Paid', 'Partial')
        or verification_status = 'Approved'
      then created_at::date
      else null
    end
  ),
  pipeline_stage = coalesce(
    pipeline_stage,
    case
      when dropout_reason is not null and dropout_reason <> '' then 'Dropout'
      when enrollment_status = 'Dropped' then 'Dropout'
      when enrolled_date is not null then 'Enrolled'
      when enrollment_status in ('Active', 'Completed') then 'Enrolled'
      when payment_status in ('Paid', 'Partial') then 'Enrolled'
      when verification_status = 'Approved' then 'Enrolled'
      else 'Enquiry'
    end
  );

select
  (select count(*) from public.students) as students_count,
  (select count(*) from public.courses) as courses_count,
  (select count(*) from public.enrollments) as enrollments_count,
  (select count(*) from public.documents) as documents_count;
