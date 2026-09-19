begin;
alter table public.students add column if not exists photo_preview_url text;
alter table public.students add column if not exists aadhaar_preview_url text;
create or replace function public.clear_changed_student_previews() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.photo_url is distinct from old.photo_url and new.photo_preview_url is not distinct from old.photo_preview_url then
    new.photo_preview_url := null;
  end if;
  if new.aadhaar_document_url is distinct from old.aadhaar_document_url and new.aadhaar_preview_url is not distinct from old.aadhaar_preview_url then
    new.aadhaar_preview_url := null;
  end if;
  return new;
end;
$$;
drop trigger if exists clear_changed_student_previews on public.students;
create trigger clear_changed_student_previews before update on public.students
for each row execute function public.clear_changed_student_previews();
notify pgrst, 'reload schema';
commit;
