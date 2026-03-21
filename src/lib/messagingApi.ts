import { supabase } from "@/lib/supabaseClient";

export const MESSAGE_PAGE_SIZE = 30;
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

export type ConversationCategory = "clubs" | "admins" | "prospects";
export type TargetType = "club" | "admin";
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

export type RecipientTab = "club" | "admin" | "prospect";

export type RecipientOption = {
  key: string;
  targetType: TargetType;
  targetId: string;
  label: string;
  subtitle: string | null;
  avatarUrl: string | null;
};

export type MessagingBackend = "modern" | "legacy";

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
  approved?: boolean | null;
  org_id?: string | null;
  primary_user_id?: string | null;
};

type OfficerRow = {
  user_id: string | null;
  club_id: string | null;
  role: string | null;
};

const ADMIN_ROLES = ["admin", "student_life_admin", "super_admin"];
let messagingBackendCache: MessagingBackend | null = null;

function normalizePreview(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return "No messages yet";
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function normalizeCategory(value: string | null | undefined): ConversationCategory {
  if (value === "clubs" || value === "admins" || value === "prospects") {
    return value;
  }
  if (value === "officers") return "clubs";
  return "admins";
}

function normalizeTargetType(value: string | null | undefined): TargetType {
  if (value === "club" || value === "admin") {
    return value;
  }
  if (value === "officer") return "club";
  return "admin";
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

export async function getMessagingBackend(): Promise<MessagingBackend> {
  if (messagingBackendCache) return messagingBackendCache;

  const probe = await supabase.from("conversations").select("id").limit(1);
  const errorCode = (probe.error as { code?: string } | null)?.code ?? null;

  if (errorCode === "PGRST205") {
    messagingBackendCache = "legacy";
    return "legacy";
  }

  messagingBackendCache = "modern";
  return "modern";
}

type LegacyRoomRow = {
  id: string;
  type: string;
  user1: string | null;
  user2: string | null;
  name: string | null;
  image_url: string | null;
  club_id: string | null;
  created_at: string;
};

type LegacyMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

async function fetchLegacyConversationSummaries(params: {
  userId: string;
  orgId: string;
  search: string;
}) {
  const { userId, search, orgId } = params;

  const roomsResult = await supabase
    .from("chat_rooms")
    .select("id, type, user1, user2, name, image_url, club_id, created_at")
    .eq("type", "dm")
    .or(`user1.eq.${userId},user2.eq.${userId}`);

  if (roomsResult.error) throw roomsResult.error;

  const rooms = (roomsResult.data ?? []) as LegacyRoomRow[];
  if (rooms.length === 0) return [] as ConversationSummary[];

  const roomIds = rooms.map((room) => room.id);
  const latestMessagesResult = await supabase
    .from("chat_messages")
    .select("id, room_id, sender_id, content, created_at")
    .in("room_id", roomIds)
    .order("created_at", { ascending: false });

  if (latestMessagesResult.error) throw latestMessagesResult.error;

  const latestByRoom = new Map<string, LegacyMessageRow>();
  ((latestMessagesResult.data ?? []) as LegacyMessageRow[]).forEach((row) => {
    if (!latestByRoom.has(row.room_id)) {
      latestByRoom.set(row.room_id, row);
    }
  });

  const otherUserIds = Array.from(
    new Set(
      rooms
        .map((room) => (room.user1 === userId ? room.user2 : room.user1))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [profilesResult, officersResult] = await Promise.all([
    otherUserIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, role, club_id, org_id")
          .in("id", otherUserIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    otherUserIds.length > 0
      ? supabase
          .from("officers")
          .select("user_id, club_id, role")
          .in("user_id", otherUserIds)
      : Promise.resolve({ data: [] as OfficerRow[], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (officersResult.error) throw officersResult.error;

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const officers = (officersResult.data ?? []) as OfficerRow[];

  const profileMap = new Map<string, ProfileRow>();
  profiles.forEach((profile) => profileMap.set(profile.id, profile));

  const officerMap = new Map<string, OfficerRow>();
  officers.forEach((officer) => {
    if (officer.user_id && !officerMap.has(officer.user_id)) {
      officerMap.set(officer.user_id, officer);
    }
  });

  const requestedClubIds = Array.from(
    new Set(
      rooms
        .map((room) => room.club_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const officerClubIds = Array.from(
    new Set(
      officers
        .map((officer) => officer.club_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const clubIds = Array.from(new Set([...requestedClubIds, ...officerClubIds]));
  const clubsResult = clubIds.length > 0
    ? await supabase
        .from("clubs")
        .select("id, name, cover_image_url, approved")
        .in("id", clubIds)
    : { data: [] as ClubRow[], error: null };

  if (clubsResult.error) throw clubsResult.error;

  const clubs = (clubsResult.data ?? []) as ClubRow[];
  const clubMap = new Map<string, ClubRow>();
  clubs.forEach((club) => clubMap.set(club.id, club));

  const term = search.trim().toLowerCase();
  const unreadCounts = await fetchLegacyUnreadCounts(roomIds, userId);

  const summaries: ConversationSummary[] = [];

  rooms.forEach((room) => {
    const otherUserId = room.user1 === userId ? room.user2 : room.user1;
    if (!otherUserId || otherUserId === userId) {
      return;
    }

    const profile = otherUserId ? profileMap.get(otherUserId) : null;
    const officer = otherUserId ? officerMap.get(otherUserId) : null;

    let category: ConversationCategory = "admins";
    let targetType: TargetType = "admin";
    let targetId = otherUserId ?? room.id;
    let title = profile?.full_name || profile?.email || "Conversation";
    let avatarUrl = profile?.avatar_url ?? null;

    if (room.club_id) {
      const club = clubMap.get(room.club_id);
      category = club?.approved === false ? "prospects" : "clubs";
      targetType = "club";
      targetId = room.club_id;
      title = club?.name ?? title;
      avatarUrl = club?.cover_image_url ?? avatarUrl;
    } else if (profile && ADMIN_ROLES.includes(profile.role ?? "")) {
      category = "admins";
      targetId = profile.id;
      if (officer?.club_id) {
        const club = clubMap.get(officer.club_id);
        if (club && title === (profile?.email || "Conversation")) {
          title = `${club.name} Admin`;
        }
      }
    } else {
      return;
    }

    const latest = latestByRoom.get(room.id);
    const lastMessageAt = latest?.created_at ?? room.created_at;

    summaries.push({
      id: room.id,
      orgId,
      category,
      targetType,
      targetId,
      title,
      avatarUrl,
      lastMessageAt,
      updatedAt: lastMessageAt,
      preview: normalizePreview(latest?.content),
      unreadCount: unreadCounts.get(room.id) ?? 0,
    });
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

async function fetchLegacyUnreadCounts(roomIds: string[], userId: string) {
  const unreadMap = new Map<string, number>();
  if (roomIds.length === 0) return unreadMap;

  const messagesResult = await supabase
    .from("chat_messages")
    .select("id, room_id, sender_id")
    .in("room_id", roomIds)
    .neq("sender_id", userId);

  if (messagesResult.error) throw messagesResult.error;

  const messageRows = (messagesResult.data ?? []) as {
    id: string;
    room_id: string;
    sender_id: string;
  }[];

  if (messageRows.length === 0) {
    roomIds.forEach((roomId) => unreadMap.set(roomId, 0));
    return unreadMap;
  }

  const messageIds = messageRows.map((row) => row.id);
  const readsResult = await supabase
    .from("chat_message_reads")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);

  if (readsResult.error) throw readsResult.error;

  const readIds = new Set(
    ((readsResult.data ?? []) as { message_id: string | null }[])
      .map((row) => row.message_id)
      .filter((value): value is string => Boolean(value)),
  );

  roomIds.forEach((roomId) => unreadMap.set(roomId, 0));

  messageRows.forEach((row) => {
    if (readIds.has(row.id)) return;
    unreadMap.set(row.room_id, (unreadMap.get(row.room_id) ?? 0) + 1);
  });

  return unreadMap;
}

async function markLegacyConversationRead(conversationId: string, userId: string) {
  const messagesResult = await supabase
    .from("chat_messages")
    .select("id")
    .eq("room_id", conversationId);

  if (messagesResult.error) throw messagesResult.error;

  const messageIds = ((messagesResult.data ?? []) as { id: string }[]).map((row) => row.id);
  if (messageIds.length === 0) return;

  const existingReadsResult = await supabase
    .from("chat_message_reads")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);

  if (existingReadsResult.error) throw existingReadsResult.error;

  const existingIds = new Set(
    ((existingReadsResult.data ?? []) as { message_id: string | null }[])
      .map((row) => row.message_id)
      .filter((value): value is string => Boolean(value)),
  );

  const inserts = messageIds
    .filter((messageId) => !existingIds.has(messageId))
    .map((messageId) => ({
      message_id: messageId,
      user_id: userId,
    }));

  if (inserts.length === 0) return;

  const insertResult = await supabase.from("chat_message_reads").insert(inserts);
  if (insertResult.error) throw insertResult.error;
}

async function filterReachableClubs(clubs: ClubRow[]) {
  if (clubs.length === 0) return clubs;

  const clubIds = clubs.map((club) => club.id);
  const [officersResult, profilesResult, membersResult] = await Promise.all([
    supabase
      .from("officers")
      .select("club_id, user_id")
      .in("club_id", clubIds)
      .not("user_id", "is", null),
    supabase
      .from("profiles")
      .select("club_id, id")
      .in("club_id", clubIds),
    supabase
      .from("club_members")
      .select("club_id, user_id")
      .in("club_id", clubIds)
      .eq("status", "approved")
      .not("user_id", "is", null),
  ]);

  if (officersResult.error) throw officersResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (membersResult.error) throw membersResult.error;

  const eligibleClubIds = new Set<string>();
  ((officersResult.data ?? []) as { club_id: string | null; user_id: string | null }[]).forEach((row) => {
    if (row.club_id && row.user_id) eligibleClubIds.add(row.club_id);
  });
  ((profilesResult.data ?? []) as { club_id: string | null; id: string }[]).forEach((row) => {
    if (row.club_id) eligibleClubIds.add(row.club_id);
  });
  ((membersResult.data ?? []) as { club_id: string | null; user_id: string | null }[]).forEach((row) => {
    if (row.club_id && row.user_id) eligibleClubIds.add(row.club_id);
  });

  return clubs.filter((club) => eligibleClubIds.has(club.id));
}

async function fetchLegacyConversationMessages(params: {
  conversationId: string;
  page: number;
  pageSize?: number;
}) {
  const { conversationId, page, pageSize = MESSAGE_PAGE_SIZE } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const result = await supabase
    .from("chat_messages")
    .select("id, room_id, sender_id, content, created_at")
    .eq("room_id", conversationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (result.error) throw result.error;

  const rows = (result.data ?? []) as LegacyMessageRow[];

  return {
    messages: rows
      .map((row) => ({
        id: row.id,
        conversationId: row.room_id,
        orgId: DEFAULT_ORG_ID,
        senderId: row.sender_id,
        senderType: "other" as MemberType,
        body: row.content,
        createdAt: row.created_at,
      } satisfies ConversationMessage))
      .reverse(),
    hasMore: rows.length === pageSize,
  };
}

async function sendLegacyConversationMessage(params: {
  conversationId: string;
  orgId: string;
  senderId: string;
  body: string;
}) {
  const result = await supabase
    .from("chat_messages")
    .insert({
      room_id: params.conversationId,
      sender_id: params.senderId,
      content: params.body,
    })
    .select("id, room_id, sender_id, content, created_at")
    .single();

  if (result.error) throw result.error;

  const row = result.data as LegacyMessageRow;
  await supabase
    .from("chat_message_reads")
    .insert({
      message_id: row.id,
      user_id: params.senderId,
    });

  return {
    id: row.id,
    conversationId: row.room_id,
    orgId: params.orgId,
    senderId: row.sender_id,
    senderType: "other" as MemberType,
    body: row.content,
    createdAt: row.created_at,
  } satisfies ConversationMessage;
}

export async function fetchConversationSummaries(params: {
  userId: string;
  orgId: string;
  search: string;
}) {
  const backend = await getMessagingBackend();
  if (backend === "legacy") {
    return fetchLegacyConversationSummaries(params);
  }

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
  const backend = await getMessagingBackend();
  if (backend === "legacy") {
    return fetchLegacyConversationMessages(params);
  }

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
  const backend = await getMessagingBackend();
  if (backend === "legacy") {
    await markLegacyConversationRead(params.conversationId, params.userId);
    return;
  }

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
  const backend = await getMessagingBackend();
  if (backend === "legacy") {
    return sendLegacyConversationMessage({
      conversationId: params.conversationId,
      orgId: params.orgId,
      senderId: params.senderId,
      body: params.body,
    });
  }

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
  const backend = await getMessagingBackend();
  const term = search.trim().toLowerCase();

  if (backend === "legacy") {
    if (tab === "club" || tab === "prospect") {
      const wantsApproved = tab === "club";
      const clubsResult = await supabase
        .from("clubs")
        .select("id, name, cover_image_url, approved")
        .eq("approved", wantsApproved)
        .order("name", { ascending: true });

      if (clubsResult.error) throw clubsResult.error;

      const clubs = await filterReachableClubs((clubsResult.data ?? []) as ClubRow[]);

      return clubs
        .filter((club) => (term ? club.name.toLowerCase().includes(term) : true))
        .map((club) => ({
          key: club.id,
          targetType: "club",
          targetId: club.id,
          label: club.name,
          subtitle: wantsApproved ? "Official club" : "Prospect club",
          avatarUrl: club.cover_image_url ?? null,
        } satisfies RecipientOption));
    }

    const adminsResult = await supabase
      .from("profiles")
      .select("id, full_name, email, role, avatar_url")
      .in("role", ADMIN_ROLES)
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

  if (tab === "club" || tab === "prospect") {
    const wantsApproved = tab === "club";
    const scopedClubsResult = await supabase
      .from("clubs")
      .select("id, name, cover_image_url, org_id, approved")
      .eq("org_id", orgId)
      .eq("approved", wantsApproved)
      .order("name", { ascending: true });

    if (scopedClubsResult.error) throw scopedClubsResult.error;

    const scopedClubs = (scopedClubsResult.data ?? []) as ClubRow[];
    const clubs = scopedClubs.length > 0
      ? scopedClubs
      : (
        await supabase
          .from("clubs")
          .select("id, name, cover_image_url, org_id, approved")
          .eq("approved", wantsApproved)
          .order("name", { ascending: true })
      ).data ?? [];

    const reachableClubs = await filterReachableClubs(clubs as ClubRow[]);

    return reachableClubs
      .filter((club) => (term ? club.name.toLowerCase().includes(term) : true))
      .map((club) => ({
        key: club.id,
        targetType: "club",
        targetId: club.id,
        label: club.name,
        subtitle: wantsApproved ? "Official club" : "Prospect club",
        avatarUrl: club.cover_image_url ?? null,
      } satisfies RecipientOption));
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
  const { targetType, targetId } = params;

  if (targetType === "club") {
    const clubResult = await supabase
      .from("clubs")
      .select("id, approved")
      .eq("id", targetId)
      .maybeSingle();

    if (clubResult.error) throw clubResult.error;

    const club = clubResult.data as ClubRow | null;
    if (!club) throw new Error("Club not found in this organization.");

    let targetUserId: string | null = null;

    if (!targetUserId) {
      const officerResult = await supabase
        .from("officers")
        .select("user_id")
        .eq("club_id", targetId)
        .not("user_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (officerResult.error) throw officerResult.error;
      targetUserId = (officerResult.data as { user_id: string | null } | null)?.user_id ?? null;
    }

    if (!targetUserId) {
      const profileResult = await supabase
        .from("profiles")
        .select("id")
        .eq("club_id", targetId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (profileResult.error) throw profileResult.error;
      targetUserId = (profileResult.data as { id: string } | null)?.id ?? null;
    }

    if (!targetUserId) {
      const memberResult = await supabase
        .from("club_members")
        .select("user_id")
        .eq("club_id", targetId)
        .eq("status", "approved")
        .not("user_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (memberResult.error) throw memberResult.error;
      targetUserId = (memberResult.data as { user_id: string | null } | null)?.user_id ?? null;
    }

    if (!targetUserId) {
      throw new Error("Club account has no login user.");
    }

    return {
      targetUserId,
      memberType: "club" as MemberType,
      category: club.approved === false ? ("prospects" as ConversationCategory) : ("clubs" as ConversationCategory),
    };
  }

  const profileResult = await supabase
    .from("profiles")
    .select("id, role, club_id")
    .eq("id", targetId)
    .maybeSingle();

  if (profileResult.error) throw profileResult.error;

  const profile = profileResult.data as {
    id: string;
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

  throw new Error("Unsupported conversation target.");
}

export async function getOrCreateConversation(params: {
  orgId: string;
  currentUserId: string;
  targetType: TargetType;
  targetId: string;
}) {
  const { orgId, currentUserId, targetType, targetId } = params;
  const backend = await getMessagingBackend();

  if (backend === "legacy") {
    const resolved = await resolveTargetUser({ orgId, targetType, targetId });

    if (resolved.targetUserId === currentUserId) {
      throw new Error("Cannot create a direct conversation with yourself.");
    }

    const existingLegacy = await supabase
      .from("chat_rooms")
      .select("id, user1, user2")
      .eq("type", "dm")
      .or(
        `and(user1.eq.${currentUserId},user2.eq.${resolved.targetUserId}),and(user1.eq.${resolved.targetUserId},user2.eq.${currentUserId})`,
      )
      .limit(1)
      .maybeSingle();

    if (existingLegacy.error) throw existingLegacy.error;

    const existingLegacyRow = existingLegacy.data as { id: string } | null;
    if (existingLegacyRow?.id) return existingLegacyRow.id;

    const insertLegacy = await supabase
      .from("chat_rooms")
      .insert({
        type: "dm",
        user1: currentUserId,
        user2: resolved.targetUserId,
        club_id: targetType === "club" ? targetId : null,
      })
      .select("id")
      .single();

    if (insertLegacy.error) throw insertLegacy.error;

    const roomId = (insertLegacy.data as { id: string }).id;

    await supabase.from("chat_members").insert([
      { room_id: roomId, user_id: currentUserId },
      { room_id: roomId, user_id: resolved.targetUserId },
    ]);

    return roomId;
  }

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
