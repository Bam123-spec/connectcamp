import { supabase } from "@/lib/supabaseClient";

export const MESSAGE_PAGE_SIZE = 30;
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

export type MessagingProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  club_id: string | null;
  org_id?: string | null;
};

export type ConversationSummary = {
  id: string;
  orgId: string;
  campusId: string | null;
  type: string;
  subject: string | null;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessageSnippet: string;
  lastMessageSenderId: string | null;
  unreadCount: number;
  otherParticipantName: string;
  otherParticipantAvatarUrl: string | null;
  otherParticipantRole: "admin" | "club";
  otherClubId: string | null;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  orgId: string;
  senderId: string;
  senderRole: "admin" | "club";
  body: string;
  createdAt: string;
  editedAt: string | null;
};

export type ConversationMemberInfo = {
  userId: string;
  role: "admin" | "club";
  clubId: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type ClubRecipient = {
  id: string;
  orgId: string | null;
  name: string;
  avatarUrl: string | null;
  primaryUserId: string | null;
};

type MemberRow = {
  conversation_id: string;
  user_id: string;
  role: "admin" | "club";
  club_id: string | null;
};

const normalizeSnippet = (value: string | null | undefined) => {
  const text = (value ?? "").trim();
  if (!text) return "No messages yet";
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
};

export function resolveOrgId(profile: MessagingProfile | null): string {
  const profileOrgId = (profile as MessagingProfile & { org_id?: string | null } | null)?.org_id;
  if (profileOrgId) return profileOrgId;

  if (typeof window !== "undefined") {
    const localOrgId =
      window.localStorage.getItem("cc.workspace.org_id") ||
      window.localStorage.getItem("cc.settings.org_id");

    if (localOrgId) return localOrgId;
  }

  return DEFAULT_ORG_ID;
}

async function fetchProfilesMap(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { full_name: string | null; email: string | null; avatar_url: string | null }>();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);

  const map = new Map<string, { full_name: string | null; email: string | null; avatar_url: string | null }>();
  (data ?? []).forEach((profile) => {
    map.set(profile.id, {
      full_name: profile.full_name ?? null,
      email: profile.email ?? null,
      avatar_url: (profile as { avatar_url?: string | null }).avatar_url ?? null,
    });
  });
  return map;
}

async function fetchClubsMap(clubIds: string[]) {
  if (clubIds.length === 0) return new Map<string, { name: string; cover_image_url: string | null }>();

  const { data } = await supabase
    .from("clubs")
    .select("id, name, cover_image_url")
    .in("id", clubIds);

  const map = new Map<string, { name: string; cover_image_url: string | null }>();
  (data ?? []).forEach((club) => {
    map.set(club.id, {
      name: club.name,
      cover_image_url: club.cover_image_url ?? null,
    });
  });
  return map;
}

async function fetchUnreadCount(conversationId: string, lastReadAt: string, userId: string) {
  const { count } = await supabase
    .from("admin_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .gt("created_at", lastReadAt)
    .neq("sender_id", userId);

  return count ?? 0;
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

  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  const conversationIds = (membershipsResult.data ?? []).map((row) => row.conversation_id);
  if (conversationIds.length === 0) {
    return [] as ConversationSummary[];
  }

  const conversationsResult = await supabase
    .from("admin_conversations")
    .select("id, org_id, campus_id, type, subject, updated_at, last_message_at")
    .eq("org_id", orgId)
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (conversationsResult.error) {
    throw conversationsResult.error;
  }

  const conversations = conversationsResult.data ?? [];
  const ids = conversations.map((conversation) => conversation.id);

  const [allMembersResult, latestMessagesResult, readsResult] = await Promise.all([
    supabase
      .from("admin_conversation_members")
      .select("conversation_id, user_id, role, club_id")
      .in("conversation_id", ids),
    supabase
      .from("admin_messages")
      .select("conversation_id, body, created_at, sender_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("admin_message_reads")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", ids),
  ]);

  if (allMembersResult.error) throw allMembersResult.error;
  if (latestMessagesResult.error) throw latestMessagesResult.error;
  if (readsResult.error) throw readsResult.error;

  const allMembers = (allMembersResult.data ?? []) as MemberRow[];

  const profileIds = Array.from(new Set(allMembers.map((member) => member.user_id)));
  const clubIds = Array.from(
    new Set(
      allMembers
        .map((member) => member.club_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [profilesMap, clubsMap] = await Promise.all([
    fetchProfilesMap(profileIds),
    fetchClubsMap(clubIds),
  ]);

  const membersByConversation = new Map<string, MemberRow[]>();
  allMembers.forEach((member) => {
    const list = membersByConversation.get(member.conversation_id) ?? [];
    list.push(member);
    membersByConversation.set(member.conversation_id, list);
  });

  const latestMessageByConversation = new Map<string, { body: string | null; created_at: string; sender_id: string }>();
  (latestMessagesResult.data ?? []).forEach((message) => {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, {
        body: message.body,
        created_at: message.created_at,
        sender_id: message.sender_id,
      });
    }
  });

  const readsMap = new Map<string, string>();
  (readsResult.data ?? []).forEach((row) => {
    readsMap.set(row.conversation_id, row.last_read_at ?? EPOCH_ISO);
  });

  const unreadCounts = new Map<string, number>();
  await Promise.all(
    ids.map(async (conversationId) => {
      const count = await fetchUnreadCount(
        conversationId,
        readsMap.get(conversationId) ?? EPOCH_ISO,
        userId,
      );
      unreadCounts.set(conversationId, count);
    }),
  );

  const term = search.trim().toLowerCase();

  const summaries = conversations.map((conversation) => {
    const members = membersByConversation.get(conversation.id) ?? [];
    const otherMember =
      members.find((member) => member.user_id !== userId) ?? members[0] ?? null;

    let otherParticipantName = "Unknown participant";
    let otherParticipantAvatarUrl: string | null = null;
    let otherParticipantRole: "admin" | "club" = "admin";
    let otherClubId: string | null = null;

    if (otherMember) {
      otherParticipantRole = otherMember.role;
      otherClubId = otherMember.club_id;

      if (otherMember.role === "club" && otherMember.club_id) {
        const club = clubsMap.get(otherMember.club_id);
        otherParticipantName = club?.name ?? "Club";
        otherParticipantAvatarUrl = club?.cover_image_url ?? null;
      } else {
        const profile = profilesMap.get(otherMember.user_id);
        otherParticipantName = profile?.full_name || profile?.email || "Admin user";
        otherParticipantAvatarUrl = profile?.avatar_url ?? null;
      }
    }

    const latestMessage = latestMessageByConversation.get(conversation.id);
    const lastMessageAt = latestMessage?.created_at ?? conversation.last_message_at ?? null;

    return {
      id: conversation.id,
      orgId: conversation.org_id,
      campusId: conversation.campus_id,
      type: conversation.type,
      subject: conversation.subject,
      updatedAt: conversation.updated_at,
      lastMessageAt,
      lastMessageSnippet: normalizeSnippet(latestMessage?.body),
      lastMessageSenderId: latestMessage?.sender_id ?? null,
      unreadCount: unreadCounts.get(conversation.id) ?? 0,
      otherParticipantName,
      otherParticipantAvatarUrl,
      otherParticipantRole,
      otherClubId,
    } satisfies ConversationSummary;
  });

  const filtered = term
    ? summaries.filter((conversation) =>
      [
        conversation.otherParticipantName,
        conversation.subject ?? "",
        conversation.lastMessageSnippet,
      ].some((value) => value.toLowerCase().includes(term)),
    )
    : summaries;

  return filtered.sort((a, b) => {
    const aDate = a.lastMessageAt ?? a.updatedAt;
    const bDate = b.lastMessageAt ?? b.updatedAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

export async function fetchConversationMessages(
  conversationId: string,
  page: number,
  pageSize = MESSAGE_PAGE_SIZE,
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const result = await supabase
    .from("admin_messages")
    .select("id, conversation_id, org_id, sender_id, sender_role, body, created_at, edited_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (result.error) {
    throw result.error;
  }

  const rawMessages = result.data ?? [];
  const messages = rawMessages
    .map((message) => ({
      id: message.id,
      conversationId: message.conversation_id,
      orgId: message.org_id,
      senderId: message.sender_id,
      senderRole: message.sender_role,
      body: message.body,
      createdAt: message.created_at,
      editedAt: message.edited_at,
    } as ConversationMessage))
    .reverse();

  return {
    messages,
    hasMore: rawMessages.length === pageSize,
  };
}

export async function fetchConversationMemberDirectory(conversationId: string) {
  const membersResult = await supabase
    .from("admin_conversation_members")
    .select("conversation_id, user_id, role, club_id")
    .eq("conversation_id", conversationId);

  if (membersResult.error) {
    throw membersResult.error;
  }

  const members = (membersResult.data ?? []) as MemberRow[];

  const profileIds = Array.from(new Set(members.map((member) => member.user_id)));
  const clubIds = Array.from(
    new Set(
      members
        .map((member) => member.club_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [profilesMap, clubsMap] = await Promise.all([
    fetchProfilesMap(profileIds),
    fetchClubsMap(clubIds),
  ]);

  const directory = new Map<string, ConversationMemberInfo>();

  members.forEach((member) => {
    if (member.role === "club" && member.club_id) {
      const club = clubsMap.get(member.club_id);
      directory.set(member.user_id, {
        userId: member.user_id,
        role: member.role,
        clubId: member.club_id,
        displayName: club?.name ?? "Club",
        avatarUrl: club?.cover_image_url ?? null,
      });
      return;
    }

    const profile = profilesMap.get(member.user_id);
    directory.set(member.user_id, {
      userId: member.user_id,
      role: member.role,
      clubId: member.club_id,
      displayName: profile?.full_name || profile?.email || "Admin user",
      avatarUrl: profile?.avatar_url ?? null,
    });
  });

  return directory;
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
    .from("admin_message_reads")
    .upsert(
      {
        conversation_id: conversationId,
        org_id: orgId,
        user_id: userId,
        last_read_at: lastReadAt,
      },
      { onConflict: "conversation_id,user_id" },
    );

  if (result.error) {
    throw result.error;
  }
}

export async function sendConversationMessage(params: {
  conversationId: string;
  orgId: string;
  senderId: string;
  senderRole: "admin" | "club";
  body: string;
}) {
  const result = await supabase
    .from("admin_messages")
    .insert({
      conversation_id: params.conversationId,
      org_id: params.orgId,
      sender_id: params.senderId,
      sender_role: params.senderRole,
      body: params.body,
    })
    .select("id, conversation_id, org_id, sender_id, sender_role, body, created_at, edited_at")
    .single();

  if (result.error) {
    throw result.error;
  }

  const message = result.data;
  return {
    id: message.id,
    conversationId: message.conversation_id,
    orgId: message.org_id,
    senderId: message.sender_id,
    senderRole: message.sender_role,
    body: message.body,
    createdAt: message.created_at,
    editedAt: message.edited_at,
  } as ConversationMessage;
}

export async function fetchClubsForNewConversation(params: {
  orgId: string;
  search: string;
}) {
  const { orgId, search } = params;

  let query = supabase
    .from("clubs")
    .select("id, org_id, name, cover_image_url, primary_user_id")
    .order("name");

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},org_id.is.null`);
  }

  if (search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const result = await query;
  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map((club) => ({
    id: club.id,
    orgId: (club as { org_id?: string | null }).org_id ?? null,
    name: club.name,
    avatarUrl: club.cover_image_url ?? null,
    primaryUserId: (club as { primary_user_id?: string | null }).primary_user_id ?? null,
  } as ClubRecipient));
}

async function resolveClubPrimaryUserId(club: ClubRecipient) {
  if (club.primaryUserId) {
    return club.primaryUserId;
  }

  const officersResult = await supabase
    .from("officers")
    .select("user_id")
    .eq("club_id", club.id)
    .limit(1)
    .maybeSingle();

  if (officersResult.error) {
    return null;
  }

  return officersResult.data?.user_id ?? null;
}

export async function createOrGetConversationForClub(params: {
  orgId: string;
  campusId?: string | null;
  subject?: string | null;
  adminUserId: string;
  club: ClubRecipient;
}) {
  const { orgId, campusId, subject, adminUserId, club } = params;

  const clubUserId = await resolveClubPrimaryUserId(club);
  if (!clubUserId) {
    throw new Error("Club account has no login user.");
  }

  const adminMembershipsResult = await supabase
    .from("admin_conversation_members")
    .select("conversation_id")
    .eq("org_id", orgId)
    .eq("user_id", adminUserId)
    .eq("role", "admin");

  if (adminMembershipsResult.error) {
    throw adminMembershipsResult.error;
  }

  const adminConversationIds = (adminMembershipsResult.data ?? []).map((row) => row.conversation_id);

  if (adminConversationIds.length > 0) {
    const clubMembershipResult = await supabase
      .from("admin_conversation_members")
      .select("conversation_id")
      .eq("org_id", orgId)
      .eq("role", "club")
      .eq("club_id", club.id)
      .in("conversation_id", adminConversationIds)
      .limit(1)
      .maybeSingle();

    if (clubMembershipResult.error) {
      throw clubMembershipResult.error;
    }

    if (clubMembershipResult.data?.conversation_id) {
      return clubMembershipResult.data.conversation_id;
    }
  }

  const conversationInsert = await supabase
    .from("admin_conversations")
    .insert({
      org_id: orgId,
      campus_id: campusId ?? null,
      type: "dm",
      created_by: adminUserId,
      subject: subject?.trim() || null,
    })
    .select("id")
    .single();

  if (conversationInsert.error) {
    throw conversationInsert.error;
  }

  const conversationId = conversationInsert.data.id;

  const membersInsert = await supabase
    .from("admin_conversation_members")
    .insert([
      {
        conversation_id: conversationId,
        org_id: orgId,
        user_id: adminUserId,
        role: "admin",
        club_id: null,
      },
      {
        conversation_id: conversationId,
        org_id: orgId,
        user_id: clubUserId,
        role: "club",
        club_id: club.id,
      },
    ]);

  if (membersInsert.error) {
    throw membersInsert.error;
  }

  await supabase
    .from("admin_message_reads")
    .upsert(
      {
        conversation_id: conversationId,
        org_id: orgId,
        user_id: adminUserId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,user_id" },
    );

  return conversationId;
}
