begin;

-- PostgreSQL does not automatically index the referencing side of foreign
-- keys. These indexes keep user deletion and audit-user lookups efficient as
-- operational and chairing data grows.
create index if not exists app_notifications_created_by_idx
  on public.app_notifications (created_by);
create index if not exists chair_sessions_created_by_idx
  on public.chair_committee_sessions (created_by);
create index if not exists chair_sessions_updated_by_idx
  on public.chair_committee_sessions (updated_by);
create index if not exists chair_metrics_updated_by_idx
  on public.chair_delegate_metrics (updated_by);
create index if not exists conference_settings_updated_by_idx
  on public.conference_settings (updated_by);

commit;
