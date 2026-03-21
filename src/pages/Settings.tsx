import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BellRing,
  Building2,
  Clock3,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  Siren,
  Users,
  Webhook,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_ALERT_SETTINGS,
  DEFAULT_WORKSPACE_SETTINGS,
  type AlertSettings,
  type WorkspaceSettings,
  cacheWorkspaceSettings,
  fetchWorkspaceSettings,
  readCachedWorkspaceSettings,
  upsertWorkspaceSettings,
} from "@/lib/workspaceSettings";

type WorkspaceStats = {
  adminCount: number;
  clubCount: number;
  officerCount: number;
  clubsWithMessagingCoverage: number;
};

const ALERT_ITEMS: Array<{
  key: keyof AlertSettings;
  label: string;
  description: string;
}> = [
  {
    key: "officerRequests",
    label: "Officer request approvals",
    description: "Flag leadership changes that need Student Life review.",
  },
  {
    key: "budgetApprovals",
    label: "Budget approvals",
    description: "Alert when spending requests require immediate action.",
  },
  {
    key: "eventEscalations",
    label: "Event escalations",
    description: "Surface event risk or policy violations quickly.",
  },
  {
    key: "dailyDigest",
    label: "Daily digest",
    description: "Send one daily operational summary instead of only individual alerts.",
  },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function looksLikeEmail(value: string) {
  return emailPattern.test(value.trim());
}

function looksLikeUrl(value: string) {
  if (!value.trim()) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not saved yet";
  return new Date(value).toLocaleString();
}

async function fetchWorkspaceStats(orgId: string): Promise<WorkspaceStats> {
  const [adminsResult, clubsResult, officersResult, conversationsResult, membersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role", { count: "exact" })
      .eq("org_id", orgId)
      .in("role", ["admin", "student_life_admin", "super_admin"]),
    supabase.from("clubs").select("id", { count: "exact" }).eq("org_id", orgId),
    supabase.from("officers").select("id, club_id"),
    supabase.from("admin_conversations").select("id, club_id").eq("org_id", orgId).eq("type", "club"),
    supabase.from("admin_conversation_members").select("conversation_id, role"),
  ]);

  if (adminsResult.error) throw adminsResult.error;
  if (clubsResult.error) throw clubsResult.error;
  if (officersResult.error) throw officersResult.error;
  if (conversationsResult.error) throw conversationsResult.error;
  if (membersResult.error) throw membersResult.error;

  const clubIds = new Set(((clubsResult.data ?? []) as Array<{ id: string }>).map((club) => club.id));
  const officerCount = ((officersResult.data ?? []) as Array<{ id: string; club_id: string | null }>)
    .filter((row) => row.club_id && clubIds.has(row.club_id))
    .length;

  const clubConversationIds = new Map<string, string>();
  ((conversationsResult.data ?? []) as Array<{ id: string; club_id: string | null }>).forEach((row) => {
    if (row.club_id) clubConversationIds.set(row.club_id, row.id);
  });

  const clubConversationSet = new Set(
    ((membersResult.data ?? []) as Array<{ conversation_id: string; role: string | null }>)
      .filter((row) => row.role === "club")
      .map((row) => row.conversation_id),
  );

  const clubsWithMessagingCoverage = Array.from(clubConversationIds.values()).filter((conversationId) =>
    clubConversationSet.has(conversationId),
  ).length;

  return {
    adminCount: adminsResult.count ?? 0,
    clubCount: clubsResult.count ?? 0,
    officerCount,
    clubsWithMessagingCoverage,
  };
}

function Settings() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const cached = useMemo(() => readCachedWorkspaceSettings(), []);
  const orgId = profile?.org_id ?? (typeof window !== "undefined" ? window.localStorage.getItem("cc.settings.org_id") : null);

  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(cached.workspaceSettings);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(cached.alertSettings);
  const [savedWorkspaceSettings, setSavedWorkspaceSettings] = useState<WorkspaceSettings>(cached.workspaceSettings);
  const [savedAlertSettings, setSavedAlertSettings] = useState<AlertSettings>(cached.alertSettings);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [savedAvatarUrl, setSavedAvatarUrl] = useState("");

  const [stats, setStats] = useState<WorkspaceStats>({
    adminCount: 0,
    clubCount: 0,
    officerCount: 0,
    clubsWithMessagingCoverage: 0,
  });
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | null>(null);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    const nextDisplayName = profile?.full_name ?? "";
    const nextAvatarUrl = profile?.avatar_url ?? "";
    setDisplayName(nextDisplayName);
    setAvatarUrl(nextAvatarUrl);
    setSavedDisplayName(nextDisplayName);
    setSavedAvatarUrl(nextAvatarUrl);
  }, [profile?.avatar_url, profile?.full_name]);

  useEffect(() => {
    let active = true;

    const loadWorkspace = async () => {
      if (!orgId) {
        setLoadingSettings(false);
        setLoadingStats(false);
        return;
      }

      setLoadingSettings(true);
      setLoadingStats(true);

      try {
        const [settingsPayload, statsPayload] = await Promise.all([
          fetchWorkspaceSettings(orgId),
          fetchWorkspaceStats(orgId),
        ]);

        if (!active) return;

        setWorkspaceSettings(settingsPayload.workspaceSettings);
        setSavedWorkspaceSettings(settingsPayload.workspaceSettings);
        setAlertSettings(settingsPayload.alertSettings);
        setSavedAlertSettings(settingsPayload.alertSettings);
        setSettingsUpdatedAt(settingsPayload.updatedAt ?? null);
        setStats(statsPayload);

        cacheWorkspaceSettings({
          orgId,
          workspaceSettings: settingsPayload.workspaceSettings,
          alertSettings: settingsPayload.alertSettings,
        });
      } catch (error) {
        if (!active) return;
        toast({
          variant: "destructive",
          title: "Could not load workspace settings",
          description: error instanceof Error ? error.message : "Please retry.",
        });
      } finally {
        if (active) {
          setLoadingSettings(false);
          setLoadingStats(false);
        }
      }
    };

    loadWorkspace();

    return () => {
      active = false;
    };
  }, [orgId, toast]);

  const accountEmail = profile?.email ?? session?.user?.email ?? "";
  const profileDirty = displayName !== savedDisplayName || avatarUrl !== savedAvatarUrl;
  const workspaceDirty = JSON.stringify(workspaceSettings) !== JSON.stringify(savedWorkspaceSettings);
  const alertDirty = JSON.stringify(alertSettings) !== JSON.stringify(savedAlertSettings);
  const enabledAlerts = ALERT_ITEMS.filter((item) => alertSettings[item.key]).length;
  const avatarFallback = (displayName || accountEmail || "CC")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const saveProfileSettings = async () => {
    if (!session?.user?.id) {
      toast({
        variant: "destructive",
        title: "No active session",
        description: "Please sign in again to save profile settings.",
      });
      return;
    }

    if (avatarUrl.trim() && !looksLikeUrl(avatarUrl)) {
      toast({
        variant: "destructive",
        title: "Invalid avatar URL",
        description: "Use a full https:// URL for the avatar image.",
      });
      return;
    }

    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", session.user.id);
    setSavingProfile(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to save profile",
        description: error.message,
      });
      return;
    }

    await refreshProfile(session.user.id);
    setSavedDisplayName(displayName);
    setSavedAvatarUrl(avatarUrl);
    toast({ title: "Profile updated", description: "Your admin profile settings were saved." });
  };

  const saveWorkspacePreferences = async () => {
    if (!session?.user?.id || !orgId) {
      toast({
        variant: "destructive",
        title: "Workspace unavailable",
        description: "This account is missing an organization context.",
      });
      return;
    }

    if (workspaceSettings.replyToEmail.trim() && !looksLikeEmail(workspaceSettings.replyToEmail)) {
      toast({ variant: "destructive", title: "Invalid reply-to email", description: "Enter a valid reply-to address." });
      return;
    }

    if (workspaceSettings.supportEmail.trim() && !looksLikeEmail(workspaceSettings.supportEmail)) {
      toast({ variant: "destructive", title: "Invalid support email", description: "Enter a valid support contact email." });
      return;
    }

    if (!looksLikeUrl(workspaceSettings.webhookUrl)) {
      toast({ variant: "destructive", title: "Invalid webhook URL", description: "Webhook URL must be a full valid URL." });
      return;
    }

    if (!workspaceSettings.organizationName.trim()) {
      toast({ variant: "destructive", title: "Organization name required", description: "Workspace name cannot be empty." });
      return;
    }

    setSavingWorkspace(true);
    try {
      const result = await upsertWorkspaceSettings({
        orgId,
        updatedBy: session.user.id,
        workspaceSettings,
        alertSettings,
      });

      setWorkspaceSettings(result.workspaceSettings);
      setSavedWorkspaceSettings(result.workspaceSettings);
      setAlertSettings(result.alertSettings);
      setSavedAlertSettings(result.alertSettings);
      setSettingsUpdatedAt(result.updatedAt ?? null);
      cacheWorkspaceSettings({
        orgId,
        workspaceSettings: result.workspaceSettings,
        alertSettings: result.alertSettings,
      });

      toast({
        title: "Workspace settings saved",
        description: "Organization defaults and workspace behavior were updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not save workspace settings",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const saveAlertPreferences = async () => {
    if (!session?.user?.id || !orgId) {
      toast({
        variant: "destructive",
        title: "Workspace unavailable",
        description: "This account is missing an organization context.",
      });
      return;
    }

    setSavingAlerts(true);
    try {
      const result = await upsertWorkspaceSettings({
        orgId,
        updatedBy: session.user.id,
        workspaceSettings,
        alertSettings,
      });

      setWorkspaceSettings(result.workspaceSettings);
      setSavedWorkspaceSettings(result.workspaceSettings);
      setAlertSettings(result.alertSettings);
      setSavedAlertSettings(result.alertSettings);
      setSettingsUpdatedAt(result.updatedAt ?? null);
      cacheWorkspaceSettings({
        orgId,
        workspaceSettings: result.workspaceSettings,
        alertSettings: result.alertSettings,
      });

      toast({
        title: "Alert routing saved",
        description: "Notification preferences for this workspace were updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not save alert settings",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    } finally {
      setSavingAlerts(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!accountEmail) {
      toast({ variant: "destructive", title: "Missing account email", description: "Could not find your login email for reset." });
      return;
    }

    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(accountEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setSendingReset(false);

    if (error) {
      toast({ variant: "destructive", title: "Reset email failed", description: error.message });
      return;
    }

    toast({ title: "Reset email sent", description: `Password reset instructions were sent to ${accountEmail}.` });
  };

  const signOutAllSessions = async () => {
    setSigningOutAll(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOutAll(false);

    if (error) {
      toast({ variant: "destructive", title: "Global sign out failed", description: error.message });
      return;
    }

    toast({ title: "Signed out everywhere", description: "All active sessions were revoked." });
    await signOut();
    navigate("/login");
  };

  const resetWorkspaceDefaults = () => {
    setWorkspaceSettings((prev) => ({
      ...DEFAULT_WORKSPACE_SETTINGS,
      compactSidebarDefault: prev.compactSidebarDefault,
    }));
    setAlertSettings(DEFAULT_ALERT_SETTINGS);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_42%,#eff6ff_100%)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Workspace Control</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Make Settings the operational source of truth.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This page now persists real org-level settings for the admin workspace instead of only static local form fields. Use it to manage identity, routing, alerts, and access policy defaults.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {loadingSettings && (
              <Badge className="rounded-full border-0 bg-blue-100 px-3 py-1.5 text-blue-800 shadow-sm">
                Syncing settings...
              </Badge>
            )}
            <Badge className="rounded-full border-0 bg-white/85 px-3 py-1.5 text-slate-700 shadow-sm">
              Org {orgId ?? "Not configured"}
            </Badge>
            <Badge className="rounded-full border-0 bg-white/85 px-3 py-1.5 text-slate-700 shadow-sm">
              Last saved {formatTimestamp(settingsUpdatedAt)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Admins", value: stats.adminCount, helper: "People who can manage the workspace", icon: Users },
            { label: "Clubs", value: stats.clubCount, helper: "Organizations under this workspace", icon: Building2 },
            { label: "Officers", value: stats.officerCount, helper: "Officer records tied to clubs", icon: ShieldCheck },
            { label: "Messaging-ready clubs", value: stats.clubsWithMessagingCoverage, helper: `${Math.max(stats.clubCount - stats.clubsWithMessagingCoverage, 0)} still missing club-side chat access`, icon: MessageSquare },
            { label: "Alerts enabled", value: enabledAlerts, helper: `${ALERT_ITEMS.length - enabledAlerts} muted operational channels`, icon: BellRing },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-slate-500">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">{stat.label}</p>
                  <Icon className="h-4 w-4" />
                </div>
                {loadingStats ? (
                  <Skeleton className="mt-3 h-8 w-16" />
                ) : (
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
                )}
                <p className="mt-2 text-sm text-slate-500">{stat.helper}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Admin profile</CardTitle>
                  <CardDescription className="mt-1">Update your operator identity used across the admin workspace.</CardDescription>
                </div>
                {profileDirty && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Unsaved</Badge>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 border-t border-slate-200 pt-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 rounded-[24px] border border-slate-200">
                    <AvatarImage src={avatarUrl || profile?.avatar_url || undefined} />
                    <AvatarFallback className="rounded-[24px] bg-slate-100 text-xl text-slate-700">{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <p className="mt-4 text-base font-semibold text-slate-950">{displayName || "Unnamed admin"}</p>
                  <p className="mt-1 text-sm text-slate-500">{accountEmail || "No account email"}</p>
                  <Badge className="mt-4 rounded-full border-0 bg-slate-900 text-white">{profile?.role || "admin"}</Badge>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-1">
                  <label htmlFor="display-name" className="text-sm font-medium text-slate-800">Display name</label>
                  <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-11 rounded-2xl border-slate-200" />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label htmlFor="account-email" className="text-sm font-medium text-slate-800">Account email</label>
                  <Input id="account-email" value={accountEmail} disabled className="h-11 rounded-2xl border-slate-200 bg-slate-50" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="avatar-url" className="text-sm font-medium text-slate-800">Avatar URL</label>
                  <Input id="avatar-url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." className="h-11 rounded-2xl border-slate-200" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={saveProfileSettings} disabled={loadingSettings || savingProfile || !profileDirty} className="rounded-full px-5">
                    {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save profile
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Workspace defaults</CardTitle>
                  <CardDescription className="mt-1">Organization identity, routing, and policy defaults that should persist across the admin workspace.</CardDescription>
                </div>
                {workspaceDirty && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Unsaved</Badge>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="org-name" className="text-sm font-medium text-slate-800">Organization name</label>
                <Input id="org-name" value={workspaceSettings.organizationName} onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, organizationName: event.target.value }))} className="h-11 rounded-2xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <label htmlFor="timezone" className="text-sm font-medium text-slate-800">Timezone</label>
                <Input id="timezone" value={workspaceSettings.timezone} onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, timezone: event.target.value }))} className="h-11 rounded-2xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <label htmlFor="reply-email" className="text-sm font-medium text-slate-800">Reply-to email</label>
                <Input id="reply-email" type="email" value={workspaceSettings.replyToEmail} onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, replyToEmail: event.target.value }))} className="h-11 rounded-2xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <label htmlFor="support-email" className="text-sm font-medium text-slate-800">Support / IT email</label>
                <Input id="support-email" type="email" value={workspaceSettings.supportEmail} onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, supportEmail: event.target.value }))} className="h-11 rounded-2xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <label htmlFor="school-domain" className="text-sm font-medium text-slate-800">School email domain</label>
                <Input id="school-domain" value={workspaceSettings.schoolEmailDomain} onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, schoolEmailDomain: event.target.value }))} placeholder="montgomerycollege.com" className="h-11 rounded-2xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <label htmlFor="webhook-url" className="text-sm font-medium text-slate-800">Fallback webhook URL</label>
                <Input id="webhook-url" value={workspaceSettings.webhookUrl} onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, webhookUrl: event.target.value }))} placeholder="https://project.supabase.co/functions/v1/sync" className="h-11 rounded-2xl border-slate-200" />
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Compact sidebar by default</p>
                    <p className="mt-1 text-sm text-slate-500">Use the collapsed navigation layout as the workspace starting state for new sessions.</p>
                  </div>
                  <Switch checked={workspaceSettings.compactSidebarDefault} onCheckedChange={(checked) => setWorkspaceSettings((prev) => ({ ...prev, compactSidebarDefault: checked }))} />
                </div>
              </div>
              <div className="md:col-span-2 flex flex-wrap justify-between gap-3">
                <Button variant="outline" className="rounded-full" onClick={resetWorkspaceDefaults}>Reset to recommended defaults</Button>
                <Button onClick={saveWorkspacePreferences} disabled={loadingSettings || savingWorkspace || !workspaceDirty} className="rounded-full px-5">
                  {savingWorkspace && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save workspace
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Alert routing</CardTitle>
                  <CardDescription className="mt-1">Choose which operational signals stay loud for this admin workspace.</CardDescription>
                </div>
                {alertDirty && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Unsaved</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-slate-200 pt-6">
              {ALERT_ITEMS.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  </div>
                  <Switch checked={alertSettings[item.key]} onCheckedChange={(checked) => setAlertSettings((prev) => ({ ...prev, [item.key]: checked }))} />
                </div>
              ))}
              <div className="flex justify-end">
                <Button onClick={saveAlertPreferences} disabled={loadingSettings || savingAlerts || !alertDirty} className="rounded-full px-5">
                  {savingAlerts && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save alerts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">Operational posture</CardTitle>
              <CardDescription>Read-only status so Settings also tells you what the workspace actually looks like today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {[
                  { icon: Globe, label: "Timezone", value: workspaceSettings.timezone },
                  { icon: Mail, label: "Reply-to", value: workspaceSettings.replyToEmail || "Not configured" },
                  { icon: Send, label: "Support / IT", value: workspaceSettings.supportEmail || "Not configured" },
                  { icon: Webhook, label: "Fallback webhook", value: workspaceSettings.webhookUrl ? "Configured" : "Not configured" },
                  { icon: Siren, label: "School domain", value: workspaceSettings.schoolEmailDomain },
                  { icon: Clock3, label: "Last updated", value: formatTimestamp(settingsUpdatedAt) },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                        <p className="mt-1 truncate text-sm font-medium text-slate-950">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <ShieldCheck className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Account recovery and session control for admin access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start rounded-2xl border-slate-200 bg-white" onClick={sendPasswordReset} disabled={sendingReset}>
                {sendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send password reset link
              </Button>
              <Button variant="destructive" className="w-full justify-start rounded-2xl" onClick={signOutAllSessions} disabled={signingOutAll}>
                {signingOutAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Sign out all sessions
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">Quick links</CardTitle>
              <CardDescription>Jump directly to the operational surfaces that depend on these settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full justify-start rounded-2xl border-slate-200 bg-white">
                <Link to="/support">
                  <Webhook className="h-4 w-4" />
                  Open Support Center
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start rounded-2xl border-slate-200 bg-white">
                <Link to="/messaging">
                  <MessageSquare className="h-4 w-4" />
                  Open Messaging
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start rounded-2xl border-slate-200 bg-white">
                <Link to="/forms">
                  <Building2 className="h-4 w-4" />
                  Open Forms
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Settings;
