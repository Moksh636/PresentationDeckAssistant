-- Deckspace backend foundation.
-- This is a schema draft for Supabase planning. Do not apply to production until
-- auth, tenant boundaries, storage buckets, and migration ownership are reviewed.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  summary text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  setup jsonb not null default '{}'::jsonb,
  collaboration jsonb not null default '{}'::jsonb,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  slide_index integer not null,
  title text not null default '',
  notes text not null default '',
  source_trace jsonb not null default '[]'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, slide_index)
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  uploaded_by_role text not null default 'owner',
  name text not null,
  kind text not null default 'other',
  status text not null default 'uploaded',
  storage_path text,
  size_bytes bigint not null default 0,
  highlight_for_owner_review boolean not null default false,
  extracted_text_preview text not null default '',
  extracted_metadata jsonb not null default '{}'::jsonb,
  possible_audience text not null default '',
  possible_goal text not null default '',
  possible_sections jsonb not null default '[]'::jsonb,
  possible_tone text not null default '',
  source_trace jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  slide_id uuid references public.slides(id) on delete cascade,
  block_id text,
  input_field_key text,
  resolved boolean not null default false,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deck_versions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  label text not null,
  summary text not null default '',
  parent_version_id uuid references public.deck_versions(id) on delete set null,
  source_deck_id uuid references public.decks(id) on delete set null,
  slide_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  report_type text not null,
  title text not null,
  report jsonb not null,
  plain_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.chart_suggestions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  file_id uuid references public.files(id) on delete cascade,
  title text not null,
  chart_type text not null,
  reason text not null default '',
  confidence numeric not null default 0,
  data_preview jsonb not null default '[]'::jsonb,
  status text not null default 'suggested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.decks enable row level security;
alter table public.slides enable row level security;
alter table public.files enable row level security;
alter table public.comments enable row level security;
alter table public.deck_versions enable row level security;
alter table public.generated_reports enable row level security;
alter table public.chart_suggestions enable row level security;

-- RLS planning notes:
-- 1. Owner policies should allow authenticated users to manage rows where owner_user_id = auth.uid().
-- 2. Collaborator policies should be added through a workspace_members table before real sharing ships.
-- 3. Comment-only access should permit comment insert/update but not slide/deck mutation.
-- 4. File upload policies should honor deck collaboration.allowCollaboratorUploads.
-- 5. AI Edge Functions that need elevated access should use SUPABASE_SERVICE_ROLE_KEY server-side only.
