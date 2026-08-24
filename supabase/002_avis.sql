alter table public.concours_contacts
  add column if not exists avis jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
