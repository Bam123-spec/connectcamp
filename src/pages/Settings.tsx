import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

type WorkspaceSettings = {
  organizationName: string;
  replyToEmail: string;
  webhookUrl: string;
  timezone: string;
};

type AlertSettings = {
  officerRequests: boolean;
  budgetApprovals: boolean;
  eventEscalations: boolean;
  dailyDigest: boolean;
};

const WORKSPACE_SETTINGS_KEY = "cc.settings.workspace";
const ALERT_SETTINGS_KEY = "cc.settings.alerts";
const SIDEBAR_COMPACT_KEY = "cc.sidebar.compact.default";

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  organizationName: "Connect Camp",
  replyToEmail: "info@connectcamp.io",
  webhookUrl: "",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC",
};

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  officerRequests: true,
  budgetApprovals: true,
  eventEscalations: true,
  dailyDigest: false,
};

const ALERT_ITEMS: Array<{
  key: keyof AlertSettings;
  label: string;
  description: string;
}> = [
  {
    key: "officerRequests",
    label: "New officer requests",
    description: "Notify when a club submits new officer paperwork.",
  },
  {
    key: "budgetApprovals",
    label: "Budget approvals",
    description: "Alert when spending requests require review.",
  },
  {
    key: "eventEscalations",
    label: "Event escalations",
    description: "Send alerts when events are flagged with risk.",
  },
  {
    key: "dailyDigest",
    label: "Daily digest",
    description: "Receive a single daily summary of important changes.",
  },
];

function Settings() {
  const { session, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(
    DEFAULT_WORKSPACE_SETTINGS,
  );
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(
    DEFAULT_ALERT_SETTINGS,
  );

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [compactSidebarDefault, setCompactSidebarDefault] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    try {
      const storedWorkspace = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY);
      if (storedWorkspace) {
        setWorkspaceSettings({
          ...DEFAULT_WORKSPACE_SETTINGS,
          ...JSON.parse(storedWorkspace),
        });
      }
    } catch {
      // Ignore invalid local storage and keep defaults.
    }

    try {
      const storedAlerts = window.localStorage.getItem(ALERT_SETTINGS_KEY);
      if (storedAlerts) {
        setAlertSettings({
          ...DEFAULT_ALERT_SETTINGS,
          ...JSON.parse(storedAlerts),
        });
      }
    } catch {
      // Ignore invalid local storage and keep defaults.
    }

    setCompactSidebarDefault(window.localStorage.getItem(SIDEBAR_COMPACT_KEY) === "true");
  }, []);

  useEffect(() => {
    setDisplayName(profile?.full_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
  }, [profile?.full_name, profile?.avatar_url]);

  const accountEmail = useMemo(
    () => profile?.email ?? session?.user?.email ?? "",
    [profile?.email, session?.user?.email],
  );

  const saveProfileSettings = async () => {
    if (!session?.user?.id) {
      toast({
        variant: "destructive",
        title: "No active session",
        description: "Please sign in again to save profile settings.",
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
    toast({
      title: "Profile updated",
      description: "Your admin profile settings were saved.",
    });
  };

  const saveWorkspacePreferences = () => {
    setSavingWorkspace(true);
    window.localStorage.setItem(
      WORKSPACE_SETTINGS_KEY,
      JSON.stringify(workspaceSettings),
    );
    window.localStorage.setItem(
      SIDEBAR_COMPACT_KEY,
      compactSidebarDefault ? "true" : "false",
    );
    window.dispatchEvent(new Event("cc:settings-updated"));
    setSavingWorkspace(false);

    toast({
      title: "Workspace preferences saved",
      description: "Organization and appearance settings were updated.",
    });
  };

  const saveAlertPreferences = () => {
    setSavingAlerts(true);
    window.localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(alertSettings));
    setSavingAlerts(false);
    toast({
      title: "Alert preferences saved",
      description: "Notification defaults were updated.",
    });
  };

  const sendPasswordReset = async () => {
    if (!accountEmail) {
      toast({
        variant: "destructive",
        title: "Missing account email",
        description: "Could not find your login email for reset.",
      });
      return;
    }

    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(accountEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setSendingReset(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Reset email failed",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Reset email sent",
      description: `Password reset instructions were sent to ${accountEmail}.`,
    });
  };

  const signOutAllSessions = async () => {
    setSigningOutAll(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOutAll(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Global sign out failed",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Signed out everywhere",
      description: "All active sessions were revoked.",
    });
    navigate("/login");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin profile</CardTitle>
          <CardDescription>
            Update your display identity used across the admin workspace.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="display-name" className="text-sm font-medium">
              Display name
            </label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="account-email" className="text-sm font-medium">
              Account email
            </label>
            <Input id="account-email" value={accountEmail} disabled />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="avatar-url" className="text-sm font-medium">
              Avatar URL
            </label>
            <Input
              id="avatar-url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveProfileSettings} disabled={savingProfile}>
            {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace preferences</CardTitle>
          <CardDescription>
            Manage organization defaults and core workspace behavior.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </label>
            <Input
              id="org-name"
              value={workspaceSettings.organizationName}
              onChange={(event) =>
                setWorkspaceSettings((prev) => ({
                  ...prev,
                  organizationName: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reply-email" className="text-sm font-medium">
              Reply-to email
            </label>
            <Input
              id="reply-email"
              type="email"
              value={workspaceSettings.replyToEmail}
              onChange={(event) =>
                setWorkspaceSettings((prev) => ({
                  ...prev,
                  replyToEmail: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="timezone" className="text-sm font-medium">
              Timezone
            </label>
            <Input
              id="timezone"
              value={workspaceSettings.timezone}
              onChange={(event) =>
                setWorkspaceSettings((prev) => ({
                  ...prev,
                  timezone: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="webhook-url" className="text-sm font-medium">
              Supabase webhook URL
            </label>
            <Input
              id="webhook-url"
              value={workspaceSettings.webhookUrl}
              onChange={(event) =>
                setWorkspaceSettings((prev) => ({
                  ...prev,
                  webhookUrl: event.target.value,
                }))
              }
              placeholder="https://project.supabase.co/functions/v1/sync"
            />
          </div>
          <div className="rounded-lg border bg-background/70 p-4 md:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Compact sidebar by default</p>
                <p className="text-sm text-muted-foreground">
                  Start new sessions with the collapsed sidebar layout.
                </p>
              </div>
              <Switch
                checked={compactSidebarDefault}
                onCheckedChange={setCompactSidebarDefault}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveWorkspacePreferences} disabled={savingWorkspace}>
            {savingWorkspace && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save workspace
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert preferences</CardTitle>
          <CardDescription>
            Choose which operational events should trigger admin alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ALERT_ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-lg border bg-background/70 p-4"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={alertSettings[item.key]}
                onCheckedChange={(checked) =>
                  setAlertSettings((prev) => ({
                    ...prev,
                    [item.key]: checked,
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button onClick={saveAlertPreferences} disabled={savingAlerts}>
            {savingAlerts && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save alerts
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>
            Account recovery and session control for admin access.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Button
            variant="outline"
            onClick={sendPasswordReset}
            disabled={sendingReset}
          >
            {sendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send password reset link
          </Button>
          <Button
            variant="destructive"
            onClick={signOutAllSessions}
            disabled={signingOutAll}
          >
            {signingOutAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign out all sessions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
