-- Supabase PostgreSQL & Storage Schema for eDNA Biodiversity Explorer
-- Run this SQL in your Supabase SQL Editor before connecting SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

create extension if not exists "pgcrypto";

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  project_id text not null,
  dataset_name text not null,
  file_path text not null,
  file_format text not null check (file_format in ('fasta', 'fa', 'fastq', 'fq', 'csv', 'tsv')),
  file_size_bytes bigint not null default 0,
  sample_id text not null,
  sample_type text not null,
  collection_location text not null,
  collection_date date not null,
  sequencing_platform text,
  marker_gene text,
  description text,
  latitude double precision,
  longitude double precision,
  qc_summary jsonb,
  upload_status text not null default 'uploaded' check (upload_status in ('uploaded', 'validated', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_datasets_firebase_uid on public.datasets (firebase_uid);
create index if not exists idx_datasets_project_id on public.datasets (project_id);

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  firebase_uid text not null,
  analysis_type text not null,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'running', 'completed', 'failed')),
  pipeline_version text not null,
  reference_database text not null,
  is_demonstration boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

create index if not exists idx_analysis_jobs_dataset_id on public.analysis_jobs (dataset_id);
create index if not exists idx_analysis_jobs_firebase_uid on public.analysis_jobs (firebase_uid);

create table if not exists public.taxonomic_results (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analysis_jobs(id) on delete cascade,
  sequence_id text not null,
  kingdom text not null,
  phylum text not null,
  class text not null,
  order_name text not null,
  family text not null,
  genus text not null,
  species text not null,
  read_count integer not null default 1,
  confidence_score double precision not null check (confidence_score >= 0 and confidence_score <= 1),
  reference_database text not null
);

create index if not exists idx_taxonomic_results_analysis_id on public.taxonomic_results (analysis_id);

create table if not exists public.biodiversity_results (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analysis_jobs(id) on delete cascade,
  sample_id text not null,
  species_richness integer not null,
  shannon_index double precision not null,
  simpson_index double precision not null,
  pielou_evenness double precision not null,
  total_reads integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_biodiversity_results_analysis_id on public.biodiversity_results (analysis_id);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_uid text not null,
  action text not null,
  affected_record text not null,
  timestamp timestamptz not null default now(),
  outcome text not null check (outcome in ('success', 'denied', 'error'))
);

create index if not exists idx_admin_audit_logs_timestamp on public.admin_audit_logs (timestamp desc);

-- Enable Row Level Security (RLS) on all tables
alter table public.datasets enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.taxonomic_results enable row level security;
alter table public.biodiversity_results enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Deny direct anon/public access; backend Express API accesses Supabase via service role
-- after verifying Firebase ID tokens and user/admin authorization.
create policy "Deny direct public access to datasets" on public.datasets for all using (false);
create policy "Deny direct public access to analysis_jobs" on public.analysis_jobs for all using (false);
create policy "Deny direct public access to taxonomic_results" on public.taxonomic_results for all using (false);
create policy "Deny direct public access to biodiversity_results" on public.biodiversity_results for all using (false);
create policy "Deny direct public access to admin_audit_logs" on public.admin_audit_logs for all using (false);

-- Create private Supabase Storage bucket for uploaded eDNA files
insert into storage.buckets (id, name, public)
values ('edna-datasets', 'edna-datasets', false)
on conflict (id) do nothing;
