import { supabase } from "@/lib/supabaseClient";

export type AuditCategory =
  | "approvals"
  | "settings"
  | "officers"
  | "events"
  | "forms"
  | "tasks"
  | "members"
  | "security"
  | "messaging";

export type AuditEventRow = {
  id: string;
  org_id: string;
  actor_id: string | null;
  category: AuditCategory | string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditActorProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
};

export type AuditSnapshot = {
  events: AuditEventRow[];
  actorsById: Record<string, AuditActorProfile>;
};

export type LogAuditEventInput = {
  orgId?: string | null;
  category: AuditCategory | string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  title: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAuditEvent(input: LogAuditEventInput) {
  if (!input.orgId) return null;

  const { data, error } = await supabase.rpc("log_audit_event", {
    target_org_id: input.orgId,
    target_category: input.category,
    target_action: input.action,
    target_entity_type: input.entityType ?? null,
    target_entity_id: input.entityId ?? null,
    target_title: input.title,
    target_summary: input.summary ?? null,
    target_metadata: input.metadata ?? {},
  });

  if (error) throw error;
  return data as string | null;
}

export async function logAuditEventSafe(input: LogAuditEventInput) {
  try {
    await logAuditEvent(input);
  } catch (error) {
    console.error("Audit log failed", error);
  }
}

export async function fetchAuditSnapshot(orgId: string, limit = 300): Promise<AuditSnapshot> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, org_id, actor_id, category, action, entity_type, entity_id, title, summary, metadata, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const events = (data ?? []) as AuditEventRow[];
  const actorIds = Array.from(new Set(events.map((event) => event.actor_id).filter(Boolean))) as string[];

  if (actorIds.length === 0) {
    return { events, actorsById: {} };
  }

  const { data: actorsData, error: actorsError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .in("id", actorIds);

  if (actorsError) throw actorsError;

  const actorsById = Object.fromEntries(((actorsData ?? []) as AuditActorProfile[]).map((actor) => [actor.id, actor]));
  return { events, actorsById };
}
