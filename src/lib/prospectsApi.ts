import { supabase } from "@/lib/supabaseClient";

const ADMIN_ROLES = ["admin", "student_life_admin", "super_admin"];

export type ProspectStatus =
  | "new"
  | "reviewing"
  | "needs_documents"
  | "meeting_scheduled"
  | "approved"
  | "rejected"
  | "converted";

export type ProspectRequirementType =
  | "document"
  | "form"
  | "meeting"
  | "roster"
  | "advisor"
  | "other";

export type ProspectClubRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: ProspectStatus;
  assigned_to: string | null;
  created_by: string | null;
  linked_club_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes_summary: string | null;
  cover_image_url: string | null;
  meeting_scheduled_for: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  converted_at: string | null;
  origin: string;
  created_at: string;
  updated_at: string;
};

export type ProspectRequirementRow = {
  id: string;
  prospect_id: string;
  org_id: string;
  label: string;
  requirement_type: ProspectRequirementType;
  is_required: boolean;
  is_complete: boolean;
  linked_form_id: string | null;
  document_url: string | null;
  notes: string | null;
  display_order: number;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectNoteRow = {
  id: string;
  prospect_id: string;
  org_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type ProspectActivityRow = {
  id: string;
  prospect_id: string;
  org_id: string;
  actor_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ProspectAdminProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
};

export type ProspectFormOption = {
  id: string;
  title: string;
  is_active: boolean;
};

export type ProspectConversationRow = {
  id: string;
  prospect_id: string | null;
  updated_at: string;
};

export type ProspectWorkspace = {
  prospects: ProspectClubRow[];
  requirements: ProspectRequirementRow[];
  notes: ProspectNoteRow[];
  activity: ProspectActivityRow[];
  admins: ProspectAdminProfile[];
  forms: ProspectFormOption[];
  conversations: ProspectConversationRow[];
};

export async function fetchProspectWorkspace(orgId: string): Promise<ProspectWorkspace> {
  const [
    prospectsResult,
    requirementsResult,
    notesResult,
    activityResult,
    adminsResult,
    formsResult,
    conversationsResult,
  ] = await Promise.all([
    supabase
      .from("prospect_clubs")
      .select("id, org_id, name, description, status, assigned_to, created_by, linked_club_id, contact_name, contact_email, contact_phone, notes_summary, cover_image_url, meeting_scheduled_for, approved_at, rejected_at, converted_at, origin, created_at, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("prospect_requirements")
      .select("id, prospect_id, org_id, label, requirement_type, is_required, is_complete, linked_form_id, document_url, notes, display_order, completed_at, completed_by, created_at, updated_at")
      .eq("org_id", orgId)
      .order("display_order", { ascending: true }),
    supabase
      .from("prospect_notes")
      .select("id, prospect_id, org_id, author_id, body, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("prospect_activity")
      .select("id, prospect_id, org_id, actor_id, action, from_status, to_status, payload, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .eq("org_id", orgId)
      .in("role", ADMIN_ROLES)
      .order("full_name", { ascending: true }),
    supabase
      .from("forms")
      .select("id, title, is_active")
      .order("title", { ascending: true }),
    supabase
      .from("admin_conversations")
      .select("id, prospect_id, updated_at")
      .eq("org_id", orgId)
      .eq("type", "prospect"),
  ]);

  if (prospectsResult.error) throw prospectsResult.error;
  if (requirementsResult.error) throw requirementsResult.error;
  if (notesResult.error) throw notesResult.error;
  if (activityResult.error) throw activityResult.error;
  if (adminsResult.error) throw adminsResult.error;
  if (formsResult.error) throw formsResult.error;
  if (conversationsResult.error) throw conversationsResult.error;

  return {
    prospects: (prospectsResult.data ?? []) as ProspectClubRow[],
    requirements: (requirementsResult.data ?? []) as ProspectRequirementRow[],
    notes: (notesResult.data ?? []) as ProspectNoteRow[],
    activity: ((activityResult.data ?? []) as ProspectActivityRow[]).map((row) => ({
      ...row,
      payload: row.payload ?? {},
    })),
    admins: (adminsResult.data ?? []) as ProspectAdminProfile[],
    forms: (formsResult.data ?? []) as ProspectFormOption[],
    conversations: (conversationsResult.data ?? []) as ProspectConversationRow[],
  };
}

export async function createProspectClub(params: {
  orgId: string;
  createdBy: string;
  name: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  assignedTo?: string | null;
  notesSummary?: string;
  coverImageUrl?: string;
  origin?: string;
}) {
  const insertPayload = {
    org_id: params.orgId,
    created_by: params.createdBy,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    contact_name: params.contactName?.trim() || null,
    contact_email: params.contactEmail?.trim() || null,
    contact_phone: params.contactPhone?.trim() || null,
    assigned_to: params.assignedTo ?? null,
    notes_summary: params.notesSummary?.trim() || null,
    cover_image_url: params.coverImageUrl?.trim() || null,
    origin: params.origin?.trim() || "manual",
  };

  const result = await supabase
    .from("prospect_clubs")
    .insert(insertPayload)
    .select("id, org_id, name, description, status, assigned_to, created_by, linked_club_id, contact_name, contact_email, contact_phone, notes_summary, cover_image_url, meeting_scheduled_for, approved_at, rejected_at, converted_at, origin, created_at, updated_at")
    .single();

  if (result.error) throw result.error;

  await ensureProspectConversation((result.data as ProspectClubRow).id);
  return result.data as ProspectClubRow;
}

export async function updateProspectClub(prospectId: string, patch: Partial<Pick<ProspectClubRow, "name" | "description" | "assigned_to" | "contact_name" | "contact_email" | "contact_phone" | "notes_summary" | "cover_image_url" | "meeting_scheduled_for">>) {
  const payload = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]),
  );

  const result = await supabase
    .from("prospect_clubs")
    .update(payload)
    .eq("id", prospectId)
    .select("id, org_id, name, description, status, assigned_to, created_by, linked_club_id, contact_name, contact_email, contact_phone, notes_summary, cover_image_url, meeting_scheduled_for, approved_at, rejected_at, converted_at, origin, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectClubRow;
}

export async function addProspectNote(prospectId: string, body: string) {
  const result = await supabase.rpc("add_prospect_note", {
    target_prospect_id: prospectId,
    note_body: body.trim(),
  });

  if (result.error) throw result.error;
  return result.data as string;
}

export async function setProspectStatus(params: {
  prospectId: string;
  status: ProspectStatus;
  note?: string;
  scheduledFor?: string | null;
}) {
  const result = await supabase.rpc("set_prospect_status", {
    target_prospect_id: params.prospectId,
    next_status: params.status,
    status_note: params.note?.trim() || null,
    scheduled_for: params.scheduledFor ?? null,
  });

  if (result.error) throw result.error;
}

export async function createProspectRequirement(params: {
  prospectId: string;
  orgId: string;
  label: string;
  requirementType: ProspectRequirementType;
  linkedFormId?: string | null;
  documentUrl?: string;
  notes?: string;
  displayOrder?: number;
}) {
  const result = await supabase
    .from("prospect_requirements")
    .insert({
      prospect_id: params.prospectId,
      org_id: params.orgId,
      label: params.label.trim(),
      requirement_type: params.requirementType,
      linked_form_id: params.linkedFormId ?? null,
      document_url: params.documentUrl?.trim() || null,
      notes: params.notes?.trim() || null,
      display_order: params.displayOrder ?? 999,
    })
    .select("id, prospect_id, org_id, label, requirement_type, is_required, is_complete, linked_form_id, document_url, notes, display_order, completed_at, completed_by, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectRequirementRow;
}

export async function updateProspectRequirement(params: {
  requirementId: string;
  updates: Partial<Pick<ProspectRequirementRow, "label" | "requirement_type" | "linked_form_id" | "document_url" | "notes" | "display_order" | "is_complete">>;
  completedBy?: string | null;
}) {
  const patch = { ...params.updates } as Record<string, unknown>;
  if (typeof patch.label === "string") patch.label = patch.label.trim() || null;
  if (typeof patch.document_url === "string") patch.document_url = patch.document_url.trim() || null;
  if (typeof patch.notes === "string") patch.notes = patch.notes.trim() || null;
  if (patch.is_complete === true) {
    patch.completed_at = new Date().toISOString();
    patch.completed_by = params.completedBy ?? null;
  }
  if (patch.is_complete === false) {
    patch.completed_at = null;
    patch.completed_by = null;
  }

  const result = await supabase
    .from("prospect_requirements")
    .update(patch)
    .eq("id", params.requirementId)
    .select("id, prospect_id, org_id, label, requirement_type, is_required, is_complete, linked_form_id, document_url, notes, display_order, completed_at, completed_by, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectRequirementRow;
}

export async function deleteProspectRequirement(requirementId: string) {
  const result = await supabase.from("prospect_requirements").delete().eq("id", requirementId);
  if (result.error) throw result.error;
}

export async function ensureProspectConversation(prospectId: string) {
  const result = await supabase.rpc("ensure_prospect_conversation", {
    target_prospect_id: prospectId,
  });

  if (result.error) throw result.error;
  return result.data as string;
}

export async function convertProspectToClub(prospectId: string) {
  const result = await supabase.rpc("convert_prospect_to_club", {
    target_prospect_id: prospectId,
  });

  if (result.error) throw result.error;
  return result.data as string;
}
