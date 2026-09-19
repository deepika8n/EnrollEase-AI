-- Apply after enrollment_discount_fields.sql and student_media_previews.sql.
-- One transaction: a failed document insert must not consume the form token.
create or replace function public.complete_student_intake(
  p_enrollment_id uuid, p_token_hash text, p_student jsonb,
  p_enrollment jsonb, p_documents jsonb
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  current_enrollment public.enrollments%rowtype;
  next_enrollment public.enrollments%rowtype;
  current_student public.students%rowtype;
  next_student public.students%rowtype;
  allocated_code text;
  code_prefix text := 'CT' || extract(year from current_date)::text;
  constraint_name text;
  next_number bigint;
begin
  -- Serializes allocations, including different enquiries submitted together.
  perform pg_advisory_xact_lock(hashtextextended('enrollease-student-code', 0));
  select * into current_enrollment from public.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment request not found.'; end if;
  if current_enrollment.student_form_status = 'Submitted' then
    return jsonb_build_object('already_submitted', true);
  end if;
  if p_token_hash is null or current_enrollment.student_form_token_hash is distinct from p_token_hash
     or current_enrollment.student_form_expires_at is null
     or current_enrollment.student_form_expires_at <= now() then
    raise exception 'This enrollment link is invalid or expired. Please request a new link.';
  end if;
  if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents) < 2 then
    raise exception 'Student photo and Aadhaar document are required.';
  end if;
  select * into strict current_student from public.students where id = current_enrollment.student_id for update;
  next_student := jsonb_populate_record(current_student, p_student);
  next_enrollment := jsonb_populate_record(current_enrollment, p_enrollment);
  allocated_code := nullif(btrim(current_student.student_code), '');
  for attempt in 1..5 loop
    if allocated_code is null then
      select coalesce(max(substring(student_code from length(code_prefix)+1)::bigint), 0)+1
      into next_number from public.students
      where student_code ~ ('^' || code_prefix || '[0-9]+$');
      allocated_code := code_prefix || lpad(next_number::text, greatest(5, length(next_number::text)), '0');
    end if;
    begin
      update public.students set student_code = allocated_code,
        full_name = next_student.full_name,
        email = next_student.email,
        phone = next_student.phone,
        current_activity = next_student.current_activity,
        place = next_student.place,
        photo_preview_url = next_student.photo_preview_url,
        aadhaar_preview_url = next_student.aadhaar_preview_url,
        photo_url = next_student.photo_url,
        aadhaar_document_url = next_student.aadhaar_document_url,
        lead_source = next_student.lead_source,
        notes = next_student.notes
      where id = current_student.id;
      exit;
    exception when unique_violation then
      get stacked diagnostics constraint_name = CONSTRAINT_NAME;
      if constraint_name <> 'students_student_code_unique_idx' or attempt = 5
         or nullif(btrim(current_student.student_code), '') is not null then raise; end if;
      allocated_code := null;
    end;
  end loop;
  update public.enrollments set
    course_name = next_enrollment.course_name,
    batch = next_enrollment.batch,
    lead_date = next_enrollment.lead_date,
    enrolled_date = next_enrollment.enrolled_date,
    payment_method = next_enrollment.payment_method,
    payment_plan = next_enrollment.payment_plan,
    original_fee = next_enrollment.original_fee,
    discount_type = next_enrollment.discount_type,
    discount_value = next_enrollment.discount_value,
    discount_amount = next_enrollment.discount_amount,
    total_fee = next_enrollment.total_fee,
    amount_paid = next_enrollment.amount_paid,
    installments_planned = next_enrollment.installments_planned,
    installments_paid = next_enrollment.installments_paid,
    installment_amount = next_enrollment.installment_amount,
    next_due_date = next_enrollment.next_due_date,
    payment_status = next_enrollment.payment_status,
    remarks = next_enrollment.remarks,
    last_payment_date = next_enrollment.last_payment_date,
    payment_history = next_enrollment.payment_history,
    pipeline_stage = 'Enrolled', dropout_reason = null,
    verification_status = 'Pending', enrollment_status = 'Active',
    student_form_status = 'Submitted', student_form_submitted_at = now(), student_form_token_hash = null
  where id = p_enrollment_id;
  insert into public.documents (enrollment_id, document_type, file_url, verification_status, remarks)
    select p_enrollment_id, d.document_type, d.file_url, 'Pending', d.remarks
    from jsonb_to_recordset(p_documents) as d(document_type text, file_url text, remarks text);
  return jsonb_build_object('student_code', allocated_code, 'already_submitted', false);
end;
$$;
revoke all on function public.complete_student_intake(uuid,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.complete_student_intake(uuid,text,jsonb,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
