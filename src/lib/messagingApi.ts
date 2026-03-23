import { supabase } from "@/lib/supabaseClient";
import { resolveCurrentOrgId } from "@/lib/organization";

export const MESSAGE_PAGE_SIZE = 30;
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const ADMIN_ROLES = ["admin", "student_life_admin", "super_admin"];

export type ConversationCategory = "clubs" | "admins" | "prospects";
export type TargetType = "club" | "admin" | "prospect";
export type MemberType = "admin" | "club";
export type MessagingBackend = "dedicated";

export type MessagingProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  role: string | null;
  club_id: string | null;
  org_id?: string | null;
};

export type ConversationSummary = {
  id: string;
  orgId: string;
  category: ConversationCategory;
  targetType: TargetType;
  targetId: string;
  title: string;
  avatarUrl: string | null;
  lastMessageAt: string | null;
  updatedAt: string;
  preview: string;
  unreadCount: number;
  adminMemberCount: number;
  clubMemberCount: number;
  needsAttention: boolean;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  orgId: string;
  senderId: string;
  senderType: MemberType;
  body: string;
  createdAt: string;
};

export type RecipientTab = "club" | "admin" | "prospect";

export type RecipientOption = {
  key: string;
  targetType: TargetType;
  targetId: string;
  label: string;
  subtitle: string | null;
  avatarUrl: string | null;
};

export type MessagingDirectoryUser = {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
  clubId: string | null;
};

export type ConversationAccessMember = {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  memberType: MemberType;
  clubId: string | null;
  isCurrentUser: boolean;
  isSuggested: boolean;
  lastReadAt: string | null;
  readState: "seen_latest" | "read_earlier" | "unread" | "no_messages" | "not_added";
  tags: string[];
};

export type ConversationAccessState = {
  directMembers: ConversationAccessMember[];
  suggestedMembers: ConversationAccessMember[];
  latestMessageAt: string | null;
  latestMessagePreview: string;
  readSummary: {
    totalMembers: number;
    adminMembers: number;
    clubMembers: number;
    seenLatestCount: number;
  };
};

export type ClubMessagingSyncResult = {
  clubCount: number;
  createdCount: number;
  connectedCount: number;
};

type ConversationRow = {
  id: string;
  org_id: string;
  type: string;
  club_id: string | null;
  prospect_id: string | null;
  subject: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

type AdminConversationRow = {
  id: string;
  org_id: string;
  type: string;
  club_id: string | null;
  prospect_id: string | null;
  updated_at: string;
  last_message_at: string | null;
  subject: string | null;
};

type AdminConversationMemberRow = {
  conversation_id: string;
  org_id: string;
  user_id: string;
  role: MemberType;
  club_id: string | null;
};

type AdminMessageRow = {
  id: string;
  conversation_id: string;
  org_id: string;
  sender_id: string;
  sender_role: MemberType;
  body: string;
  created_at: string;
};

type MessageReadRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  role?: string | null;
  club_id?: string | null;
  org_id?: string | null;
};

type ClubRow = {
  id: string;
  name: string;
  cover_image_url?: string | null;
  approved?: boolean | null;
  org_id?: string | null;
  primary_user_id?: string | null;
};

type ProspectRow = {
  id: string;
  name: string;
  cover_image_url?: string | null;
  status?: string | null;
  org_id?: string | null;
};

const STAGE_TO_SUBTITLE: Record<string, string> = {
  new: "New prospect",
  reviewing: "Under review",
  needs_documents: "Needs documents",
  meeting_scheduled: "Meeting scheduled",
  approved: "Approved prospect",
  rejected: "Rejected prospect",
  converted: "Converted prospect",
};

function normalizePreview(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return "No messages yet";
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function isAdminRole(role: string | null | undefined) {
  return ADMIN_ROLES.includes(role ?? "");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function mapDirectoryUser(profile: MessagingProfile & { avatar_url?: string | null } & { role?: string | null }): MessagingDirectoryUser {
  return {
    id: profile.id,
    fullName: profile.full_name ?? null,
    email: profile.email ?? null,
    avatarUrl: profile.avatar_url ?? null,
    role: profile.role ?? null,
    clubId: profile.club_id ?? null,
  };
}

export function resolveOrgId(profile: MessagingProfile | null): string | null {
  return resolveCurrentOrgId(profile?.org_id);
}

export async function getMessagingBackend(): Promise<MessagingBackend> {
  return "dedicated";
}

type MessagingAdminPayload =
  | { action: "ensure-club-conversation"; clubId: string }
  | { action: "ensure-prospect-conversation"; prospectId: string }
  | { action: "ensure-admin-conversation"; targetAdminUserId: string }
  | { action: "sync-club-conversations" }
  | { action: "add-conversation-member"; conversationId: string; userId: string }
  | { action: "remove-conversation-member"; conversationId: string; userId: string }
  | { action: "ensure-self-member"; conversationId: string; role: MemberType };

async function callMessagingAdminApi(payload: MessagingAdminPayload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You must be signed in to manage messaging.");
  }

  const response = await fetch("/api/messaging-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await parseApiJson(response);
  if (!response.ok) {
    throw new Error(body?.error || "Unable to update messaging state.");
  }

  return body;
}

async function parseApiJson(response: Response): Promise<{ error?: string; [key: string]: unknown } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchUnreadCounts(params: {
  conversationIds: string[];
  userId: string;
}) {
  const { conversationIds, userId } = params;
  if (conversationIds.length === 0) return new Map<string, number>();

  const readsResult = await supabase
    .from("admin_message_reads")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  if (readsResult.error) throw readsResult.error;

  const readsMap = new Map<string, string>();
  ((readsResult.data ?? []) as MessageReadRow[]).forEach((row) =>
    readsMap.set(row.conversation_id, row.last_read_at ?? EPOCH_ISO),
  );

  const messagesResult = await supabase
    .from("admin_messages")
    .select("conversation_id, sender_id, created_at")
    .in("conversation_id", conversationIds)
    .neq("sender_id", userId)
    .order("created_at", { ascending: false });

  if (messagesResult.error) throw messagesResult.error;

  const counts = new Map<string, number>();
  ((messagesResult.data ?? []) as Pick<AdminMessageRow, "conversation_id" | "sender_id" | "created_at">[]).forEach(
    (row) => {
      const threshold = readsMap.get(row.conversation_id) ?? EPOCH_ISO;
      if (row.created_at > threshold) {
        counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
      }
    },
  );

  return counts;
}

export async function fetchConversationSummaries(params: {
  userId: string;
  orgId: string;
  search: string;
}) {
  const { userId, orgId, search } = params;

  const membershipsResult = await supabase
    .from("admin_conversation_members")
    .select("conversation_id")
    .eq("user_id", userId)
    .eq("org_id", orgId);

  if (membershipsResult.error) throw membershipsResult.error;

  const conversationIds = ((membershipsResult.data ?? []) as { conversation_id: string }[]).map(
    (row) => row.conversation_id,
  );

  if (conversationIds.length === 0) return [] as ConversationSummary[];

  const [conversationsResult, membersResult, latestMessagesResult, unreadCounts] = await Promise.all([
    supabase
      .from("admin_conversations")
      .select("id, org_id, type, club_id, prospect_id, updated_at, last_message_at, subject")
      .in("id", conversationIds)
      .eq("org_id", orgId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("admin_conversation_members")
      .select("conversation_id, org_id, user_id, role, club_id")
      .in("conversation_id", conversationIds),
    supabase
      .from("admin_messages")
      .select("conversation_id, sender_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    fetchUnreadCounts({ conversationIds, userId }),
  ]);

  if (conversationsResult.error) throw conversationsResult.error;
  if (membersResult.error) throw membersResult.error;
  if (latestMessagesResult.error) throw latestMessagesResult.error;

  const conversations = (conversationsResult.data ?? []) as AdminConversationRow[];
  const memberRows = (membersResult.data ?? []) as AdminConversationMemberRow[];
  const latestRows = (latestMessagesResult.data ?? []) as {
    conversation_id: string;
    sender_id: string;
    body: string | null;
    created_at: string;
  }[];

  const membersByConversation = new Map<string, AdminConversationMemberRow[]>();
  memberRows.forEach((row) => {
    const existing = membersByConversation.get(row.conversation_id) ?? [];
    existing.push(row);
    membersByConversation.set(row.conversation_id, existing);
  });

  const latestByConversation = new Map<string, { sender_id: string; body: string | null; created_at: string }>();
  latestRows.forEach((row) => {
    if (!latestByConversation.has(row.conversation_id)) {
      latestByConversation.set(row.conversation_id, row);
    }
  });

  const profileIds = Array.from(new Set(memberRows.map((row) => row.user_id)));
  const clubIds = Array.from(
    new Set(
      [
        ...conversations.map((row) => row.club_id),
        ...memberRows.map((row) => row.club_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const prospectIds = Array.from(
    new Set(
      conversations.map((row) => row.prospect_id).filter((value): value is string => Boolean(value)),
    ),
  );

  const [profilesResult, clubsResult, prospectsResult] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email, avatar_url, role, club_id").in("id", profileIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    clubIds.length > 0
      ? supabase.from("clubs").select("id, name, cover_image_url, approved").in("id", clubIds)
      : Promise.resolve({ data: [] as ClubRow[], error: null }),
    prospectIds.length > 0
      ? supabase.from("prospect_clubs").select("id, name, cover_image_url, status").in("id", prospectIds)
      : Promise.resolve({ data: [] as ProspectRow[], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (clubsResult.error) throw clubsResult.error;
  if (prospectsResult.error) throw prospectsResult.error;

  const profilesMap = new Map<string, ProfileRow>();
  ((profilesResult.data ?? []) as ProfileRow[]).forEach((row) => profilesMap.set(row.id, row));

  const clubsMap = new Map<string, ClubRow>();
  ((clubsResult.data ?? []) as ClubRow[]).forEach((row) => clubsMap.set(row.id, row));
  const prospectsMap = new Map<string, ProspectRow>();
  ((prospectsResult.data ?? []) as ProspectRow[]).forEach((row) => prospectsMap.set(row.id, row));

  const term = search.trim().toLowerCase();

  const summaries = conversations.map((conversation) => {
    const members = membersByConversation.get(conversation.id) ?? [];
    const adminMemberCount = members.filter((member) => member.role === "admin").length;
    const clubMemberCount = members.filter((member) => member.role === "club").length;
    const targetClubId =
      conversation.club_id ??
      members.find((member) => member.role === "club" && member.club_id)?.club_id ??
      null;
    const targetProspectId = conversation.prospect_id ?? null;
    const latest = latestByConversation.get(conversation.id);

    let category: ConversationCategory = "admins";
    let targetType: TargetType = "admin";
    let targetId = conversation.id;
    let title = conversation.subject?.trim() || "Admin chat";
    let avatarUrl: string | null = null;

    if (targetProspectId || conversation.type === "prospect") {
      const prospect = targetProspectId ? prospectsMap.get(targetProspectId) : null;
      category = "prospects";
      targetType = "prospect";
      targetId = targetProspectId ?? conversation.id;
      title = prospect?.name ?? conversation.subject?.trim() ?? "Prospect pipeline";
      avatarUrl = prospect?.cover_image_url ?? null;
    } else if (targetClubId) {
      const club = clubsMap.get(targetClubId);
      category = "clubs";
      targetType = "club";
      targetId = targetClubId;
      title = club?.name ?? conversation.subject?.trim() ?? "Club chat";
      avatarUrl = club?.cover_image_url ?? null;
    } else {
      const otherAdmin = members.find((member) => member.user_id !== userId) ?? members[0] ?? null;
      if (otherAdmin) {
        const otherProfile = profilesMap.get(otherAdmin.user_id);
        targetId = otherAdmin.user_id;
        title = otherProfile?.full_name || otherProfile?.email || "Admin chat";
        avatarUrl = otherProfile?.avatar_url ?? null;
      }
    }

    const lastMessageAt = latest?.created_at ?? conversation.last_message_at ?? null;

    return {
      id: conversation.id,
      orgId: conversation.org_id,
      category,
      targetType,
      targetId,
      title,
      avatarUrl,
      lastMessageAt,
      updatedAt: conversation.updated_at,
      preview:
        !latest?.body && targetClubId && clubMemberCount === 0
          ? "No club-side account is linked yet. Add access before expecting replies."
          : !latest?.body && targetProspectId
            ? "Internal prospect thread ready. Add notes, requirements, and next steps here."
          : normalizePreview(latest?.body),
      unreadCount: unreadCounts.get(conversation.id) ?? 0,
      adminMemberCount,
      clubMemberCount,
      needsAttention: Boolean(targetClubId && clubMemberCount === 0),
    } satisfies ConversationSummary;
  });

  const filtered = term
    ? summaries.filter((conversation) =>
        [conversation.title, conversation.preview, conversation.category].some((value) =>
          value.toLowerCase().includes(term),
        ),
      )
    : summaries;

  return filtered.sort((a, b) => {
    const aDate = a.lastMessageAt ?? a.updatedAt;
    const bDate = b.lastMessageAt ?? b.updatedAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

export async function fetchConversationMessages(params: {
  conversationId: string;
  page: number;
  pageSize?: number;
}) {
  const { conversationId, page, pageSize = MESSAGE_PAGE_SIZE } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const result = await supabase
    .from("admin_messages")
    .select("id, conversation_id, org_id, sender_id, sender_role, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (result.error) throw result.error;

  const rows = (result.data ?? []) as AdminMessageRow[];

  return {
    messages: rows
      .map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        orgId: row.org_id,
        senderId: row.sender_id,
        senderType: row.sender_role,
        body: row.body,
        createdAt: row.created_at,
      } satisfies ConversationMessage))
      .reverse(),
    hasMore: rows.length === pageSize,
  };
}

export async function markConversationRead(params: {
  conversationId: string;
  orgId: string;
  userId: string;
  at?: string;
}) {
  const lastReadAt = params.at ?? new Date().toISOString();

  const result = await supabase
    .from("admin_message_reads")
    .upsert(
      {
        conversation_id: params.conversationId,
        org_id: params.orgId,
        user_id: params.userId,
        last_read_at: lastReadAt,
      },
      { onConflict: "conversation_id,user_id" },
    );

  if (result.error) throw result.error;
}

export async function sendConversationMessage(params: {
  conversationId: string;
  orgId: string;
  senderId: string;
  senderType: MemberType;
  body: string;
}) {
  const senderProfileResult = await supabase
    .from("profiles")
    .select("id, role, club_id, org_id")
    .eq("id", params.senderId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (senderProfileResult.error) throw senderProfileResult.error;

  const senderProfile = senderProfileResult.data as Pick<ProfileRow, "id" | "role" | "club_id" | "org_id"> | null;
  const effectiveSenderType: MemberType = senderProfile && isAdminRole(senderProfile.role) ? "admin" : params.senderType;
  const effectiveClubId = effectiveSenderType === "club" ? senderProfile?.club_id ?? null : null;

  if (effectiveSenderType === "admin") {
    try {
      await callMessagingAdminApi({
        action: "ensure-self-member",
        conversationId: params.conversationId,
        role: "admin",
      });
    } catch {
      await ensureCurrentUserInConversation(
        params.conversationId,
        params.orgId,
        params.senderId,
        "admin",
        null,
      );
    }
  }

  const insertPayload = {
    conversation_id: params.conversationId,
    org_id: params.orgId,
    sender_id: params.senderId,
    sender_role: effectiveSenderType,
    body: params.body,
  };

  let result = await supabase
    .from("admin_messages")
    .insert(insertPayload)
    .select("id, conversation_id, org_id, sender_id, sender_role, body, created_at")
    .single();

  if (result.error && effectiveSenderType === "club") {
    try {
      await callMessagingAdminApi({
        action: "ensure-self-member",
        conversationId: params.conversationId,
        role: "club",
      });
    } catch {
      await ensureCurrentUserInConversation(
        params.conversationId,
        params.orgId,
        params.senderId,
        "club",
        effectiveClubId,
      );
    }

    result = await supabase
      .from("admin_messages")
      .insert(insertPayload)
      .select("id, conversation_id, org_id, sender_id, sender_role, body, created_at")
      .single();
  }

  if (result.error) throw result.error;

  const row = result.data as AdminMessageRow;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    orgId: row.org_id,
    senderId: row.sender_id,
    senderType: row.sender_role,
    body: row.body,
    createdAt: row.created_at,
  } satisfies ConversationMessage;
}

export async function fetchRecipientOptions(params: {
  orgId: string;
  tab: RecipientTab;
  search: string;
  currentUserId: string;
}) {
  const { orgId, tab, search, currentUserId } = params;
  const term = search.trim().toLowerCase();

  if (tab === "club" || tab === "prospect") {
    if (tab === "club") {
      const clubsResult = await supabase
        .from("clubs")
        .select("id, name, cover_image_url, approved, org_id")
        .eq("approved", true)
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (clubsResult.error) throw clubsResult.error;

      return ((clubsResult.data ?? []) as ClubRow[])
        .filter((club) => (term ? club.name.toLowerCase().includes(term) : true))
        .map((club) => ({
          key: club.id,
          targetType: "club",
          targetId: club.id,
          label: club.name,
          subtitle: "Official club",
          avatarUrl: club.cover_image_url ?? null,
        } satisfies RecipientOption));
    }

    const prospectsResult = await supabase
      .from("prospect_clubs")
      .select("id, name, cover_image_url, status, org_id")
      .eq("org_id", orgId)
      .in("status", ["new", "reviewing", "needs_documents", "meeting_scheduled", "approved"])
      .order("name", { ascending: true });

    if (prospectsResult.error) throw prospectsResult.error;

    return ((prospectsResult.data ?? []) as ProspectRow[])
      .filter((prospect) => (term ? prospect.name.toLowerCase().includes(term) : true))
      .map((prospect) => ({
        key: prospect.id,
        targetType: "prospect",
        targetId: prospect.id,
        label: prospect.name,
        subtitle: STAGE_TO_SUBTITLE[prospect.status ?? "new"] ?? "Prospect pipeline",
        avatarUrl: prospect.cover_image_url ?? null,
      } satisfies RecipientOption));
  }

  const adminsResult = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url")
    .in("role", ADMIN_ROLES)
    .eq("org_id", orgId)
    .neq("id", currentUserId)
    .order("full_name", { ascending: true });

  if (adminsResult.error) throw adminsResult.error;

  return ((adminsResult.data ?? []) as ProfileRow[])
    .filter((profile) => {
      if (!term) return true;
      const sample = `${profile.full_name ?? ""} ${profile.email ?? ""}`.toLowerCase();
      return sample.includes(term);
    })
    .map((profile) => ({
      key: profile.id,
      targetType: "admin",
      targetId: profile.id,
      label: profile.full_name || profile.email || "Admin",
      subtitle: "Student Life admin",
      avatarUrl: profile.avatar_url ?? null,
    } satisfies RecipientOption));
}

export async function getOrCreateConversation(params: {
  orgId: string;
  currentUserId: string;
  targetType: TargetType;
  targetId: string;
}) {
  if (params.targetType === "club") {
    try {
      const response = await callMessagingAdminApi({
        action: "ensure-club-conversation",
        clubId: params.targetId,
      });
      if (typeof response?.conversationId === "string") return response.conversationId;
    } catch {
      // Fall through to the direct-table fallback for local/dev environments.
    }
    return fallbackGetOrCreateClubConversation(params);
  }

  if (params.targetType === "prospect") {
    try {
      const response = await callMessagingAdminApi({
        action: "ensure-prospect-conversation",
        prospectId: params.targetId,
      });
      if (typeof response?.conversationId === "string") return response.conversationId;
    } catch {
      // Fall through to the direct-table fallback for local/dev environments.
    }
    return fallbackGetOrCreateProspectConversation(params);
  }

  try {
    const response = await callMessagingAdminApi({
      action: "ensure-admin-conversation",
      targetAdminUserId: params.targetId,
    });
    if (typeof response?.conversationId === "string") return response.conversationId;
  } catch {
    // Fall through to the direct-table fallback for local/dev environments.
  }
  return fallbackGetOrCreateAdminConversation(params);
}

export function resolveSenderType(profile: MessagingProfile | null): MemberType {
  return isAdminRole(profile?.role) ? "admin" : "club";
}

export async function syncClubMessagingPaths(params: {
  orgId: string;
  currentUserId: string;
}) {
  try {
    const response = await callMessagingAdminApi({ action: "sync-club-conversations" });
    return {
      clubCount: Number(response?.clubCount ?? 0),
      createdCount: Number(response?.createdCount ?? 0),
      connectedCount: Number(response?.connectedCount ?? 0),
    } satisfies ClubMessagingSyncResult;
  } catch {
    // Fall through to the direct-table fallback for local/dev environments.
  }

  const clubsResult = await supabase
    .from("clubs")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("approved", true);

  if (clubsResult.error) throw clubsResult.error;

  const clubIds = ((clubsResult.data ?? []) as Array<{ id: string }>).map((row) => row.id);
  let createdCount = 0;

  for (const clubId of clubIds) {
    const existingResult = await supabase
      .from("admin_conversations")
      .select("id")
      .eq("org_id", params.orgId)
      .eq("club_id", clubId)
      .limit(1)
      .maybeSingle();

    if (existingResult.error) throw existingResult.error;
    if (!existingResult.data?.id) createdCount += 1;

    await fallbackGetOrCreateClubConversation({
      orgId: params.orgId,
      currentUserId: params.currentUserId,
      targetId: clubId,
    });
  }

  return {
    clubCount: clubIds.length,
    createdCount,
    connectedCount: clubIds.length,
  } satisfies ClubMessagingSyncResult;
}

export async function searchMessagingUsers(params: {
  orgId: string;
  search: string;
  excludeUserIds?: string[];
  currentUserId?: string | null;
}) {
  const { orgId, search, excludeUserIds = [], currentUserId = null } = params;

  const result = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, club_id, org_id")
    .eq("org_id", orgId)
    .order("full_name", { ascending: true })
    .limit(100);

  if (result.error) throw result.error;

  const term = search.trim().toLowerCase();
  const excluded = new Set(excludeUserIds);
  if (currentUserId) excluded.add(currentUserId);

  return ((result.data ?? []) as (MessagingProfile & { avatar_url?: string | null })[])
    .map(mapDirectoryUser)
    .filter((profile) => !excluded.has(profile.id))
    .filter((profile) => {
      if (!term) return true;
      const sample = `${profile.fullName ?? ""} ${profile.email ?? ""}`.toLowerCase();
      return sample.includes(term);
    });
}

export async function findMessagingUserByEmail(params: {
  orgId: string;
  email: string;
}) {
  const normalized = params.email.trim().toLowerCase();
  if (!normalized) return null;

  const result = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, club_id, org_id")
    .eq("org_id", params.orgId)
    .ilike("email", normalized)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) return null;

  return mapDirectoryUser(result.data as MessagingProfile & { avatar_url?: string | null });
}

export async function fetchConversationAccessState(params: {
  conversationId: string;
  clubId: string | null;
}) {
  return fetchConversationAccessStateFallback(params);
}

export async function addConversationAccess(params: {
  conversationId: string;
  userId: string;
}) {
  try {
    await callMessagingAdminApi({
      action: "add-conversation-member",
      conversationId: params.conversationId,
      userId: params.userId,
    });
    return;
  } catch {
    // Fall through to the direct-table fallback for local/dev environments.
  }

  await addConversationAccessFallback(params);
}

export async function removeConversationAccess(params: {
  conversationId: string;
  userId: string;
}) {
  try {
    await callMessagingAdminApi({
      action: "remove-conversation-member",
      conversationId: params.conversationId,
      userId: params.userId,
    });
    return;
  } catch {
    // Fall through to the direct-table fallback for local/dev environments.
  }

  await removeConversationAccessFallback(params);
}

async function fetchConversationAccessStateFallback(params: {
  conversationId: string;
  clubId: string | null;
}) {
  const currentUser = await supabase.auth.getUser();
  const currentUserId = currentUser.data.user?.id ?? null;

  const [conversationResult, membersResult, readsResult, messagesResult] = await Promise.all([
    supabase
      .from("admin_conversations")
      .select("id, org_id, club_id, last_message_at")
      .eq("id", params.conversationId)
      .single(),
    supabase
      .from("admin_conversation_members")
      .select("conversation_id, org_id, user_id, role, club_id")
      .eq("conversation_id", params.conversationId),
    supabase
      .from("admin_message_reads")
      .select("conversation_id, user_id, last_read_at")
      .eq("conversation_id", params.conversationId),
    supabase
      .from("admin_messages")
      .select("body, created_at")
      .eq("conversation_id", params.conversationId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (conversationResult.error) throw conversationResult.error;
  if (membersResult.error) throw membersResult.error;
  if (readsResult.error) throw readsResult.error;
  if (messagesResult.error) throw messagesResult.error;

  const conversation = conversationResult.data as Pick<ConversationRow, "id" | "org_id" | "club_id" | "last_message_at">;
  const members = (membersResult.data ?? []) as AdminConversationMemberRow[];
  const reads = (readsResult.data ?? []) as Array<{ conversation_id: string; user_id: string; last_read_at: string | null }>;
  const latestMessage = ((messagesResult.data ?? []) as Array<{ body: string | null; created_at: string }>)[0] ?? null;

  const profileIds = unique(members.map((member) => member.user_id));
  const [profilesResult, suggestedUsersResult] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email, avatar_url, role, club_id").in("id", profileIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    conversation.club_id
      ? supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, role, club_id")
          .eq("club_id", conversation.club_id)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (suggestedUsersResult.error) throw suggestedUsersResult.error;

  const profilesMap = new Map<string, ProfileRow>();
  ((profilesResult.data ?? []) as ProfileRow[]).forEach((row) => profilesMap.set(row.id, row));

  const readsMap = new Map<string, string | null>();
  reads.forEach((row) => readsMap.set(row.user_id, row.last_read_at ?? null));

  const latestAt = latestMessage?.created_at ?? conversation.last_message_at ?? null;
  const directMembers = members
    .map((member) => {
      const profile = profilesMap.get(member.user_id);
      const lastReadAt = readsMap.get(member.user_id) ?? null;
      const readState: ConversationAccessMember["readState"] =
        !latestAt ? "no_messages" : !lastReadAt ? "unread" : lastReadAt >= latestAt ? "seen_latest" : "read_earlier";

      return {
        id: member.user_id,
        fullName: profile?.full_name ?? null,
        email: profile?.email ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        memberType: member.role,
        clubId: member.club_id ?? profile?.club_id ?? null,
        isCurrentUser: member.user_id === currentUserId,
        isSuggested: false,
        lastReadAt,
        readState,
        tags: [
          member.role === "admin" ? "Admin" : "Club access",
          member.club_id || profile?.club_id ? "Club-linked" : null,
          member.user_id === currentUserId ? "You" : null,
        ].filter((value): value is string => Boolean(value)),
      } satisfies ConversationAccessMember;
    })
    .sort((a, b) => {
      if (a.memberType !== b.memberType) return a.memberType === "admin" ? -1 : 1;
      return (a.fullName ?? a.email ?? a.id).localeCompare(b.fullName ?? b.email ?? b.id);
    });

  const directMemberIds = new Set(directMembers.map((member) => member.id));
  const suggestedMembers = ((suggestedUsersResult.data ?? []) as ProfileRow[])
    .filter((profile) => !directMemberIds.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      fullName: profile.full_name ?? null,
      email: profile.email ?? null,
      avatarUrl: profile.avatar_url ?? null,
      memberType: isAdminRole(profile.role) ? "admin" : "club",
      clubId: profile.club_id ?? null,
      isCurrentUser: profile.id === currentUserId,
      isSuggested: true,
      lastReadAt: null,
      readState: "not_added",
      tags: ["Club-linked"],
    } satisfies ConversationAccessMember));

  return {
    directMembers,
    suggestedMembers,
    latestMessageAt: latestAt,
    latestMessagePreview: latestMessage?.body ?? "",
    readSummary: {
      totalMembers: directMembers.length,
      adminMembers: directMembers.filter((member) => member.memberType === "admin").length,
      clubMembers: directMembers.filter((member) => member.memberType === "club").length,
      seenLatestCount: directMembers.filter((member) => member.readState === "seen_latest").length,
    },
  } satisfies ConversationAccessState;
}

async function addConversationAccessFallback(params: {
  conversationId: string;
  userId: string;
}) {
  const [conversationResult, profileResult] = await Promise.all([
    supabase
      .from("admin_conversations")
      .select("id, org_id, club_id")
      .eq("id", params.conversationId)
      .single(),
    supabase
      .from("profiles")
      .select("id, role, club_id, org_id")
      .eq("id", params.userId)
      .single(),
  ]);

  if (conversationResult.error) throw conversationResult.error;
  if (profileResult.error) throw profileResult.error;

  const conversation = conversationResult.data as Pick<ConversationRow, "id" | "org_id" | "club_id">;
  const profile = profileResult.data as Pick<ProfileRow, "id" | "role" | "club_id" | "org_id">;

  if (profile.org_id !== conversation.org_id) {
    throw new Error("User not found in this workspace.");
  }

  const role: MemberType = isAdminRole(profile.role) ? "admin" : "club";
  const clubId = role === "club" ? profile.club_id ?? conversation.club_id ?? null : null;

  const result = await supabase.from("admin_conversation_members").upsert(
    {
      conversation_id: params.conversationId,
      org_id: conversation.org_id,
      user_id: params.userId,
      role,
      club_id: clubId,
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (result.error) throw result.error;
}

async function removeConversationAccessFallback(params: {
  conversationId: string;
  userId: string;
}) {
  const membersResult = await supabase
    .from("admin_conversation_members")
    .select("user_id, role, org_id")
    .eq("conversation_id", params.conversationId);

  if (membersResult.error) throw membersResult.error;

  const members = (membersResult.data ?? []) as Array<{ user_id: string; role: MemberType; org_id: string }>;
  const target = members.find((member) => member.user_id === params.userId) ?? null;
  if (!target) {
    throw new Error("Conversation member not found.");
  }

  if (target.role === "admin" && members.filter((member) => member.role === "admin").length <= 1) {
    throw new Error("Cannot remove the last admin from this conversation.");
  }

  const [deleteReadsResult, deleteMembersResult] = await Promise.all([
    supabase
      .from("admin_message_reads")
      .delete()
      .eq("conversation_id", params.conversationId)
      .eq("user_id", params.userId),
    supabase
      .from("admin_conversation_members")
      .delete()
      .eq("conversation_id", params.conversationId)
      .eq("user_id", params.userId),
  ]);

  if (deleteReadsResult.error) throw deleteReadsResult.error;
  if (deleteMembersResult.error) throw deleteMembersResult.error;
}

async function fallbackGetOrCreateClubConversation(params: {
  orgId: string;
  currentUserId: string;
  targetId: string;
}) {
  const existingResult = await supabase
    .from("admin_conversations")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("club_id", params.targetId)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;
  if (existingResult.data?.id) {
    await ensureCurrentUserInConversation(existingResult.data.id, params.orgId, params.currentUserId, "admin", null);
    return existingResult.data.id as string;
  }

  const clubResult = await supabase
    .from("clubs")
    .select("id, name, primary_user_id, org_id")
    .eq("id", params.targetId)
    .eq("org_id", params.orgId)
    .single();

  if (clubResult.error) throw clubResult.error;

  const club = clubResult.data as Pick<ClubRow, "id" | "name" | "primary_user_id" | "org_id">;
  const createResult = await supabase
    .from("admin_conversations")
    .insert({
      org_id: params.orgId,
      club_id: club.id,
      type: "club",
      created_by: params.currentUserId,
      subject: club.name,
    })
    .select("id")
    .single();

  if (createResult.error) throw createResult.error;

  const conversationId = (createResult.data as { id: string }).id;
  await ensureCurrentUserInConversation(conversationId, params.orgId, params.currentUserId, "admin", null);

  const [officersResult, clubProfilesResult] = await Promise.all([
    supabase.from("officers").select("user_id").eq("club_id", club.id).not("user_id", "is", null),
    supabase.from("profiles").select("id").eq("club_id", club.id),
  ]);

  if (officersResult.error) throw officersResult.error;
  if (clubProfilesResult.error) throw clubProfilesResult.error;

  const clubUserIds = unique(
    [
      club.primary_user_id ?? null,
      ...((officersResult.data ?? []) as Array<{ user_id: string | null }>).map((row) => row.user_id),
      ...((clubProfilesResult.data ?? []) as Array<{ id: string }>).map((row) => row.id),
    ].filter((value): value is string => Boolean(value)),
  );

  if (clubUserIds.length > 0) {
    const insertResult = await supabase.from("admin_conversation_members").upsert(
      clubUserIds.map((userId) => ({
        conversation_id: conversationId,
        org_id: params.orgId,
        user_id: userId,
        role: "club" as const,
        club_id: club.id,
      })),
      { onConflict: "conversation_id,user_id" },
    );

    if (insertResult.error) throw insertResult.error;
  }

  await markConversationRead({
    conversationId,
    orgId: params.orgId,
    userId: params.currentUserId,
  });

  return conversationId;
}

async function fallbackGetOrCreateProspectConversation(params: {
  orgId: string;
  currentUserId: string;
  targetId: string;
}) {
  const existingResult = await supabase
    .from("admin_conversations")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("prospect_id", params.targetId)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;
  if (existingResult.data?.id) {
    await ensureCurrentUserInConversation(existingResult.data.id, params.orgId, params.currentUserId, "admin", null);
    return existingResult.data.id as string;
  }

  const prospectResult = await supabase
    .from("prospect_clubs")
    .select("id, name, org_id")
    .eq("id", params.targetId)
    .eq("org_id", params.orgId)
    .single();

  if (prospectResult.error) throw prospectResult.error;

  const prospect = prospectResult.data as Pick<ProspectRow, "id" | "name" | "org_id">;
  const createResult = await supabase
    .from("admin_conversations")
    .insert({
      org_id: params.orgId,
      prospect_id: prospect.id,
      type: "prospect",
      created_by: params.currentUserId,
      subject: prospect.name,
    })
    .select("id")
    .single();

  if (createResult.error) throw createResult.error;

  const conversationId = (createResult.data as { id: string }).id;
  await ensureCurrentUserInConversation(conversationId, params.orgId, params.currentUserId, "admin", null);
  await markConversationRead({
    conversationId,
    orgId: params.orgId,
    userId: params.currentUserId,
  });

  return conversationId;
}

async function fallbackGetOrCreateAdminConversation(params: {
  orgId: string;
  currentUserId: string;
  targetId: string;
}) {
  const membershipsResult = await supabase
    .from("admin_conversation_members")
    .select("conversation_id, user_id")
    .in("user_id", [params.currentUserId, params.targetId]);

  if (membershipsResult.error) throw membershipsResult.error;

  const memberships = (membershipsResult.data ?? []) as Array<{ conversation_id: string; user_id: string }>;
  const targetConversationIds = unique(
    memberships
      .filter((row) => row.user_id === params.currentUserId)
      .map((row) => row.conversation_id),
  ).filter((conversationId) =>
    memberships.some((row) => row.user_id === params.targetId && row.conversation_id === conversationId),
  );

  if (targetConversationIds.length > 0) {
    const conversationResult = await supabase
      .from("admin_conversations")
      .select("id")
      .eq("org_id", params.orgId)
      .in("id", targetConversationIds)
      .is("club_id", null)
      .is("prospect_id", null)
      .eq("type", "admin")
      .limit(1)
      .maybeSingle();

    if (conversationResult.error) throw conversationResult.error;
    if (conversationResult.data?.id) {
      return conversationResult.data.id as string;
    }
  }

  const createResult = await supabase
    .from("admin_conversations")
    .insert({
      org_id: params.orgId,
      type: "admin",
      created_by: params.currentUserId,
      subject: null,
    })
    .select("id")
    .single();

  if (createResult.error) throw createResult.error;

  const conversationId = (createResult.data as { id: string }).id;
  const insertMembersResult = await supabase.from("admin_conversation_members").upsert(
    [
      {
        conversation_id: conversationId,
        org_id: params.orgId,
        user_id: params.currentUserId,
        role: "admin" as const,
        club_id: null,
      },
      {
        conversation_id: conversationId,
        org_id: params.orgId,
        user_id: params.targetId,
        role: "admin" as const,
        club_id: null,
      },
    ],
    { onConflict: "conversation_id,user_id" },
  );

  if (insertMembersResult.error) throw insertMembersResult.error;

  await markConversationRead({
    conversationId,
    orgId: params.orgId,
    userId: params.currentUserId,
  });

  return conversationId;
}

async function ensureCurrentUserInConversation(
  conversationId: string,
  orgId: string,
  userId: string,
  role: MemberType,
  clubId: string | null,
) {
  const membershipResult = await supabase.from("admin_conversation_members").upsert(
    {
      conversation_id: conversationId,
      org_id: orgId,
      user_id: userId,
      role,
      club_id: clubId,
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (membershipResult.error) throw membershipResult.error;
}
