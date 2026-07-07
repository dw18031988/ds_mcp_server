alter table if exists public.agentops_tasks
  add column if not exists idempotency_key text;

alter table if exists public.agentops_task_events
  add column if not exists idempotency_key text;

create unique index if not exists agentops_tasks_idempotency_key_uidx
  on public.agentops_tasks(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists agentops_task_events_task_id_idempotency_key_uidx
  on public.agentops_task_events(task_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists agentops_task_links_active_unique_uidx
  on public.agentops_task_links(from_task_id, to_task_id, link_type)
  where status = 'active';
