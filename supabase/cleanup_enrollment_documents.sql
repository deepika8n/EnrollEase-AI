-- Keep only the two enrollment document types used by the app now:
--   1. Student Photo
--   2. Aadhaar ID Photo
--
-- Run this in the Supabase SQL Editor to remove older receipt/proof documents.

begin;

delete from public.documents
where coalesce(trim(document_type), '') not in ('Student Photo', 'Aadhaar ID Photo');

commit;

select document_type, count(*) as total
from public.documents
group by document_type
order by document_type;
