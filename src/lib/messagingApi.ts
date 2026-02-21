import { supabase } from "@/lib/supabaseClient";

export const MESSAGE_PAGE_SIZE = 30;
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

export type ConversationCategory = "clubs" | "officers" | "admins" | "others";
export type TargetType = "club" | "officer" | "admin" | "other";
export type MemberType = "admin" | "club" | "officer" | "other";

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

export type RecipientTab = "club" | "officer" | "admin";

export type RecipientOption = {
  key: string;
  targetType: TargetType;
  targetId: string;
  label: string;
  subtitle: string | null;
  avatarUrl: string | null;
};

type ConversationRow = {
  id: string;
  org_id: string;
  category: string;
  target_type: string;
  target_id: string;
  updated_at: string;
  last_message_at: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  user_id: string;
  member_type: MemberType;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  org_id: string;
  sender_id: string;
  sender_type: MemberType;
  body: string;
  created_at: string;
};

type MessagePreviewRow = {
  conversation_id: string;
  body: string;
  created_at: string;
  sender_id: string;
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
  org_id?: string | null;
};

type ClubRow = {
  id: string;
  name: string;
  cover_image_url?: string | null;
  org_id?: string | null;
  primary_user_id?: string | null;
};

type OfficerRow = {
  user_id: string | null;
  club_id: string | null;
  role: string | null;
};

const ADMIN_ROLES = ["admin", "student_life_admin", "super_admin"];

function normalizePreview(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return "No messages yet";
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function normalizeCategory(value: string | null | undefined): ConversationCategory {
  if (value === "clubs" || value === "officers" || value === "admins" || value === "others") {
    return value;
  }
  return "others";
}

function normalizeTargetType(value: string | null | undefined): TargetType {
  if (value === "club" || value === "officer" || value === "admin" || value === "other") {
    return value;
  }
  return "other";
}

function roleToMemberType(role: string | null | undefined, clubId?: string | null): MemberType {
  if (ADMIN_ROLES.includes(role ?? "")) return "admin";
  if (clubId) return "club";
  if (role === "officer") return "officer";
  return "other";
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

async function fetchUnreadCount(conversationId: string, lastReadAt: string, userId: string) {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .gt("created_at", lastReadAt)
    .neq("sender_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function fetchConversationSummaries(params: {
  userId: string;
  orgId: string;
  search: string;
}) {
  const { userId, search } = params;

  const membershipResult = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (membershipResult.error) throw membershipResult.error;

  const membershipRows = (membershipResult.data ?? []) as { conversation_id: string }[];
  const conversationIds = membershipRows.map((row) => row.conversation_id);

  if (conversationIds.length === 0) return [] as ConversationSummary[];

  const [conversationResult, latestMessagesResult, readsResult, membersResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, org_id, category, target_type, target_id, updated_at, last_message_at")
      .in("id", conversationIds)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("messages")
      .select("conversation_id, body, created_at, sender_id")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("message_reads")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", conversationIds),
    supabase
      .from("conversation_members")
      .select("conversation_id, user_id, member_type")
      .in("conversation_id", conversationIds),
  ]);

  if (conversationResult.error) throw conversationResult.error;
  if (latestMessagesResult.error) throw latestMessagesResult.error;
  if (readsResult.error) throw readsResult.error;
  if (membersResult.error) throw membersResult.error;

  const conversations = (conversationResult.data ?? []) as ConversationRow[];
  const latestRows = (latestMessagesResult.data ?? []) as MessagePreviewRow[];
  const readRows = (readsResult.data ?? []) as MessageReadRow[];
  const memberRows = (membersResult.data ?? []) as ConversationMemberRow[];

  const latestByConversation = new Map<string, MessagePreviewRow>();
  latestRows.forEach((row) => {
    if (!latestByConversation.has(row.conversation_id)) {
      latestByConversation.set(row.conversation_id, row);
    }
  });

  const readsMap = new Map<string, string>();
  readRows.forEach((row) => {
    readsMap.set(row.conversation_id, row.last_read_at ?? EPOCH_ISO);
  });

  const membersByConversation = new Map<string, ConversationMemberRow[]>();
  memberRows.forEach((row) => {
    const existing = membersByConversation.get(row.conversation_id) ?? [];
    existing.push(row);
    membersByConversation.set(row.conversation_id, existing);
  });

  const clubTargetIds = Array.from(
    new Set(
      conversations
        .filter((conversation) => normalizeTargetType(conversation.target_type) === "club")
        .map((conversation) => conversation.target_id),
    ),
  );

  const userTargetIds = Array.from(
    new Set(
      conversations
        .filter((conversation) => normalizeTargetType(conversation.target_type) !== "club")
        .map((conversation) => conversation.target_id),
    ),
  );

  const [clubsResult, profilesResult] = await Promise.all([
    clubTargetIds.length > 0
      ? supabase.from("clubs").select("id, name, cover_image_url").in("id", clubTargetIds)
      : Promise.resolve({ data: [] as ClubRow[], error: null }),
    userTargetIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", userTargetIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
  ]);

  if (clubsResult.error) throw clubsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const clubsMap = new Map<string, ClubRow>();
  ((clubsResult.data ?? []) as ClubRow[]).forEach((club) => clubsMap.set(club.id, club));

  const profilesMap = new Map<string, ProfileRow>();
  ((profilesResult.data ?? []) as ProfileRow[]).forEach((profile) => profilesMap.set(profile.id, profile));

  const unreadCounts = new Map<string, number>();
  await Promise.all(
    conversations.map(async (conversation) => {
      const unread = await fetchUnreadCount(
        conversation.id,
        readsMap.get(conversation.id) ?? EPOCH_ISO,
        userId,
      );
      unreadCounts.set(conversation.id, unread);
    }),
  );

  const summaries = conversations.map((conversation) => {
    const targetType = normalizeTargetType(conversation.target_type);

    let title = "Conversation";
    let avatarUrl: string | null = null;

    if (targetType === "club") {
      const club = clubsMap.get(conversation.target_id);
      title = club?.name ?? "Club";
      avatarUrl = club?.cover_image_url ?? null;
    } else {
      const targetProfile = profilesMap.get(conversation.target_id);
      if (targetProfile) {
        title = targetProfile.full_name || targetProfile.email || "User";
        avatarUrl = targetProfile.avatar_url ?? null;
      } else {
        const members = membersByConversation.get(conversation.id) ?? [];
        const other = members.find((member) => member.user_id !== userId);
        if (other) {
          title = other.member_type === "admin" ? "Admin" : "User";
        }
      }
    }

    const latest = latestByConversation.get(conversation.id);
    const lastMessageAt = latest?.created_at ?? conversation.last_message_at ?? null;

    return {
      id: conversation.id,
      orgId: conversation.org_id,
      category: normalizeCategory(conversation.category),
      targetType,
      targetId: conversation.target_id,
      title,
      avatarUrl,
      lastMessageAt,
      updatedAt: conversation.updated_at,
      preview: normalizePreview(latest?.body),
      unreadCount: unreadCounts.get(conversation.id) ?? 0,
    } satisfies ConversationSummary;
  });

  const term = search.trim().toLowerCase();
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
    .from("messages")
    .select("id, conversation_id, org_id, sender_id, sender_type, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (result.error) throw result.error;

  const rows = (result.data ?? []) as MessageRow[];

  return {
    messages: rows
      .map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        orgId: row.org_id,
        senderId: row.sender_id,
        senderType: row.sender_type,
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
  const { conversationId, orgId, userId, at } = params;
  const lastReadAt = at ?? new Date().toISOString();

  const result = await supabase
    .from("message_reads")
    .upsert(
      {
        conversation_id: conversationId,
        org_id: orgId,
        user_id: userId,
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
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      org_id: params.orgId,
      sender_id: params.senderId,
      sender_type: params.senderType,
      body: params.body,
    })
    .select("id, conversation_id, org_id, sender_id, sender_type, body, created_at")
    .single();

  if (result.error) throw result.error;

  const row = result.data as MessageRow;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    orgId: row.org_id,
    senderId: row.sender_id,
    senderType: row.sender_type,
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

  if (tab === "club") {
    const scopedClubsResult = await supabase
      .from("clubs")
      .select("id, name, cover_image_url, org_id")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (scopedClubsResult.error) throw scopedClubsResult.error;

    const scopedClubs = (scopedClubsResult.data ?? []) as ClubRow[];
    const clubs = scopedClubs.length > 0
      ? scopedClubs
      : (
        await supabase
          .from("clubs")
          .select("id, name, cover_image_url, org_id")
          .order("name", { ascending: true })
      ).data ?? [];

    return (clubs as ClubRow[])
      .filter((club) => (term ? club.name.toLowerCase().includes(term) : true))
      .map((club) => ({
        key: club.id,
        targetType: "club",
        targetId: club.id,
        label: club.name,
        subtitle: "Club",
        avatarUrl: club.cover_image_url ?? null,
      } satisfies RecipientOption));
  }

  if (tab === "officer") {
    const officersResult = await supabase
      .from("officers")
      .select("user_id, club_id, role")
      .limit(600);

    if (officersResult.error) throw officersResult.error;

    const officerRows = ((officersResult.data ?? []) as OfficerRow[])
      .filter((row) => Boolean(row.user_id) && row.user_id !== currentUserId);

    const userIds = Array.from(new Set(officerRows.map((row) => row.user_id).filter((id): id is string => Boolean(id))));

    if (userIds.length === 0) return [] as RecipientOption[];

    const scopedProfileResult = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, org_id")
      .in("id", userIds)
      .eq("org_id", orgId);

    if (scopedProfileResult.error) throw scopedProfileResult.error;

    let profiles = (scopedProfileResult.data ?? []) as ProfileRow[];
    if (profiles.length === 0) {
      const fallbackProfileResult = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, org_id")
        .in("id", userIds);

      if (fallbackProfileResult.error) throw fallbackProfileResult.error;
      profiles = (fallbackProfileResult.data ?? []) as ProfileRow[];
    }

    if (profiles.length === 0) return [] as RecipientOption[];

    const clubIds = Array.from(new Set(officerRows.map((row) => row.club_id).filter((id): id is string => Boolean(id))));
    const clubsResult = clubIds.length
      ? await supabase.from("clubs").select("id, name").in("id", clubIds)
      : { data: [] as ClubRow[], error: null };

    if (clubsResult.error) throw clubsResult.error;

    const profileMap = new Map<string, ProfileRow>();
    profiles.forEach((profile) => profileMap.set(profile.id, profile));

    const clubMap = new Map<string, string>();
    ((clubsResult.data ?? []) as ClubRow[]).forEach((club) => clubMap.set(club.id, club.name));

    const options: RecipientOption[] = [];
    userIds.forEach((userId) => {
      const profile = profileMap.get(userId);
      if (!profile) return;

      const officerRow = officerRows.find((row) => row.user_id === userId) ?? null;
      const clubName = officerRow?.club_id ? clubMap.get(officerRow.club_id) : null;
      const roleLabel = officerRow?.role ?? "Officer";
      const label = profile.full_name || profile.email || "Officer";
      const subtitle = clubName ? `${roleLabel} • ${clubName}` : roleLabel;

      if (term && !`${label} ${subtitle}`.toLowerCase().includes(term)) return;

      options.push({
        key: userId,
        targetType: "officer",
        targetId: userId,
        label,
        subtitle,
        avatarUrl: profile.avatar_url ?? null,
      });
    });

    return options;
  }

  const scopedAdminResult = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url, org_id")
    .eq("org_id", orgId)
    .in("role", ADMIN_ROLES)
    .neq("id", currentUserId)
    .order("full_name", { ascending: true });

  if (scopedAdminResult.error) throw scopedAdminResult.error;

  let admins = (scopedAdminResult.data ?? []) as ProfileRow[];
  if (admins.length === 0) {
    const fallbackAdminResult = await supabase
      .from("profiles")
      .select("id, full_name, email, role, avatar_url, org_id")
      .in("role", ADMIN_ROLES)
      .neq("id", currentUserId)
      .order("full_name", { ascending: true });

    if (fallbackAdminResult.error) throw fallbackAdminResult.error;
    admins = (fallbackAdminResult.data ?? []) as ProfileRow[];
  }

  return admins
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
      subtitle: "Admin",
      avatarUrl: profile.avatar_url ?? null,
    } satisfies RecipientOption));
}

async function resolveTargetUser(params: {
  orgId: string;
  targetType: TargetType;
  targetId: string;
}) {
  const { orgId, targetType, targetId } = params;

  if (targetType === "club") {
    let clubResult = await supabase
      .from("clubs")
      .select("id, org_id, primary_user_id")
      .eq("id", targetId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (clubResult.error) throw clubResult.error;
    if (!clubResult.data) {
      clubResult = await supabase
        .from("clubs")
        .select("id, org_id, primary_user_id")
        .eq("id", targetId)
        .maybeSingle();

      if (clubResult.error) throw clubResult.error;
    }

    const club = clubResult.data as ClubRow | null;
    if (!club) throw new Error("Club not found in this organization.");

    let targetUserId = club.primary_user_id ?? null;

    if (!targetUserId) {
      const officerResult = await supabase
        .from("officers")
        .select("user_id")
        .eq("club_id", targetId)
        .limit(1)
        .maybeSingle();

      if (officerResult.error) throw officerResult.error;
      targetUserId = (officerResult.data as { user_id: string | null } | null)?.user_id ?? null;
    }

    if (!targetUserId) {
      throw new Error("Club account has no login user.");
    }

    return {
      targetUserId,
      memberType: "club" as MemberType,
      category: "clubs" as ConversationCategory,
    };
  }

  let profileResult = await supabase
    .from("profiles")
    .select("id, org_id, role, club_id")
    .eq("id", targetId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) {
    profileResult = await supabase
      .from("profiles")
      .select("id, org_id, role, club_id")
      .eq("id", targetId)
      .maybeSingle();

    if (profileResult.error) throw profileResult.error;
  }

  const profile = profileResult.data as {
    id: string;
    org_id: string;
    role: string | null;
    club_id: string | null;
  } | null;

  if (!profile) throw new Error("Target user not found in this organization.");

  if (targetType === "admin") {
    if (!ADMIN_ROLES.includes(profile.role ?? "")) {
      throw new Error("Selected user is not an admin.");
    }

    return {
      targetUserId: targetId,
      memberType: "admin" as MemberType,
      category: "admins" as ConversationCategory,
    };
  }

  if (targetType === "officer") {
    return {
      targetUserId: targetId,
      memberType: "officer" as MemberType,
      category: "officers" as ConversationCategory,
    };
  }

  return {
    targetUserId: targetId,
    memberType: "other" as MemberType,
    category: "others" as ConversationCategory,
  };
}

export async function getOrCreateConversation(params: {
  orgId: string;
  currentUserId: string;
  targetType: TargetType;
  targetId: string;
}) {
  const { orgId, currentUserId, targetType, targetId } = params;

  const membershipResult = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  if (membershipResult.error) throw membershipResult.error;

  const conversationIds = ((membershipResult.data ?? []) as { conversation_id: string }[])
    .map((row) => row.conversation_id);

  if (conversationIds.length > 0) {
    const existingResult = await supabase
      .from("conversations")
      .select("id")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .in("id", conversationIds)
      .limit(1)
      .maybeSingle();

    if (existingResult.error) throw existingResult.error;

    const existing = existingResult.data as { id: string } | null;
    if (existing?.id) return existing.id;
  }

  const resolved = await resolveTargetUser({ orgId, targetType, targetId });

  if (resolved.targetUserId === currentUserId) {
    throw new Error("Cannot create a direct conversation with yourself.");
  }

  const conversationInsert = await supabase
    .from("conversations")
    .insert({
      org_id: orgId,
      category: resolved.category,
      target_type: targetType,
      target_id: targetId,
    })
    .select("id")
    .single();

  if (conversationInsert.error) throw conversationInsert.error;

  const conversationId = (conversationInsert.data as { id: string }).id;

  const membersInsert = await supabase
    .from("conversation_members")
    .insert([
      {
        conversation_id: conversationId,
        org_id: orgId,
        user_id: currentUserId,
        member_type: "admin",
      },
      {
        conversation_id: conversationId,
        org_id: orgId,
        user_id: resolved.targetUserId,
        member_type: resolved.memberType,
      },
    ]);

  if (membersInsert.error) throw membersInsert.error;

  await markConversationRead({
    conversationId,
    orgId,
    userId: currentUserId,
  });

  return conversationId;
}

export function resolveSenderType(profile: MessagingProfile | null): MemberType {
  return roleToMemberType(profile?.role, profile?.club_id);
}
