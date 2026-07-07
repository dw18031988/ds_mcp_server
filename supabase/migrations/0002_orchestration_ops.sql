create table if not exists agents (
  id text primary key,
  name text not null,
  status text not null default 'available',
  version text,
  metadata_json jsonb not null default '{}'::jsonb,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists agent_capabilities (
  agent_id text not null references agents(id) on delete cascade,
  capability text not null,
  priority int not null default 100,
  created_at timestamptz not null default now(),
  primary key (agent_id, capability)
);

create table if not exists agent_heartbeats (
  id text primary key,
  agent_id text not null references agents(id) on delete cascade,
  status text not null,
  current_task_id text,
  current_lease_id text,
  queue_depth int,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists agent_queue_stats (
  agent_id text primary key references agents(id) on delete cascade,
  queue_depth int not null default 0,
  running_count int not null default 0,
  failed_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists cron_schedules (
  id text primary key,
  workflow_type text not null,
  cron_expression text not null,
  timezone text not null default 'UTC',
  payload_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists retry_policies (
  id text primary key,
  task_type text not null unique,
  max_attempts int not null default 3,
  base_delay_seconds int not null default 30,
  max_delay_seconds int not null default 3600,
  backoff_multiplier numeric not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scheduler_runs (
  id text primary key,
  scheduler_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  summary_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_agents_status_seen on agents(status, last_seen_at desc);
create index if not exists idx_agent_heartbeats_agent_created on agent_heartbeats(agent_id, created_at desc);
create index if not exists idx_cron_schedules_due on cron_schedules(enabled, next_run_at);
create index if not exists idx_scheduler_runs_started on scheduler_runs(started_at desc);
