import { supabase } from "@/lib/supabaseClient";

export const WORKSPACE_SETTINGS_KEY = "cc.settings.workspace";
export const ALERT_SETTINGS_KEY = "cc.settings.alerts";
export const SIDEBAR_COMPACT_KEY = "cc.sidebar.compact.default";
export const WORKSPACE_ORG_KEY = "cc.settings.org_id";

export type WorkspaceSettings = {
  organizationName: string;
  replyToEmail: string;
  supportEmail: string;
  webhookUrl: string;
  timezone: string;
  schoolEmailDomain: string;
  compactSidebarDefault: boolean;
};

export type AlertSettings = {
  officerRequests: boolean;
  budgetApprovals: boolean;
  eventEscalations: boolean;
  dailyDigest: boolean;
};

type WorkspaceSettingsRow = {
  org_id: string;
  organization_name: string | null;
  reply_to_email: string | null;
  support_email: string | null;
  webhook_url: string | null;
  timezone: string | null;
  school_email_domain: string | null;
  compact_sidebar_default: boolean | null;
  alert_officer_requests: boolean | null;
  alert_budget_approvals: boolean | null;
  alert_event_escalations: boolean | null;
  alert_daily_digest: boolean | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  organizationName: "Connect Camp",
  replyToEmail: "info@connectcamp.io",
  supportEmail: "studentlifeit@montgomerycollege.edu",
  webhookUrl: "",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC",
  schoolEmailDomain: "montgomerycollege.com",
  compactSidebarDefault: false,
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  officerRequests: true,
  budgetApprovals: true,
  eventEscalations: true,
  dailyDigest: false,
};

export function readCachedWorkspaceSettings() {
  let workspaceSettings = DEFAULT_WORKSPACE_SETTINGS;
  let alertSettings = DEFAULT_ALERT_SETTINGS;
  let compactSidebarDefault = DEFAULT_WORKSPACE_SETTINGS.compactSidebarDefault;

  if (typeof window === "undefined") {
    return { workspaceSettings, alertSettings, compactSidebarDefault };
  }

  try {
    const storedWorkspace = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY);
    if (storedWorkspace) {
      workspaceSettings = {
        ...DEFAULT_WORKSPACE_SETTINGS,
        ...JSON.parse(storedWorkspace),
      } satisfies WorkspaceSettings;
    }
  } catch {
    workspaceSettings = DEFAULT_WORKSPACE_SETTINGS;
  }

  try {
    const storedAlerts = window.localStorage.getItem(ALERT_SETTINGS_KEY);
    if (storedAlerts) {
      alertSettings = {
        ...DEFAULT_ALERT_SETTINGS,
        ...JSON.parse(storedAlerts),
      } satisfies AlertSettings;
    }
  } catch {
    alertSettings = DEFAULT_ALERT_SETTINGS;
  }

  compactSidebarDefault = window.localStorage.getItem(SIDEBAR_COMPACT_KEY) === "true";

  return {
    workspaceSettings: {
      ...workspaceSettings,
      compactSidebarDefault,
    },
    alertSettings,
    compactSidebarDefault,
  };
}

export function cacheWorkspaceSettings(params: {
  orgId?: string | null;
  workspaceSettings: WorkspaceSettings;
  alertSettings: AlertSettings;
}) {
  if (typeof window === "undefined") return;

  const normalizedWorkspace = {
    ...params.workspaceSettings,
    schoolEmailDomain: normalizeDomain(params.workspaceSettings.schoolEmailDomain),
  } satisfies WorkspaceSettings;

  window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(normalizedWorkspace));
  window.localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(params.alertSettings));
  window.localStorage.setItem(
    SIDEBAR_COMPACT_KEY,
    normalizedWorkspace.compactSidebarDefault ? "true" : "false",
  );
  if (params.orgId) {
    window.localStorage.setItem(WORKSPACE_ORG_KEY, params.orgId);
    window.localStorage.setItem("cc.workspace.org_id", params.orgId);
  }
  window.dispatchEvent(new Event("cc:settings-updated"));
}

function normalizeDomain(domain: string) {
  return domain.trim().replace(/^@+/, "").toLowerCase();
}

function mapRowToSettings(row: WorkspaceSettingsRow | null | undefined) {
  const workspaceSettings: WorkspaceSettings = {
    organizationName: row?.organization_name ?? DEFAULT_WORKSPACE_SETTINGS.organizationName,
    replyToEmail: row?.reply_to_email ?? DEFAULT_WORKSPACE_SETTINGS.replyToEmail,
    supportEmail: row?.support_email ?? DEFAULT_WORKSPACE_SETTINGS.supportEmail,
    webhookUrl: row?.webhook_url ?? DEFAULT_WORKSPACE_SETTINGS.webhookUrl,
    timezone: row?.timezone ?? DEFAULT_WORKSPACE_SETTINGS.timezone,
    schoolEmailDomain: normalizeDomain(row?.school_email_domain ?? DEFAULT_WORKSPACE_SETTINGS.schoolEmailDomain),
    compactSidebarDefault: row?.compact_sidebar_default ?? DEFAULT_WORKSPACE_SETTINGS.compactSidebarDefault,
  };

  const alertSettings: AlertSettings = {
    officerRequests: row?.alert_officer_requests ?? DEFAULT_ALERT_SETTINGS.officerRequests,
    budgetApprovals: row?.alert_budget_approvals ?? DEFAULT_ALERT_SETTINGS.budgetApprovals,
    eventEscalations: row?.alert_event_escalations ?? DEFAULT_ALERT_SETTINGS.eventEscalations,
    dailyDigest: row?.alert_daily_digest ?? DEFAULT_ALERT_SETTINGS.dailyDigest,
  };

  return {
    workspaceSettings,
    alertSettings,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  };
}

export async function fetchWorkspaceSettings(orgId: string) {
  const result = await supabase
    .from("workspace_settings")
    .select(
      "org_id, organization_name, reply_to_email, support_email, webhook_url, timezone, school_email_domain, compact_sidebar_default, alert_officer_requests, alert_budget_approvals, alert_event_escalations, alert_daily_digest, updated_at, updated_by",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (result.error) throw result.error;
  return mapRowToSettings((result.data ?? null) as WorkspaceSettingsRow | null);
}

export async function upsertWorkspaceSettings(params: {
  orgId: string;
  updatedBy: string;
  workspaceSettings: WorkspaceSettings;
  alertSettings: AlertSettings;
}) {
  const payload = {
    org_id: params.orgId,
    organization_name: params.workspaceSettings.organizationName.trim() || DEFAULT_WORKSPACE_SETTINGS.organizationName,
    reply_to_email: params.workspaceSettings.replyToEmail.trim() || null,
    support_email: params.workspaceSettings.supportEmail.trim() || null,
    webhook_url: params.workspaceSettings.webhookUrl.trim() || null,
    timezone: params.workspaceSettings.timezone.trim() || DEFAULT_WORKSPACE_SETTINGS.timezone,
    school_email_domain: normalizeDomain(params.workspaceSettings.schoolEmailDomain) || DEFAULT_WORKSPACE_SETTINGS.schoolEmailDomain,
    compact_sidebar_default: params.workspaceSettings.compactSidebarDefault,
    alert_officer_requests: params.alertSettings.officerRequests,
    alert_budget_approvals: params.alertSettings.budgetApprovals,
    alert_event_escalations: params.alertSettings.eventEscalations,
    alert_daily_digest: params.alertSettings.dailyDigest,
    updated_by: params.updatedBy,
  };

  const result = await supabase
    .from("workspace_settings")
    .upsert(payload, { onConflict: "org_id" })
    .select(
      "org_id, organization_name, reply_to_email, support_email, webhook_url, timezone, school_email_domain, compact_sidebar_default, alert_officer_requests, alert_budget_approvals, alert_event_escalations, alert_daily_digest, updated_at, updated_by",
    )
    .single();

  if (result.error) throw result.error;
  return mapRowToSettings(result.data as WorkspaceSettingsRow);
}
