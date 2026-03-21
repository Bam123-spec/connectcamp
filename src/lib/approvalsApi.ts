import { supabase } from "@/lib/supabaseClient";

export type ApprovalStatus = "pending_review" | "in_review" | "changes_requested" | "approved" | "rejected";
export type ApprovalPriority = "low" | "medium" | "high" | "urgent";
export type ApprovalQueue = "clubs" | "events" | "budgets";
export type ApprovalEntityType = "club" | "event" | "budget";

export type ApprovalRequestRow = {
  id: string;
  org_id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  queue: ApprovalQueue;
  title: string;
  summary: string | null;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  submitted_by: string | null;
  assigned_to: string | null;
  decided_by: string | null;
  decision_note: string | null;
  source_created_at: string | null;
  submitted_at: string;
  last_action_at: string;
  decided_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ApprovalCommentRow = {
  id: string;
  request_id: string;
  org_id: string;
  author_id: string;
  body: string;
  kind: "note" | "decision";
  created_at: string;
};

export type ApprovalActivityRow = {
  id: string;
  request_id: string;
  org_id: string;
  actor_id: string | null;
  action: string;
  from_status: ApprovalStatus | null;
  to_status: ApprovalStatus | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type ApprovalAdminProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  org_id: string | null;
};

export type ApprovalClubEntity = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  day: string | null;
  time: string | null;
  email: string | null;
  approved: boolean | null;
  member_count: number | null;
};

export type ApprovalEventEntity = {
  id: string;
  name: string | null;
  description: string | null;
  location: string | null;
  date: string | null;
  time: string | null;
  club_id: string | null;
  approved: boolean | null;
};

export type ApprovalWorkspaceSnapshot = {
  requests: ApprovalRequestRow[];
  comments: ApprovalCommentRow[];
  activity: ApprovalActivityRow[];
  admins: ApprovalAdminProfile[];
  clubsById: Record<string, ApprovalClubEntity>;
  eventsById: Record<string, ApprovalEventEntity>;
};

export async function syncApprovalRequests() {
  const { error } = await supabase.rpc("sync_approval_requests");
  if (error) throw error;
}

export async function fetchApprovalWorkspace(orgId: string): Promise<ApprovalWorkspaceSnapshot> {
  const { data: requestsData, error: requestsError } = await supabase
    .from("approval_requests")
    .select("id, org_id, entity_type, entity_id, queue, title, summary, status, priority, submitted_by, assigned_to, decided_by, decision_note, source_created_at, submitted_at, last_action_at, decided_at, metadata, created_at, updated_at")
    .eq("org_id", orgId)
    .order("last_action_at", { ascending: false });

  if (requestsError) throw requestsError;

  const requests = (requestsData ?? []) as ApprovalRequestRow[];
  const requestIds = requests.map((request) => request.id);
  const clubIds = requests.filter((request) => request.entity_type === "club").map((request) => request.entity_id);
  const eventIds = requests.filter((request) => request.entity_type === "event").map((request) => request.entity_id);

  const [commentsResult, activityResult, adminsResult, clubsResult, eventsResult] = await Promise.all([
    requestIds.length > 0
      ? supabase
          .from("approval_comments")
          .select("id, request_id, org_id, author_id, body, kind, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    requestIds.length > 0
      ? supabase
          .from("approval_activity")
          .select("id, request_id, org_id, actor_id, action, from_status, to_status, payload, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, org_id")
      .eq("org_id", orgId)
      .in("role", ["admin", "student_life_admin", "super_admin"])
      .order("full_name", { ascending: true }),
    clubIds.length > 0
      ? supabase
          .from("clubs")
          .select("id, name, description, location, day, time, email, approved, member_count")
          .in("id", clubIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length > 0
      ? supabase
          .from("events")
          .select("id, name, description, location, date, time, club_id, approved")
          .in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError =
    commentsResult.error ??
    activityResult.error ??
    adminsResult.error ??
    clubsResult.error ??
    eventsResult.error ??
    null;

  if (firstError) throw firstError;

  const clubsById = Object.fromEntries(((clubsResult.data ?? []) as ApprovalClubEntity[]).map((club) => [club.id, club]));
  const eventsById = Object.fromEntries(((eventsResult.data ?? []) as ApprovalEventEntity[]).map((event) => [event.id, event]));

  return {
    requests,
    comments: (commentsResult.data ?? []) as ApprovalCommentRow[],
    activity: (activityResult.data ?? []) as ApprovalActivityRow[],
    admins: (adminsResult.data ?? []) as ApprovalAdminProfile[],
    clubsById,
    eventsById,
  };
}

export async function setApprovalStatus(requestId: string, nextStatus: ApprovalStatus, note?: string) {
  const { error } = await supabase.rpc("set_approval_status", {
    target_request_id: requestId,
    next_status: nextStatus,
    note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
}

export async function assignApprovalRequest(requestId: string, assigneeId: string | null, note?: string) {
  const { error } = await supabase.rpc("assign_approval_request", {
    target_request_id: requestId,
    target_assignee_id: assigneeId,
    note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
}

export async function updateApprovalPriority(requestId: string, nextPriority: ApprovalPriority, note?: string) {
  const { error } = await supabase.rpc("update_approval_priority", {
    target_request_id: requestId,
    next_priority: nextPriority,
    note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
}

export async function addApprovalComment(requestId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { error } = await supabase.rpc("add_approval_comment", {
    target_request_id: requestId,
    body: trimmed,
  });
  if (error) throw error;
}
