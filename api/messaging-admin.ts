import { createClient } from "@supabase/supabase-js";

const ADMIN_ROLES = new Set(["admin", "student_life_admin", "super_admin"]);

type RequestBody =
  | { action?: "ensure-club-conversation"; clubId?: string }
  | { action?: "ensure-prospect-conversation"; prospectId?: string }
  | { action?: "ensure-admin-conversation"; targetAdminUserId?: string }
  | { action?: "sync-club-conversations" }
  | { action?: "add-conversation-member"; conversationId?: string; userId?: string }
  | { action?: "remove-conversation-member"; conversationId?: string; userId?: string }
  | { action?: "ensure-self-member"; conversationId?: string; role?: "admin" | "club" }
  | { action?: "send-message"; conversationId?: string; body?: string };

type ActorProfile = {
  id: string;
  org_id?: string | null;
  role?: string | null;
  club_id?: string | null;
  email?: string | null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(500).json({
      error: "Supabase server configuration is incomplete. Set SUPABASE_SERVICE_ROLE_KEY on Vercel.",
    });
  }

  const authorization = String(req.headers.authorization || "");
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) {
    return res.status(401).json({ error: "Missing access token." });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return res.status(401).json({ error: "Unable to verify your session." });
  }

  const actorProfile = await getActorProfile(serviceClient, authData.user.id);
  if (!actorProfile) {
    return res.status(403).json({ error: "Your workspace profile could not be found." });
  }

  const body = (req.body ?? {}) as RequestBody;

  try {
    switch (body.action) {
      case "ensure-club-conversation":
        return await handleEnsureClubConversation(serviceClient, actorProfile, body, res);
      case "ensure-prospect-conversation":
        return await handleEnsureProspectConversation(serviceClient, actorProfile, body, res);
      case "ensure-admin-conversation":
        return await handleEnsureAdminConversation(serviceClient, actorProfile, body, res);
      case "sync-club-conversations":
        return await handleSyncClubConversations(serviceClient, actorProfile, res);
      case "add-conversation-member":
        return await handleAddConversationMember(serviceClient, actorProfile, body, res);
      case "remove-conversation-member":
        return await handleRemoveConversationMember(serviceClient, actorProfile, body, res);
      case "ensure-self-member":
        return await handleEnsureSelfMember(serviceClient, actorProfile, body, res);
      case "send-message":
        return await handleSendMessage(serviceClient, actorProfile, body, res);
      default:
        return res.status(400).json({ error: "Unknown action." });
    }
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}

async function handleEnsureClubConversation(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  body: Extract<RequestBody, { action?: "ensure-club-conversation" }>,
  res: any,
) {
  assertAdmin(actorProfile);

  const clubId = body.clubId?.trim();
  if (!clubId || !actorProfile.org_id) {
    return res.status(400).json({ error: "clubId and actor org are required." });
  }
  const conversationId = await ensureClubConversationInternal(serviceClient, actorProfile, clubId);
  return res.status(200).json({ ok: true, conversationId });
}

async function handleEnsureProspectConversation(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  body: Extract<RequestBody, { action?: "ensure-prospect-conversation" }>,
  res: any,
) {
  assertAdmin(actorProfile);

  const prospectId = body.prospectId?.trim();
  if (!prospectId || !actorProfile.org_id) {
    return res.status(400).json({ error: "prospectId and actor org are required." });
  }

  const prospectResult = await serviceClient
    .from("prospect_clubs")
    .select("id, name, org_id")
    .eq("id", prospectId)
    .eq("org_id", actorProfile.org_id)
    .single();

  if (prospectResult.error || !prospectResult.data) {
    return res.status(404).json({ error: "Prospect not found in this workspace." });
  }

  const existingResult = await serviceClient
    .from("admin_conversations")
    .select("id")
    .eq("org_id", actorProfile.org_id)
    .eq("prospect_id", prospectId)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    return res.status(400).json({ error: existingResult.error.message ?? "Unable to load prospect conversation." });
  }

  let conversationId = existingResult.data?.id ?? null;

  if (!conversationId) {
    const insertResult = await serviceClient
      .from("admin_conversations")
      .insert({
        org_id: actorProfile.org_id,
        prospect_id: prospectId,
        type: "prospect",
        created_by: actorProfile.id,
        subject: (prospectResult.data as { name: string }).name,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      return res.status(400).json({ error: insertResult.error.message ?? "Unable to create prospect conversation." });
    }

    conversationId = (insertResult.data as { id: string }).id;
  }

  await ensureConversationMember(serviceClient, {
    conversationId,
    orgId: actorProfile.org_id,
    userId: actorProfile.id,
    role: "admin",
    clubId: null,
  });

  return res.status(200).json({ ok: true, conversationId });
}

async function handleEnsureAdminConversation(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  body: Extract<RequestBody, { action?: "ensure-admin-conversation" }>,
  res: any,
) {
  assertAdmin(actorProfile);

  const targetAdminUserId = body.targetAdminUserId?.trim();
  if (!targetAdminUserId || !actorProfile.org_id) {
    return res.status(400).json({ error: "targetAdminUserId and actor org are required." });
  }

  if (targetAdminUserId === actorProfile.id) {
    return res.status(400).json({ error: "Cannot create a conversation with yourself." });
  }

  const targetProfile = await getActorProfile(serviceClient, targetAdminUserId);
  if (!targetProfile || targetProfile.org_id !== actorProfile.org_id || !ADMIN_ROLES.has(targetProfile.role ?? "")) {
    return res.status(404).json({ error: "Target admin not found in this workspace." });
  }

  const membershipsResult = await serviceClient
    .from("admin_conversation_members")
    .select("conversation_id, user_id")
    .in("user_id", [actorProfile.id, targetAdminUserId]);

  if (membershipsResult.error) {
    return res.status(400).json({ error: membershipsResult.error.message ?? "Unable to inspect admin conversations." });
  }

  const memberships = (membershipsResult.data ?? []) as Array<{ conversation_id: string; user_id: string }>;
  const conversationIds = Array.from(
    new Set(
      memberships
        .filter((row) => row.user_id === actorProfile.id)
        .map((row) => row.conversation_id),
    ),
  ).filter((conversationId) =>
    memberships.some((row) => row.user_id === targetAdminUserId && row.conversation_id === conversationId),
  );

  let conversationId: string | null = null;
  if (conversationIds.length > 0) {
    const existingResult = await serviceClient
      .from("admin_conversations")
      .select("id")
      .eq("org_id", actorProfile.org_id)
      .eq("type", "admin")
      .is("club_id", null)
      .is("prospect_id", null)
      .in("id", conversationIds)
      .limit(1)
      .maybeSingle();

    if (existingResult.error) {
      return res.status(400).json({ error: existingResult.error.message ?? "Unable to inspect admin conversations." });
    }

    conversationId = existingResult.data?.id ?? null;
  }

  if (!conversationId) {
    const insertResult = await serviceClient
      .from("admin_conversations")
      .insert({
        org_id: actorProfile.org_id,
        type: "admin",
        created_by: actorProfile.id,
        subject: null,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      return res.status(400).json({ error: insertResult.error.message ?? "Unable to create admin conversation." });
    }

    conversationId = (insertResult.data as { id: string }).id;
  }

  await ensureConversationMember(serviceClient, {
    conversationId,
    orgId: actorProfile.org_id,
    userId: actorProfile.id,
    role: "admin",
    clubId: null,
  });
  await ensureConversationMember(serviceClient, {
    conversationId,
    orgId: actorProfile.org_id,
    userId: targetAdminUserId,
    role: "admin",
    clubId: null,
  });

  return res.status(200).json({ ok: true, conversationId });
}

async function handleSyncClubConversations(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  res: any,
) {
  assertAdmin(actorProfile);

  if (!actorProfile.org_id) {
    return res.status(400).json({ error: "Actor org is required." });
  }

  const clubsResult = await serviceClient
    .from("clubs")
    .select("id")
    .eq("org_id", actorProfile.org_id)
    .eq("approved", true);

  if (clubsResult.error) {
    return res.status(400).json({ error: clubsResult.error.message ?? "Unable to load clubs." });
  }

  const clubIds = ((clubsResult.data ?? []) as Array<{ id: string }>).map((row) => row.id);
  let createdCount = 0;

  for (const clubId of clubIds) {
    const existing = await findExistingConversation(serviceClient, { orgId: actorProfile.org_id, clubId });
    if (!existing) createdCount += 1;
    await ensureClubConversationInternal(serviceClient, actorProfile, clubId);
  }

  return res.status(200).json({
    ok: true,
    clubCount: clubIds.length,
    createdCount,
    connectedCount: clubIds.length,
  });
}

async function handleAddConversationMember(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  body: Extract<RequestBody, { action?: "add-conversation-member" }>,
  res: any,
) {
  assertAdmin(actorProfile);

  const conversationId = body.conversationId?.trim();
  const userId = body.userId?.trim();
  if (!conversationId || !userId || !actorProfile.org_id) {
    return res.status(400).json({ error: "conversationId, userId, and actor org are required." });
  }

  const conversation = await getConversation(serviceClient, conversationId);
  if (!conversation || conversation.org_id !== actorProfile.org_id) {
    return res.status(404).json({ error: "Conversation not found in this workspace." });
  }

  const targetProfile = await getActorProfile(serviceClient, userId);
  if (!targetProfile || targetProfile.org_id !== actorProfile.org_id) {
    return res.status(404).json({ error: "User not found in this workspace." });
  }

  const role: "admin" | "club" = ADMIN_ROLES.has(targetProfile.role ?? "") ? "admin" : "club";
  const clubId = role === "club" ? targetProfile.club_id ?? conversation.club_id ?? null : null;

  await ensureConversationMember(serviceClient, {
    conversationId,
    orgId: actorProfile.org_id,
    userId,
    role,
    clubId,
  });

  return res.status(200).json({ ok: true });
}

async function handleRemoveConversationMember(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  body: Extract<RequestBody, { action?: "remove-conversation-member" }>,
  res: any,
) {
  assertAdmin(actorProfile);

  const conversationId = body.conversationId?.trim();
  const userId = body.userId?.trim();
  if (!conversationId || !userId || !actorProfile.org_id) {
    return res.status(400).json({ error: "conversationId, userId, and actor org are required." });
  }

  const conversation = await getConversation(serviceClient, conversationId);
  if (!conversation || conversation.org_id !== actorProfile.org_id) {
    return res.status(404).json({ error: "Conversation not found in this workspace." });
  }

  const membersResult = await serviceClient
    .from("admin_conversation_members")
    .select("user_id, role")
    .eq("conversation_id", conversationId);

  if (membersResult.error) {
    return res.status(400).json({ error: membersResult.error.message ?? "Unable to inspect participants." });
  }

  const members = (membersResult.data ?? []) as Array<{ user_id: string; role: "admin" | "club" }>;
  const target = members.find((member) => member.user_id === userId) ?? null;
  if (!target) {
    return res.status(404).json({ error: "Conversation member not found." });
  }

  if (target.role === "admin" && members.filter((member) => member.role === "admin").length <= 1) {
    return res.status(400).json({ error: "Cannot remove the last admin from this conversation." });
  }

  const [readsDelete, membersDelete] = await Promise.all([
    serviceClient.from("admin_message_reads").delete().eq("conversation_id", conversationId).eq("user_id", userId),
    serviceClient.from("admin_conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", userId),
  ]);

  if (readsDelete.error) {
    return res.status(400).json({ error: readsDelete.error.message ?? "Unable to remove message read state." });
  }
  if (membersDelete.error) {
    return res.status(400).json({ error: membersDelete.error.message ?? "Unable to remove participant." });
  }

  return res.status(200).json({ ok: true });
}

async function handleEnsureSelfMember(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  body: Extract<RequestBody, { action?: "ensure-self-member" }>,
  res: any,
) {
  const conversationId = body.conversationId?.trim();
  const role = body.role ?? "admin";
  if (!conversationId || !actorProfile.org_id) {
    return res.status(400).json({ error: "conversationId and actor org are required." });
  }

  const conversation = await getConversation(serviceClient, conversationId);
  if (!conversation || conversation.org_id !== actorProfile.org_id) {
    return res.status(404).json({ error: "Conversation not found in this workspace." });
  }

  const effectiveRole = role === "club" && !ADMIN_ROLES.has(actorProfile.role ?? "") ? "club" : "admin";
  const effectiveClubId = effectiveRole === "club" ? actorProfile.club_id ?? conversation.club_id ?? null : null;

  await ensureConversationMember(serviceClient, {
    conversationId,
    orgId: actorProfile.org_id,
    userId: actorProfile.id,
    role: effectiveRole,
    clubId: effectiveClubId,
  });

  return res.status(200).json({ ok: true });
}

async function handleSendMessage(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  body: Extract<RequestBody, { action?: "send-message" }>,
  res: any,
) {
  const conversationId = body.conversationId?.trim();
  const messageBody = body.body?.trim();

  if (!conversationId || !messageBody || !actorProfile.org_id) {
    return res.status(400).json({ error: "conversationId, body, and actor org are required." });
  }

  const conversation = await getConversation(serviceClient, conversationId);
  if (!conversation || conversation.org_id !== actorProfile.org_id) {
    return res.status(404).json({ error: "Conversation not found in this workspace." });
  }

  const role: "admin" | "club" = ADMIN_ROLES.has(actorProfile.role ?? "") ? "admin" : "club";
  const clubId = role === "club" ? actorProfile.club_id ?? conversation.club_id ?? null : null;

  await ensureConversationMember(serviceClient, {
    conversationId,
    orgId: actorProfile.org_id,
    userId: actorProfile.id,
    role,
    clubId,
  });

  const insertResult = await serviceClient
    .from("admin_messages")
    .insert({
      conversation_id: conversationId,
      org_id: actorProfile.org_id,
      sender_id: actorProfile.id,
      sender_role: role,
      body: messageBody,
    })
    .select("id, conversation_id, org_id, sender_id, sender_role, body, created_at")
    .single();

  if (insertResult.error) {
    return res.status(400).json({ error: insertResult.error.message ?? "Unable to send message." });
  }

  const message = insertResult.data as {
    id: string;
    conversation_id: string;
    org_id: string;
    sender_id: string;
    sender_role: "admin" | "club";
    body: string;
    created_at: string;
  };

  return res.status(200).json({
    ok: true,
    message: {
      id: message.id,
      conversationId: message.conversation_id,
      orgId: message.org_id,
      senderId: message.sender_id,
      senderType: message.sender_role,
      body: message.body,
      createdAt: message.created_at,
    },
  });
}

async function getActorProfile(serviceClient: ReturnType<typeof createClient>, userId: string) {
  const result = await serviceClient
    .from("profiles")
    .select("id, org_id, role, club_id, email")
    .eq("id", userId)
    .maybeSingle();

  return (result.data as ActorProfile | null) ?? null;
}

async function ensureClubConversationInternal(
  serviceClient: ReturnType<typeof createClient>,
  actorProfile: ActorProfile,
  clubId: string,
) {
  const clubResult = await serviceClient
    .from("clubs")
    .select("id, name, org_id, primary_user_id")
    .eq("id", clubId)
    .eq("org_id", actorProfile.org_id)
    .single();

  if (clubResult.error || !clubResult.data) {
    throw new Error("Club not found in this workspace.");
  }

  const club = clubResult.data as { id: string; name: string; org_id: string; primary_user_id?: string | null };
  let conversationId = await findExistingConversation(serviceClient, { orgId: actorProfile.org_id!, clubId: club.id });

  if (!conversationId) {
    const insertResult = await serviceClient
      .from("admin_conversations")
      .insert({
        org_id: actorProfile.org_id,
        club_id: club.id,
        type: "club",
        created_by: actorProfile.id,
        subject: club.name,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      throw new Error(insertResult.error.message ?? "Unable to create club conversation.");
    }

    conversationId = (insertResult.data as { id: string }).id;
  }

  await ensureConversationMember(serviceClient, {
    conversationId,
    orgId: actorProfile.org_id!,
    userId: actorProfile.id,
    role: "admin",
    clubId: null,
  });

  const [officersResult, profilesResult] = await Promise.all([
    serviceClient.from("officers").select("user_id").eq("club_id", club.id).not("user_id", "is", null),
    serviceClient.from("profiles").select("id").eq("org_id", actorProfile.org_id!).eq("club_id", club.id),
  ]);

  if (officersResult.error) {
    throw new Error(officersResult.error.message ?? "Unable to load officers.");
  }
  if (profilesResult.error) {
    throw new Error(profilesResult.error.message ?? "Unable to load club users.");
  }

  const clubUserIds = Array.from(
    new Set(
      [
        club.primary_user_id ?? null,
        ...((officersResult.data ?? []) as Array<{ user_id: string | null }>).map((row) => row.user_id),
        ...((profilesResult.data ?? []) as Array<{ id: string }>).map((row) => row.id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  for (const userId of clubUserIds) {
    await ensureConversationMember(serviceClient, {
      conversationId,
      orgId: actorProfile.org_id!,
      userId,
      role: "club",
      clubId: club.id,
    });
  }

  return conversationId;
}

async function getConversation(serviceClient: ReturnType<typeof createClient>, conversationId: string) {
  const result = await serviceClient
    .from("admin_conversations")
    .select("id, org_id, club_id, prospect_id, type")
    .eq("id", conversationId)
    .maybeSingle();

  return result.data as
    | { id: string; org_id: string; club_id: string | null; prospect_id: string | null; type: string }
    | null;
}

async function findExistingConversation(
  serviceClient: ReturnType<typeof createClient>,
  params: { orgId: string; clubId: string },
) {
  const result = await serviceClient
    .from("admin_conversations")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("club_id", params.clubId)
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to inspect existing conversations.");
  }

  return result.data?.id ?? null;
}

async function ensureConversationMember(
  serviceClient: ReturnType<typeof createClient>,
  params: {
    conversationId: string;
    orgId: string;
    userId: string;
    role: "admin" | "club";
    clubId: string | null;
  },
) {
  const result = await serviceClient.from("admin_conversation_members").upsert(
    {
      conversation_id: params.conversationId,
      org_id: params.orgId,
      user_id: params.userId,
      role: params.role,
      club_id: params.clubId,
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to update conversation access.");
  }
}

function assertAdmin(actorProfile: ActorProfile) {
  if (!ADMIN_ROLES.has(actorProfile.role ?? "")) {
    throw new Error("Only Student Life admins can manage messaging access.");
  }
}
