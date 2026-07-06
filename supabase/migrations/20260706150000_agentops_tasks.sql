create table if not exists public.agentops_tasks (
  id text primary key,
  title text not null,
  description text,
  task_type text not null default 'task',
  source text not null default 'manual',
  source_ref text,
  state text not null default 'draft',
  priority text not null default 'medium',
  parent_task_id text,
  root_task_id text,
  assigned_agent_id text,
  owner_user_id text,
  latest_run_id text,
  run_count integer not null default 0,
  repo_owner text,
  repo_name text,
  repo_branch text,
  pr_number integer,
  pr_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.agentops_task_links (
  id text primary key,
  from_task_id text not null references public.agentops_tasks(id) on delete cascade,
  to_task_id text not null references public.agentops_tasks(id) on delete cascade,
  link_type text not null,
  status text not null default 'active',
  created_by text,
  created_at timestamptz not null default now(),
  constraint agentops_task_links_no_self_link check (from_task_id <> to_task_id)
);

create table if not exists public.agentops_task_events (
  id text primary key,
  task_id text not null references public.agentops_tasks(id) on delete cascade,
  run_id text,
  event_type text not null,
  from_state text,
  to_state text,
  actor text not null default 'system',
  actor_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agentops_agents (
  id text primary key,
  name text not null,
  agent_type text not null,
  workspace_agent_trigger_id text,
  enabled boolean not null default true,
  allowed_modes text[] not null default array['review_only'],
  default_mode text not null default 'review_only',
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agentops_agent_runs (
  id text primary key,
  task_id text references public.agentops_tasks(id) on delete set null,
  agent_id text references public.agentops_agents(id) on delete set null,
  request_id text,
  agent_type text,
  mode text not null default 'review_only',
  conversation_key text,
  idempotency_key text,
  status text not null default 'created',
  input_json jsonb not null default '{}'::jsonb,
  trigger_json jsonb,
  result_json jsonb,
  error text,
  created_at timestamptz not null default now(),
  triggered_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.agentops_approvals (
  id text primary key,
  task_id text not null references public.agentops_tasks(id) on delete cascade,
  run_id text,
  approval_type text not null,
  status text not null default 'pending',
  requested_by text,
  approved_by text,
  reason text,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.agentops_audit_logs (
  id text primary key,
  timestamp timestamptz not null default now(),
  action text not null,
  source text not null,
  task_id text,
  run_id text,
  request_id text,
  owner text,
  repo text,
  branch text,
  path text,
  pr_number integer,
  pr_url text,
  status text not null,
  message text,
  payload jsonb
);

create index if not exists agentops_tasks_state_idx on public.agentops_tasks(state);
create index if not exists agentops_tasks_updated_at_idx on public.agentops_tasks(updated_at desc);
create index if not exists agentops_task_links_from_idx on public.agentops_task_links(from_task_id);
create index if not exists agentops_task_links_to_idx on public.agentops_task_links(to_task_id);
create index if not exists agentops_task_events_task_idx on public.agentops_task_events(task_id, created_at);
create index if not exists agentops_agent_runs_task_idx on public.agentops_agent_runs(task_id, created_at desc);
create index if not exists agentops_audit_logs_timestamp_idx on public.agentops_audit_logs(timestamp desc);
