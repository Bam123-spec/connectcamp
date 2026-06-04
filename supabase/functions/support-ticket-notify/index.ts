import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type SupportTicketRequest = {
  source?: string;
  action?: string;
  ticket?: {
    id?: string;
    campus?: string;
    issue_type?: string;
    description?: string;
    priority?: string;
    status?: string;
    contact_email?: string | null;
    screenshot_url?: string | null;
    screenshot_path?: string | null;
  };
  recipients?: string[];
};

type SupportTicketRow = {
  id: string;
  org_id: string | null;
  campus: string;
  issue_type: string;
  description: string;
  priority: string;
  status: string;
  contact_email: string | null;
  screenshot_url: string | null;
  screenshot_path?: string | null;
  created_at: string;
  created_by: string | null;
};

type WorkspaceSettingsRow = {
  org_id: string;
  organization_name: string | null;
  reply_to_email: string | null;
  support_email: string | null;
  webhook_url: string | null;
  timezone: string | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  org_id: string | null;
  email: string | null;
  full_name: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase Edge Function secrets are incomplete.");
}

const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function dedupeEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase() ?? "")
        .filter((value) => value.length > 0 && isEmail(value)),
    ),
  );
}

function parseSecretEmails(value: string | undefined) {
  if (!value) return [];
  return value
    .split(/[,\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function buildEmailHtml(params: {
  workspaceName: string;
  ticket: SupportTicketRow;
  requesterName: string;
  requesterEmail: string;
}) {
  const { workspaceName, ticket, requesterName, requesterEmail } = params;
  const screenshotBlock = ticket.screenshot_url
    ? `<p><strong>Screenshot:</strong> <a href="${escapeHtml(ticket.screenshot_url)}">${escapeHtml(ticket.screenshot_url)}</a></p>`
    : "<p><strong>Screenshot:</strong> Not attached</p>";

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">New Connect Camp support ticket</h2>
      <p style="margin-top: 0;">A support ticket was submitted in ${escapeHtml(workspaceName)}.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 6px 0;"><strong>Ticket ID</strong></td><td style="padding: 6px 0;">${escapeHtml(ticket.id)}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Priority</strong></td><td style="padding: 6px 0;">${escapeHtml(ticket.priority)}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Status</strong></td><td style="padding: 6px 0;">${escapeHtml(ticket.status)}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Issue type</strong></td><td style="padding: 6px 0;">${escapeHtml(ticket.issue_type)}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Campus</strong></td><td style="padding: 6px 0;">${escapeHtml(ticket.campus)}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Requester</strong></td><td style="padding: 6px 0;">${escapeHtml(requesterName)} (${escapeHtml(requesterEmail)})</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Submitted at</strong></td><td style="padding: 6px 0;">${escapeHtml(ticket.created_at)}</td></tr>
      </table>
      <p><strong>Description</strong></p>
      <pre style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px;">${escapeHtml(ticket.description)}</pre>
      ${screenshotBlock}
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse(401, { error: "Missing authorization header." });
  }

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse(401, { error: "Invalid or expired user token." });
  }

  const profileResult = await adminClient
    .from("profiles")
    .select("id, role, org_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    console.error("Profile lookup failed", profileResult.error);
    return jsonResponse(500, { error: "Could not load requester profile." });
  }

  const profile = profileResult.data as ProfileRow | null;
  if (!profile || profile.role !== "admin") {
    return jsonResponse(403, { error: "Admin access is required." });
  }

  let payload: SupportTicketRequest;
  try {
    payload = (await req.json()) as SupportTicketRequest;
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON." });
  }

  const ticketId = payload.ticket?.id?.trim();
  if (!ticketId) {
    return jsonResponse(400, { error: "Ticket id is required." });
  }

  const ticketResult = await adminClient
    .from("support_tickets")
    .select("id, org_id, campus, issue_type, description, priority, status, contact_email, screenshot_url, created_at, created_by")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketResult.error) {
    console.error("Ticket lookup failed", ticketResult.error);
    return jsonResponse(500, { error: "Could not load support ticket." });
  }

  const ticket = ticketResult.data as SupportTicketRow | null;
  if (!ticket) {
    return jsonResponse(404, { error: "Support ticket not found." });
  }

  if (!ticket.org_id || ticket.org_id !== profile.org_id) {
    return jsonResponse(403, { error: "Support ticket is outside your workspace." });
  }

  const workspaceSettingsResult = await adminClient
    .from("workspace_settings")
    .select("org_id, organization_name, reply_to_email, support_email, webhook_url, timezone")
    .eq("org_id", ticket.org_id)
    .maybeSingle();

  if (workspaceSettingsResult.error) {
    console.error("Workspace settings lookup failed", workspaceSettingsResult.error);
    return jsonResponse(500, { error: "Could not load workspace settings." });
  }

  const workspaceSettings = workspaceSettingsResult.data as WorkspaceSettingsRow | null;
  const workspaceName = workspaceSettings?.organization_name?.trim() || "Connect Camp";
  const requesterName = profile.full_name?.trim() || profile.email?.trim() || user.email || "Admin";
  const requesterEmail = profile.email?.trim() || user.email || ticket.contact_email || "unknown@connectcamp.local";

  const warnings: string[] = [];
  const channels: string[] = [];
  const recipients = dedupeEmails([
    ...(payload.recipients ?? []),
    workspaceSettings?.support_email,
    ...parseSecretEmails(Deno.env.get("SUPPORT_TICKET_TO_EMAILS")),
  ]);

  if (workspaceSettings?.webhook_url) {
    try {
      const webhookResponse = await fetch(workspaceSettings.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: payload.source ?? "support-ticket-notify",
          action: payload.action ?? "support_ticket_created",
          workspace: {
            org_id: ticket.org_id,
            organization_name: workspaceName,
            timezone: workspaceSettings.timezone ?? "UTC",
          },
          requester: {
            id: profile.id,
            name: requesterName,
            email: requesterEmail,
          },
          ticket,
          recipients,
        }),
      });

      if (webhookResponse.ok) {
        channels.push("webhook");
      } else {
        warnings.push(`Webhook delivery failed with status ${webhookResponse.status}.`);
      }
    } catch (error) {
      warnings.push(
        `Webhook delivery failed: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  } else {
    warnings.push("No workspace webhook URL is configured.");
  }

  const brevoApiKey = Deno.env.get("BREVO_API_KEY")?.trim();
  const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL")?.trim();
  const brevoSenderName = Deno.env.get("BREVO_SENDER_NAME")?.trim() || workspaceName;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim();

  if (recipients.length === 0) {
    warnings.push("No support email recipients are configured.");
  } else if (brevoApiKey && brevoSenderEmail) {
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify({
        sender: {
          name: brevoSenderName,
          email: brevoSenderEmail,
        },
        to: recipients.map((email) => ({ email })),
        replyTo: {
          email: workspaceSettings?.reply_to_email?.trim() || requesterEmail,
          name: requesterName,
        },
        subject: `[Connect Camp][${ticket.priority}] ${ticket.issue_type} (${ticket.id.slice(0, 8)})`,
        html: buildEmailHtml({
          workspaceName,
          ticket,
          requesterName,
          requesterEmail,
        }),
      }),
    });

    if (brevoResponse.ok) {
      channels.push("email");
    } else {
      const brevoBody = await brevoResponse.text();
      warnings.push(
        `Brevo email delivery failed with status ${brevoResponse.status}${brevoBody ? `: ${brevoBody}` : "."}`,
      );
    }
  } else if (resendApiKey && resendFromEmail) {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: recipients,
        reply_to: workspaceSettings?.reply_to_email?.trim() || requesterEmail,
        subject: `[Connect Camp][${ticket.priority}] ${ticket.issue_type} (${ticket.id.slice(0, 8)})`,
        html: buildEmailHtml({
          workspaceName,
          ticket,
          requesterName,
          requesterEmail,
        }),
      }),
    });

    if (resendResponse.ok) {
      channels.push("email");
    } else {
      const resendBody = await resendResponse.text();
      warnings.push(
        `Resend email delivery failed with status ${resendResponse.status}${resendBody ? `: ${resendBody}` : "."}`,
      );
    }
  } else {
    warnings.push("Email delivery is not configured because no supported provider secrets are set.");
  }

  const responseBody = {
    delivered: channels.length > 0,
    channels,
    recipients,
    warnings,
    ticket_id: ticket.id,
  };

  if (channels.length === 0) {
    console.error("Support ticket notification had no successful delivery channel", responseBody);
    return jsonResponse(503, responseBody);
  }

  return jsonResponse(200, responseBody);
});
