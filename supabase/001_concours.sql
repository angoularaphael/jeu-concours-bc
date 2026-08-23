-- Jeu concours 10 ans Boxing Center
-- Même projet Supabase que BOXPLUS / gestion-manager.

create extension if not exists pgcrypto;

create table if not exists public.concours_contacts (
  id uuid primary key default gen_random_uuid(),
  phone_key text not null unique,
  telephone text not null,
  prenom text,
  nom text,
  email text,
  salle text,
  ville text,
  source text,
  role text not null default 'participant'
    check (role in ('participant', 'invite')),
  status text not null default 'inscrit'
    check (status in (
      'inscrit',
      'invite',
      'inscription_finalisee',
      'doublon',
      'numero_invalide'
    )),
  wa_status text not null default 'pending'
    check (wa_status in ('pending', 'sent', 'skipped', 'error')),
  wa_error text,
  invited_by_id uuid references public.concours_contacts(id),
  invite_token text unique,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists concours_contacts_status_idx
  on public.concours_contacts (status, created_at desc);
create index if not exists concours_contacts_source_idx
  on public.concours_contacts (source, created_at desc);

create table if not exists public.concours_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.concours_contacts(id),
  invitee_id uuid not null references public.concours_contacts(id),
  created_at timestamptz not null default now(),
  unique (inviter_id, invitee_id)
);

create table if not exists public.concours_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  source text,
  contact_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists concours_events_type_idx
  on public.concours_events (type, created_at desc);

create table if not exists public.concours_wa_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  contact_id uuid,
  phone text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists concours_wa_queue_pending_idx
  on public.concours_wa_queue (status, created_at);

alter table public.concours_contacts enable row level security;
alter table public.concours_invites enable row level security;
alter table public.concours_events enable row level security;
alter table public.concours_wa_queue enable row level security;

grant all on public.concours_contacts to service_role;
grant all on public.concours_invites to service_role;
grant all on public.concours_events to service_role;
grant all on public.concours_wa_queue to service_role;

alter table public.tunnel_leads drop constraint if exists tunnel_leads_tunnel_check;
alter table public.tunnel_leads add constraint tunnel_leads_tunnel_check
  check (tunnel in ('offre_29', 'offre_259', 'seance_essai', 'referral_pote', 'concours_10ans'));

alter table public.portet_clients drop constraint if exists portet_clients_source_check;
alter table public.portet_clients add constraint portet_clients_source_check
  check (source in ('chatbot', 'csv', 'xls', 'manual', 'boxplus', 'concours'));

alter table public.concours_contacts
  add column if not exists tickets integer not null default 1;

notify pgrst, 'reload schema';
