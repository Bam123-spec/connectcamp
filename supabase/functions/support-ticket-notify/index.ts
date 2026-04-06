type SupportTicketPayload = {
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function priorityColors(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
      return {
        background: "#fde7ef",
        text: "#9f1239",
        border: "#f9a8d4",
      };
    case "high":
      return {
        background: "#fef3e2",
        text: "#9a3412",
        border: "#fdba74",
      };
    case "medium":
      return {
        background: "#ede9fe",
        text: "#5b21b6",
        border: "#c4b5fd",
      };
    default:
      return {
        background: "#eef2ff",
        text: "#3730a3",
        border: "#c7d2fe",
      };
  }
}

function buildHtmlEmail(payload: SupportTicketPayload) {
  const ticket = payload.ticket ?? {};
  const ticketId = escapeHtml(ticket.id ?? "Unknown");
  const campus = escapeHtml(ticket.campus ?? "Unknown");
  const issueType = escapeHtml(ticket.issue_type ?? "Unknown");
  const description = escapeHtml(ticket.description ?? "No description provided.");
  const priority = escapeHtml(ticket.priority ?? "Unknown");
  const status = escapeHtml(ticket.status ?? "Open");
  const contactEmail = ticket.contact_email ? escapeHtml(ticket.contact_email) : "Not provided";
  const screenshotUrl = ticket.screenshot_url ? escapeHtml(ticket.screenshot_url) : null;
  const source = escapeHtml(payload.source ?? "Connect Camp Admin");
  const colors = priorityColors(ticket.priority ?? "medium");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Support Ticket</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f0fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#24163b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e5d9f5;">
            <tr>
              <td style="background:linear-gradient(135deg,#4f2d7f 0%,#6c3eb3 100%);padding:28px 32px;color:#ffffff;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">Connect Camp Support</p>
                <h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:700;">New support ticket submitted</h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;opacity:0.9;">
                  A support request was submitted from the admin workspace and is ready for review.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                  <tr>
                    <td>
                      <p style="margin:0 0 8px;font-size:13px;color:#6d5b8d;text-transform:uppercase;letter-spacing:0.12em;">Ticket ID</p>
                      <p style="margin:0;font-size:22px;font-weight:700;color:#2f1d4d;">${ticketId}</p>
                    </td>
                    <td align="right">
                      <span style="display:inline-block;padding:8px 14px;border:1px solid ${colors.border};background:${colors.background};color:${colors.text};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
                        ${priority} Priority
                      </span>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eadff7;background:#faf7fe;margin-bottom:24px;">
                  <tr>
                    <td style="padding:18px 20px;border-bottom:1px solid #eadff7;">
                      <strong style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#7a6696;margin-bottom:6px;">Issue Type</strong>
                      <span style="font-size:16px;font-weight:600;color:#2f1d4d;">${issueType}</span>
                    </td>
                    <td style="padding:18px 20px;border-bottom:1px solid #eadff7;border-left:1px solid #eadff7;">
                      <strong style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#7a6696;margin-bottom:6px;">Campus</strong>
                      <span style="font-size:16px;font-weight:600;color:#2f1d4d;">${campus}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 20px;">
                      <strong style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#7a6696;margin-bottom:6px;">Status</strong>
                      <span style="font-size:16px;font-weight:600;color:#2f1d4d;">${status}</span>
                    </td>
                    <td style="padding:18px 20px;border-left:1px solid #eadff7;">
                      <strong style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#7a6696;margin-bottom:6px;">Contact Email</strong>
                      <span style="font-size:16px;font-weight:600;color:#2f1d4d;">${contactEmail}</span>
                    </td>
                  </tr>
                </table>

                <div style="margin-bottom:24px;border:1px solid #eadff7;background:#ffffff;">
                  <div style="padding:16px 20px;border-bottom:1px solid #eadff7;background:#f9f4fe;">
                    <p style="margin:0;font-size:12px;color:#7a6696;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">Description</p>
                  </div>
                  <div style="padding:20px;">
                    <p style="margin:0;font-size:15px;line-height:1.8;color:#382552;white-space:pre-wrap;">${description}</p>
                  </div>
                </div>

                ${
                  screenshotUrl
                    ? `
                <div style="margin-bottom:24px;">
                  <a href="${screenshotUrl}" style="display:inline-block;background:#5c33a7;color:#ffffff;text-decoration:none;padding:12px 18px;font-size:14px;font-weight:600;">
                    View Screenshot
                  </a>
                </div>
                `
                    : ""
                }

                <div style="border-top:1px solid #eadff7;padding-top:20px;">
                  <p style="margin:0;font-size:12px;color:#8876a2;letter-spacing:0.08em;text-transform:uppercase;">Source</p>
                  <p style="margin:8px 0 0;font-size:14px;color:#4a3768;">${source}</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const payload = (await request.json()) as SupportTicketPayload;
    const apiKey = Deno.env.get("BREVO_API_KEY");
    const senderName = Deno.env.get("BREVO_SENDER_NAME");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    const configuredRecipients = Deno.env.get("SUPPORT_TICKET_TO_EMAILS");

    if (!apiKey || !senderName || !senderEmail || !configuredRecipients) {
      return new Response(
        JSON.stringify({ error: "Brevo support email secrets are not fully configured." }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const recipients = configuredRecipients
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipient emails configured." }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const ticket = payload.ticket ?? {};
    const subject = `[${ticket.priority ?? "Open"}] ${ticket.issue_type ?? "Support Ticket"} - ${ticket.id ?? "Unknown"}`;
    const htmlContent = buildHtmlEmail(payload);

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: recipients,
        replyTo: ticket.contact_email
          ? {
              email: ticket.contact_email,
            }
          : undefined,
        subject,
        htmlContent,
      }),
    });

    const responseText = await brevoResponse.text();

    if (!brevoResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Brevo email send failed.",
          status: brevoResponse.status,
          details: responseText,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Support notification sent.",
        brevo: responseText ? JSON.parse(responseText) : null,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
