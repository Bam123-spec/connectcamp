import { createClient } from "@supabase/supabase-js";

const ADMIN_ROLES = new Set(["admin", "student_life_admin", "super_admin"]);

type RequestBody =
  | {
      action?: "add-member";
      email?: string;
      clubId?: string;
    }
  | {
      action?: "add-officer";
      email?: string;
      clubId?: string;
      role?: string;
    }
  | {
      action?: "upsert-officer";
      userId?: string;
      role?: string;
      clubId?: string | null;
    }
  | {
      action?: "remove-officer";
      userId?: string;
    };

type ActorProfile = {
  id: string;
  org_id?: string | null;
  role?: string | null;
};

type ClubRow = {
  id: string;
  name?: string | null;
  org_id?: string | null;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  org_id?: string | null;
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
  if (!actorProfile || !ADMIN_ROLES.has(actorProfile.role ?? "")) {
    return res.status(403).json({ error: "Only Student Life admins can manage members." });
  }

  const body = (req.body ?? {}) as RequestBody;

  try {
    switch (body.action) {
      case "add-member":
        return await handleAddMember(serviceClient, actorProfile, body, res);
      case "add-officer":
        return await handleAddOfficer(serviceClient, actorProfile, body, res);
      case "upsert-officer":
        return await handleUpsertOfficer(serviceClient, actorProfile, body, res);
      case "remove-officer":
        return await handleRemoveOfficer(serviceClient, actorProfile, body, res);
      default:
        return res.status(400).json({ error: "Unknown action." });
    }
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}

async function handleAddMember(serviceClient: ReturnType<typeof createClient>, actorProfile: ActorProfile, body: Extract<RequestBody, { action?: "add-member" }>, res: any) {
  const email = body.email?.trim().toLowerCase();
  const clubId = body.clubId?.trim();

  if (!email || !clubId) {
    return res.status(400).json({ error: "email and clubId are required." });
  }

  await assertClubAccess(serviceClient, actorProfile, clubId);
  const targetUser = await ensureUserForOrg(serviceClient, email, actorProfile.org_id ?? null);
  await upsertClubMembership(serviceClient, clubId, targetUser.id);

  return res.status(200).json({ ok: true, userId: targetUser.id });
}

async function handleAddOfficer(serviceClient: ReturnType<typeof createClient>, actorProfile: ActorProfile, body: Extract<RequestBody, { action?: "add-officer" }>, res: any) {
  const email = body.email?.trim().toLowerCase();
  const clubId = body.clubId?.trim();
  const role = body.role?.trim();

  if (!email || !clubId || !role) {
    return res.status(400).json({ error: "email, clubId, and role are required." });
  }

  await assertClubAccess(serviceClient, actorProfile, clubId);
  const targetUser = await ensureUserForOrg(serviceClient, email, actorProfile.org_id ?? null);
  await insertOfficerRecord(serviceClient, { userId: targetUser.id, clubId, role, email });
  await upsertClubMembership(serviceClient, clubId, targetUser.id);

  return res.status(200).json({ ok: true, userId: targetUser.id });
}

async function handleUpsertOfficer(serviceClient: ReturnType<typeof createClient>, actorProfile: ActorProfile, body: Extract<RequestBody, { action?: "upsert-officer" }>, res: any) {
  const userId = body.userId?.trim();
  const role = body.role?.trim();
  const clubId = body.clubId?.trim() || null;

  if (!userId || !role) {
    return res.status(400).json({ error: "userId and role are required." });
  }

  const targetProfile = await getProfileById(serviceClient, userId);
  if (!targetProfile) {
    return res.status(404).json({ error: "Target user was not found." });
  }

  if (actorProfile.org_id && targetProfile.org_id && actorProfile.org_id !== targetProfile.org_id) {
    return res.status(403).json({ error: "Target user belongs to a different workspace." });
  }

  if (clubId) {
    await assertClubAccess(serviceClient, actorProfile, clubId);
  }

  const { error } = await serviceClient.from("officers").upsert(
    {
      user_id: userId,
      role,
      club_id: clubId,
      ...(targetProfile.email ? { email: targetProfile.email } : {}),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    const fallback = await serviceClient
      .from("officers")
      .upsert({ user_id: userId, role, club_id: clubId }, { onConflict: "user_id" });

    if (fallback.error) {
      return res.status(400).json({ error: fallback.error.message ?? "Unable to update officer role." });
    }
  }

  return res.status(200).json({ ok: true });
}

async function handleRemoveOfficer(serviceClient: ReturnType<typeof createClient>, actorProfile: ActorProfile, body: Extract<RequestBody, { action?: "remove-officer" }>, res: any) {
  const userId = body.userId?.trim();
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  const targetProfile = await getProfileById(serviceClient, userId);
  if (actorProfile.org_id && targetProfile?.org_id && actorProfile.org_id !== targetProfile.org_id) {
    return res.status(403).json({ error: "Target user belongs to a different workspace." });
  }

  const { error } = await serviceClient.from("officers").delete().eq("user_id", userId);
  if (error) {
    return res.status(400).json({ error: error.message ?? "Unable to remove officer role." });
  }

  return res.status(200).json({ ok: true });
}

async function getActorProfile(serviceClient: ReturnType<typeof createClient>, userId: string) {
  const { data } = await serviceClient
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", userId)
    .maybeSingle();

  return (data as ActorProfile | null) ?? null;
}

async function getProfileById(serviceClient: ReturnType<typeof createClient>, userId: string) {
  const { data } = await serviceClient
    .from("profiles")
    .select("id, email, org_id")
    .eq("id", userId)
    .maybeSingle();

  return (data as ProfileRow | null) ?? null;
}

async function assertClubAccess(serviceClient: ReturnType<typeof createClient>, actorProfile: ActorProfile, clubId: string) {
  const { data, error } = await serviceClient
    .from("clubs")
    .select("id, name, org_id")
    .eq("id", clubId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Selected club was not found.");
  }

  const club = data as ClubRow;
  if (actorProfile.org_id && club.org_id && actorProfile.org_id !== club.org_id) {
    throw new Error("Selected club belongs to a different workspace.");
  }
}

async function ensureUserForOrg(serviceClient: ReturnType<typeof createClient>, email: string, orgId: string | null) {
  const existingProfile = await findProfileByEmail(serviceClient, email);
  if (existingProfile) {
    if (orgId && existingProfile.org_id && existingProfile.org_id !== orgId) {
      throw new Error("This email already belongs to another workspace.");
    }

    if (orgId && !existingProfile.org_id) {
      await serviceClient.from("profiles").update({ org_id: orgId }).eq("id", existingProfile.id);
    }

    return existingProfile;
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
  });

  if (error && !error.message?.toLowerCase().includes("already registered")) {
    throw new Error(error.message ?? "Unable to create auth user.");
  }

  const createdUserId = data.user?.id ?? null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const profile = await findProfileByEmail(serviceClient, email);
    if (profile) {
      if (orgId && !profile.org_id) {
        await serviceClient.from("profiles").update({ org_id: orgId }).eq("id", profile.id);
        return { ...profile, org_id: orgId };
      }
      return profile;
    }
    await wait(350);
  }

  if (createdUserId) {
    return { id: createdUserId, email, org_id: orgId };
  }

  throw new Error("User account exists, but the profile is not ready yet. Retry in a few seconds.");
}

async function findProfileByEmail(serviceClient: ReturnType<typeof createClient>, email: string) {
  const { data } = await serviceClient
    .from("profiles")
    .select("id, email, org_id")
    .eq("email", email)
    .maybeSingle();

  return (data as ProfileRow | null) ?? null;
}

async function upsertClubMembership(serviceClient: ReturnType<typeof createClient>, clubId: string, userId: string) {
  const { error } = await serviceClient
    .from("club_members")
    .upsert([{ club_id: clubId, user_id: userId }], { onConflict: "club_id,user_id", ignoreDuplicates: true });

  if (error) {
    throw new Error(error.message ?? "Unable to add member to club.");
  }
}

async function insertOfficerRecord(
  serviceClient: ReturnType<typeof createClient>,
  payload: { userId: string; clubId: string; role: string; email: string },
) {
  const existing = await serviceClient
    .from("officers")
    .select("id")
    .eq("user_id", payload.userId)
    .eq("club_id", payload.clubId)
    .limit(1);

  if ((existing.data ?? []).length > 0) {
    throw new Error("Can't add user: this account is already an officer for this club.");
  }

  const withEmail = await serviceClient.from("officers").insert({
    user_id: payload.userId,
    club_id: payload.clubId,
    role: payload.role,
    email: payload.email,
  });

  if (!withEmail.error) {
    return;
  }

  const fallback = await serviceClient.from("officers").insert({
    user_id: payload.userId,
    club_id: payload.clubId,
    role: payload.role,
  });

  if (fallback.error) {
    throw new Error(fallback.error.message ?? "Unable to add officer.");
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
