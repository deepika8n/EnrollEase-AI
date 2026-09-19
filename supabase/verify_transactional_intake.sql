-- Synthetic fixtures only; all changes roll back and no emails are sent.
begin;
do $$
declare
  sid uuid := gen_random_uuid(); cid uuid := gen_random_uuid(); eid uuid := gen_random_uuid();
  result jsonb; code text;
  docs jsonb := '[{"document_type":"Student Photo","file_url":"test-photo"},{"document_type":"Aadhaar","file_url":"test-document"}]';
begin
  if has_function_privilege('anon','public.complete_student_intake(uuid,text,jsonb,jsonb,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.complete_student_intake(uuid,text,jsonb,jsonb,jsonb)','EXECUTE') then
    raise exception 'Public execution must be denied';
  end if;
  insert into courses(id,course_name,batch) values(cid,'Transaction regression ' || cid,'Test');
  insert into students(id,full_name,email,phone) values(sid,'Regression Fixture',sid || '@example.invalid','0000000000');
  insert into enrollments(id,student_id,course_id,student_form_status,student_form_token_hash,student_form_expires_at)
    values(eid,sid,cid,'Sent','test-hash',now()+interval '1 hour');
  begin
    perform complete_student_intake(eid,'wrong','{}','{}',docs);
    raise exception 'Invalid token was accepted';
  exception when raise_exception then
    if SQLERRM not like '%invalid or expired%' then raise; end if;
  end;
  begin
    perform complete_student_intake(eid,'test-hash','{"full_name":"Must rollback"}','{}',
      '[{"document_type":"Photo","file_url":"test"},{"document_type":"Aadhaar","file_url":null}]');
    raise exception 'Invalid document was accepted';
  exception when not_null_violation then null;
  end;
  if (select full_name <> 'Regression Fixture' or student_code is not null from students where id=sid)
     or (select student_form_status <> 'Sent' or student_form_token_hash <> 'test-hash' from enrollments where id=eid)
     or exists(select 1 from documents where enrollment_id=eid) then
    raise exception 'Failed submission was not fully rolled back';
  end if;
  result := complete_student_intake(eid,'test-hash','{"full_name":"Completed Fixture"}','{"total_fee":1000,"amount_paid":0}',docs);
  code := result->>'student_code';
  if code is null or result->>'already_submitted' <> 'false'
     or (select count(*) from documents where enrollment_id=eid) <> 2
     or (select student_form_status <> 'Submitted' or student_form_token_hash is not null from enrollments where id=eid) then
    raise exception 'Successful submission did not save all parts';
  end if;
  result := complete_student_intake(eid,'test-hash','{}','{}',docs);
  if result->>'already_submitted' <> 'true' or (select count(*) from documents where enrollment_id=eid) <> 2 then
    raise exception 'Repeated submission duplicated documents';
  end if;
  -- Resent form for an existing student keeps the same assigned ID.
  update enrollments set student_form_status='Sent',student_form_token_hash='test-hash' where id=eid;
  result := complete_student_intake(eid,'test-hash','{"student_code":"CLIENT-OVERRIDE"}','{}',docs);
  if result->>'student_code' <> code then raise exception 'Existing student ID changed'; end if;
end $$;
rollback;
select 'PASS: token checks, restricted access, full rollback, successful save, repeat submission, existing ID preservation' as result;
