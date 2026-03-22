import { supabase } from "@/lib/supabaseClient";

export const MESSAGE_PAGE_SIZE = 30;
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
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

export function resolveOrgId(profile: MessagingProfile | null): string {
  if (profile?.org_id) return profile.org_id;

  if (typeof window !== "undefined") {
    const localOrg =
      window.localStorage.getItem("cc.workspace.org_id") ||
      window.localStorage.getItem("cc.settings.org_id");
    if (localOrg) return localOrg;
  }

  return DEFAULT_ORG_ID;
}

export async function getMessagingBackend(): Promise<MessagingBackend> {
  return "dedicated";
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
  const result = await supabase
    .from("admin_messages")
    .insert({
      conversation_id: params.conversationId,
      org_id: params.orgId,
      sender_id: params.senderId,
      sender_role: params.senderType,
      body: params.body,
    })
    .select("id, conversation_id, org_id, sender_id, sender_role, body, created_at")
    .single();

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
    const result = await supabase.rpc("ensure_admin_club_conversation", {
      target_club_id: params.targetId,
    });

    if (result.error) throw result.error;
    return result.data as string;
  }

  if (params.targetType === "prospect") {
    const result = await supabase.rpc("ensure_prospect_conversation", {
      target_prospect_id: params.targetId,
    });

    if (result.error) throw result.error;
    return result.data as string;
  }

  const result = await supabase.rpc("ensure_admin_dm_conversation", {
    target_admin_user_id: params.targetId,
  });

  if (result.error) throw result.error;
  return result.data as string;
}

export function resolveSenderType(profile: MessagingProfile | null): MemberType {
  return isAdminRole(profile?.role) ? "admin" : "club";
}

export async function syncClubMessagingPaths() {
  const result = await supabase.rpc("sync_admin_club_conversations");
  if (result.error) throw result.error;

  const payload = (result.data ?? {}) as {
    club_count?: number;
    created_count?: number;
    connected_count?: number;
  };

  return {
    clubCount: payload.club_count ?? 0,
    createdCount: payload.created_count ?? 0,
    connectedCount: payload.connected_count ?? 0,
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
  const result = await supabase.rpc("get_admin_conversation_access_state", {
    target_conversation_id: params.conversationId,
  });

  if (result.error) throw result.error;

  const payload = (result.data ?? {}) as {
    directMembers?: ConversationAccessMember[];
    suggestedMembers?: ConversationAccessMember[];
    latestMessageAt?: string | null;
    latestMessagePreview?: string | null;
    readSummary?: {
      totalMembers?: number;
      adminMembers?: number;
      clubMembers?: number;
      seenLatestCount?: number;
    } | null;
  };

  return {
    directMembers: payload.directMembers ?? [],
    suggestedMembers: payload.suggestedMembers ?? [],
    latestMessageAt: payload.latestMessageAt ?? null,
    latestMessagePreview: payload.latestMessagePreview ?? "",
    readSummary: {
      totalMembers: payload.readSummary?.totalMembers ?? 0,
      adminMembers: payload.readSummary?.adminMembers ?? 0,
      clubMembers: payload.readSummary?.clubMembers ?? 0,
      seenLatestCount: payload.readSummary?.seenLatestCount ?? 0,
    },
  } satisfies ConversationAccessState;
}

export async function addConversationAccess(params: {
  conversationId: string;
  userId: string;
}) {
  const result = await supabase.rpc("add_admin_conversation_member", {
    target_conversation_id: params.conversationId,
    target_user_id: params.userId,
  });

  if (result.error) throw result.error;
}

export async function removeConversationAccess(params: {
  conversationId: string;
  userId: string;
}) {
  const result = await supabase.rpc("remove_admin_conversation_member", {
    target_conversation_id: params.conversationId,
    target_user_id: params.userId,
  });

  if (result.error) throw result.error;
}
