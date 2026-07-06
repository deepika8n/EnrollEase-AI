alter table public.courses enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.courses to authenticated;

drop policy if exists "courses_read_authenticated" on public.courses;
drop policy if exists "courses_full_access_authenticated" on public.courses;

create policy "courses_full_access_authenticated"
on public.courses for all
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

select id, course_name, duration, fee, batch, active_status
from public.courses
order by course_name, batch;
