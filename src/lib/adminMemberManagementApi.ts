import { supabase } from "@/lib/supabaseClient";

type AddMemberPayload = {
  action: "add-member";
  email: string;
  clubId: string;
};

type AddOfficerPayload = {
  action: "add-officer";
  email: string;
  clubId: string;
  role: string;
};

type UpsertOfficerPayload = {
  action: "upsert-officer";
  userId: string;
  role: string;
  clubId?: string | null;
};

type RemoveOfficerPayload = {
  action: "remove-officer";
  userId: string;
};

type AdminMemberManagementPayload =
  | AddMemberPayload
  | AddOfficerPayload
  | UpsertOfficerPayload
  | RemoveOfficerPayload;

type ApiErrorShape = {
  error?: string;
};

export async function callAdminMemberManagementApi(payload: AdminMemberManagementPayload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You must be signed in to manage members.");
  }

  const response = await fetch("/api/admin-members", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await parseJson(response)) as ApiErrorShape | null;

  if (!response.ok) {
    throw new Error(responseBody?.error || "Unable to update member access.");
  }

  return responseBody;
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
