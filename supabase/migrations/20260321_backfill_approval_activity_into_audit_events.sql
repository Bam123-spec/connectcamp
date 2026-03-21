insert into public.audit_events (
  org_id,
  actor_id,
  category,
  action,
  entity_type,
  entity_id,
  title,
  summary,
  metadata,
  created_at
)
select
  activity.org_id,
  activity.actor_id,
  'approvals',
  coalesce(nullif(activity.action, ''), 'approval_activity_recorded'),
  requests.entity_type,
  requests.entity_id,
  coalesce(requests.title, 'Approval request activity'),
  coalesce(requests.summary, activity.action),
  jsonb_strip_nulls(
    jsonb_build_object(
      'request_id', activity.request_id,
      'queue', requests.queue,
      'from_status', activity.from_status,
      'to_status', activity.to_status,
      'payload', activity.payload
    )
  ),
  activity.created_at
from public.approval_activity activity
join public.approval_requests requests
  on requests.id = activity.request_id
where not exists (
  select 1
  from public.audit_events existing
  where existing.category = 'approvals'
    and existing.created_at = activity.created_at
    and existing.metadata ->> 'request_id' = activity.request_id::text
    and existing.action = coalesce(nullif(activity.action, ''), 'approval_activity_recorded')
);
