-- When each person was last emailed their signature (Team → Send via email).
alter table public.employees add column if not exists signature_sent_at timestamptz;
