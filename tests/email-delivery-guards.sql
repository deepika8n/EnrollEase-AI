-- No messages are sent. The test delivery row is rolled back.
begin;
do $$
declare test_key text := 'test:' || gen_random_uuid()::text;
begin
  if public.claim_email_delivery(test_key, '{}'::jsonb) <> 'claimed' then
    raise exception 'First request must claim delivery';
  end if;
  if public.claim_email_delivery(test_key, '{}'::jsonb) <> 'sending' then
    raise exception 'Concurrent/repeated request must not claim delivery';
  end if;
  update public.email_deliveries set status='sent' where event_key=test_key;
  if public.claim_email_delivery(test_key, '{}'::jsonb) <> 'sent' then
    raise exception 'Completed event must not resend';
  end if;
  update public.email_deliveries set status='uncertain' where event_key=test_key;
  if public.claim_email_delivery(test_key, '{}'::jsonb) <> 'uncertain' then
    raise exception 'Ambiguous delivery must not resend';
  end if;
end $$;
rollback;
