import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  CircleCheck,
  Clock3,
  ExternalLink,
  LifeBuoy,
  Loader2,
  Mail,
  SquarePen,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type TicketPriority = "Low" | "Medium" | "High" | "Critical";
type TicketIssueType =
  | "App not loading"
  | "Events not syncing"
  | "Member access issue"
  | "Role/permissions issue"
  | "Messaging issue"
  | "Other";
type TicketCampus = "Rockville" | "TPSS" | "Germantown" | "All";

type TicketFormState = {
  issueType: TicketIssueType;
  campus: TicketCampus;
  description: string;
  priority: TicketPriority;
  contactEmail: string;
  screenshotFile: File | null;
};

type StatusLevel = "Operational" | "Healthy" | "Degraded";

type IncidentLog = {
  id: string;
  issue_type: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
};

const ISSUE_TYPES: TicketIssueType[] = [
  "App not loading",
  "Events not syncing",
  "Member access issue",
  "Role/permissions issue",
  "Messaging issue",
  "Other",
];

const CAMPUSES: TicketCampus[] = ["Rockville", "TPSS", "Germantown", "All"];
const PRIORITIES: TicketPriority[] = ["Low", "Medium", "High", "Critical"];

const SUPPORT_TEAM_EMAIL = "connectcamp-team@montgomerycollege.edu";
const TECH_LEAD_EMAIL = "connectcamp-techlead@montgomerycollege.edu";
const STUDENT_LIFE_IT_EMAIL = "studentlife-it@montgomerycollege.edu";
const EMERGENCY_CONTACT = "(240) 567-5000";

const DOC_ITEMS = [
  { title: "Getting Started Guide", href: "/docs/support/getting-started.md" },
  { title: "Managing Clubs", href: "/docs/support/managing-clubs.md" },
  { title: "Approving Budgets", href: "/docs/support/approving-budgets.md" },
  { title: "Role & Permissions", href: "/docs/support/roles-permissions.md" },
  { title: "Messaging Best Practices", href: "/docs/support/messaging-best-practices.md" },
  { title: "Analytics Guide", href: "/docs/support/analytics-guide.md" },
];

const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const initialTicketForm = (contactEmail: string): TicketFormState => ({
  issueType: "App not loading",
  campus: "All",
  description: "",
  priority: "Medium",
  contactEmail,
  screenshotFile: null,
});

function Support() {
  const { toast } = useToast();
  const { session, profile } = useAuth();

  const statusRef = useRef<HTMLElement | null>(null);
  const docsRef = useRef<HTMLElement | null>(null);
  const featureRef = useRef<HTMLElement | null>(null);

  const accountEmail = useMemo(
    () => profile?.email ?? session?.user?.email ?? "",
    [profile?.email, session?.user?.email],
  );

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState<TicketFormState>(() => initialTicketForm(accountEmail));
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const [appStatus, setAppStatus] = useState<StatusLevel>("Operational");
  const [databaseStatus, setDatabaseStatus] = useState<StatusLevel>("Healthy");
  const [messagingStatus, setMessagingStatus] = useState<StatusLevel>("Operational");
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("cc.support.last_sync") ?? "";
  });
  const [incidentLogs, setIncidentLogs] = useState<IncidentLog[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [featureRequest, setFeatureRequest] = useState("");
  const [submittingFeature, setSubmittingFeature] = useState(false);

  useEffect(() => {
    setTicketForm((prev) => ({
      ...prev,
      contactEmail: accountEmail,
    }));
  }, [accountEmail]);

  useEffect(() => {
    const loadStatus = async () => {
      setLoadingStatus(true);

      let nextAppStatus: StatusLevel = "Operational";
      let nextDbStatus: StatusLevel = "Healthy";
      let nextMessagingStatus: StatusLevel = "Operational";

      try {
        const appPing = await fetch(window.location.origin, { method: "HEAD" });
        if (!appPing.ok) nextAppStatus = "Degraded";
      } catch {
        nextAppStatus = "Degraded";
      }

      const dbProbe = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (dbProbe.error) {
        nextDbStatus = "Degraded";
      }

      const messagingProbe = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (messagingProbe.error) {
        nextMessagingStatus = "Degraded";
      }

      const nowIso = new Date().toISOString();
      setAppStatus(nextAppStatus);
      setDatabaseStatus(nextDbStatus);
      setMessagingStatus(nextMessagingStatus);
      setLastSyncTime(nowIso);
      window.localStorage.setItem("cc.support.last_sync", nowIso);

      const incidentsQuery = await supabase
        .from("support_tickets")
        .select("id, issue_type, priority, status, description, created_at")
        .in("priority", ["High", "Critical"])
        .order("created_at", { ascending: false })
        .limit(8);

      if (!incidentsQuery.error) {
        setIncidentLogs((incidentsQuery.data ?? []) as IncidentLog[]);
      }

      setLoadingStatus(false);
    };

    loadStatus();
  }, []);

  const scrollToSection = (target: "status" | "docs" | "feature") => {
    const map = {
      status: statusRef,
      docs: docsRef,
      feature: featureRef,
    };

    map[target].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openIssueModal = (priority?: TicketPriority) => {
    setTicketForm((prev) => ({
      ...prev,
      priority: priority ?? prev.priority,
      contactEmail: accountEmail,
    }));
    setIssueModalOpen(true);
  };

  const openContactEmail = () => {
    const subject = "Connect Camp Admin Support Request";
    const body = "Please include page URL, campus, and issue details.";
    window.location.href = `mailto:${SUPPORT_TEAM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const submitSupportTicket = async () => {
    if (!ticketForm.description.trim()) {
      toast({
        variant: "destructive",
        title: "Description required",
        description: "Please provide issue details before submitting.",
      });
      return;
    }

    setSubmittingTicket(true);

    let screenshotUrl: string | null = null;
    let screenshotPath: string | null = null;

    if (ticketForm.screenshotFile) {
      const extension = ticketForm.screenshotFile.name.split(".").pop() || "png";
      const safeName = ticketForm.screenshotFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `support-tickets/${session?.user?.id ?? "anonymous"}/${Date.now()}-${safeName}.${extension}`;
      const uploadResult = await supabase
        .storage
        .from("support-attachments")
        .upload(filePath, ticketForm.screenshotFile, {
          upsert: false,
          contentType: ticketForm.screenshotFile.type,
        });

      if (uploadResult.error) {
        setSubmittingTicket(false);
        toast({
          variant: "destructive",
          title: "Screenshot upload failed",
          description: uploadResult.error.message,
        });
        return;
      }

      screenshotPath = filePath;
      screenshotUrl = supabase.storage.from("support-attachments").getPublicUrl(filePath).data.publicUrl;
    }

    const ticketInsert = await supabase
      .from("support_tickets")
      .insert({
        org_id: null,
        campus: ticketForm.campus,
        issue_type: ticketForm.issueType,
        description: ticketForm.description.trim(),
        priority: ticketForm.priority,
        status: "Open",
        assigned_to: null,
        contact_email: ticketForm.contactEmail || null,
        screenshot_url: screenshotUrl,
        created_by: session?.user?.id ?? null,
      })
      .select("id, issue_type, priority, status, description, created_at")
      .single();

    if (ticketInsert.error) {
      setSubmittingTicket(false);
      toast({
        variant: "destructive",
        title: "Ticket submission failed",
        description: ticketInsert.error.message,
      });
      return;
    }

    const ticket = ticketInsert.data as IncidentLog & { id: string };

    const webhookPayload = {
      source: "student-life-admin-support",
      action: "support_ticket_created",
      ticket: {
        id: ticket.id,
        campus: ticketForm.campus,
        issue_type: ticketForm.issueType,
        description: ticketForm.description.trim(),
        priority: ticketForm.priority,
        status: "Open",
        contact_email: ticketForm.contactEmail,
        screenshot_url: screenshotUrl,
        screenshot_path: screenshotPath,
      },
      recipients: [TECH_LEAD_EMAIL, STUDENT_LIFE_IT_EMAIL],
    };

    const edgeResult = await supabase.functions.invoke("support-ticket-notify", {
      body: webhookPayload,
    });

    if (edgeResult.error) {
      let fallbackSent = false;
      try {
        const workspaceSettingsRaw = window.localStorage.getItem("cc.settings.workspace");
        const workspaceSettings = workspaceSettingsRaw ? JSON.parse(workspaceSettingsRaw) : null;
        const fallbackWebhook = workspaceSettings?.webhookUrl as string | undefined;

        if (fallbackWebhook) {
          const fallbackResponse = await fetch(fallbackWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
          });
          fallbackSent = fallbackResponse.ok;
        }
      } catch {
        fallbackSent = false;
      }

      if (!fallbackSent) {
        toast({
          title: "Ticket created with partial delivery",
          description: "Saved to database, but webhook/email delivery could not be confirmed.",
        });
      }
    }

    setIncidentLogs((prev) => [ticket, ...prev].slice(0, 8));
    setSubmittingTicket(false);
    setIssueModalOpen(false);
    setTicketForm(initialTicketForm(accountEmail));
    toast({
      title: "Submitted to IT",
      description: `Ticket ${ticket.id.slice(0, 8)} was submitted successfully.`,
    });
  };

  const submitFeatureRequest = async () => {
    if (!featureRequest.trim()) {
      toast({
        variant: "destructive",
        title: "Request required",
        description: "Please enter an improvement suggestion first.",
      });
      return;
    }

    setSubmittingFeature(true);

    const insert = await supabase
      .from("support_tickets")
      .insert({
        org_id: null,
        campus: "All",
        issue_type: "Other",
        description: `FEATURE_REQUEST: ${featureRequest.trim()}`,
        priority: "Low",
        status: "Open",
        assigned_to: null,
        contact_email: accountEmail || null,
        screenshot_url: null,
        created_by: session?.user?.id ?? null,
      })
      .select("id")
      .single();

    setSubmittingFeature(false);

    if (insert.error) {
      toast({
        variant: "destructive",
        title: "Request failed",
        description: insert.error.message,
      });
      return;
    }

    setFeatureRequest("");
    toast({
      title: "Feature request logged",
      description: "Thank you. This was added for roadmap review.",
    });
  };

  const statusItemClass = "flex items-center justify-between rounded-lg border bg-card/70 px-4 py-3";
  const statusDot = (status: StatusLevel) =>
    status === "Degraded"
      ? "h-2.5 w-2.5 rounded-full bg-amber-500"
      : "h-2.5 w-2.5 rounded-full bg-emerald-500";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Support Center</CardTitle>
              <CardDescription className="mt-1">
                Get help with Connect Camp, report issues, or contact IT.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="h-fit px-3 py-1 text-xs">
              Student Life Admin Workspace
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <QuickActionCard
          icon={<Wrench className="h-5 w-5 text-primary" />}
          title="Report a Technical Issue"
          description="Create a support ticket for platform problems."
          actionLabel="Open form"
          onClick={() => openIssueModal("Medium")}
        />
        <QuickActionCard
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          title="Report Urgent Incident"
          description="Escalate production-impacting incidents immediately."
          actionLabel="Escalate now"
          onClick={() => openIssueModal("Critical")}
        />
        <QuickActionCard
          icon={<Mail className="h-5 w-5 text-primary" />}
          title="Contact Connect Camp Team"
          description="Open a direct email to the internal support channel."
          actionLabel="Email team"
          onClick={openContactEmail}
        />
        <QuickActionCard
          icon={<BookOpen className="h-5 w-5 text-primary" />}
          title="View Documentation"
          description="Open internal admin documentation and playbooks."
          actionLabel="Go to docs"
          onClick={() => scrollToSection("docs")}
        />
        <QuickActionCard
          icon={<CircleCheck className="h-5 w-5 text-primary" />}
          title="System Status"
          description="Review app health, sync timing, and recent incidents."
          actionLabel="View status"
          onClick={() => scrollToSection("status")}
        />
        <QuickActionCard
          icon={<SquarePen className="h-5 w-5 text-primary" />}
          title="Feature Request"
          description="Suggest improvements for Student Life workflows."
          actionLabel="Suggest feature"
          onClick={() => scrollToSection("feature")}
        />
      </section>

      <section ref={statusRef}>
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Current operational health across Connect Camp services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={statusItemClass}>
              <span className="text-sm font-medium">App Status</span>
              <span className="inline-flex items-center gap-2 text-sm">
                <span className={statusDot(appStatus)} />
                {appStatus === "Degraded" ? "Degraded" : "Operational"}
              </span>
            </div>
            <div className={statusItemClass}>
              <span className="text-sm font-medium">Database</span>
              <span className="inline-flex items-center gap-2 text-sm">
                <span className={statusDot(databaseStatus)} />
                {databaseStatus}
              </span>
            </div>
            <div className={statusItemClass}>
              <span className="text-sm font-medium">Messaging Service</span>
              <span className="inline-flex items-center gap-2 text-sm">
                <span className={statusDot(messagingStatus)} />
                {messagingStatus === "Degraded" ? "Degraded" : "Operational"}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Last Sync Time:
              <span className="font-medium text-foreground">
                {lastSyncTime ? formatDateTime(lastSyncTime) : "Unavailable"}
              </span>
              {loadingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            <details className="rounded-lg border bg-card/70">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
                Recent Incidents Log
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="space-y-2 border-t px-4 py-3">
                {incidentLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent high-priority incidents logged.
                  </p>
                ) : (
                  incidentLogs.map((incident) => (
                    <div key={incident.id} className="rounded-md border bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{incident.issue_type}</p>
                        <Badge variant={incident.priority === "Critical" ? "destructive" : "secondary"}>
                          {incident.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {incident.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {incident.status} • {formatDateTime(incident.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      </section>

      <section ref={docsRef}>
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>
              Internal guides for Student Life admins using Connect Camp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {DOC_ITEMS.map((doc) => (
              <details key={doc.title} className="rounded-lg border bg-card/70">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
                  {doc.title}
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Open this guide to review policies and workflows.
                  </p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(doc.href, "_blank", "noopener,noreferrer")}
                  >
                    Open guide
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      </section>

      <section ref={featureRef}>
        <Card>
          <CardHeader>
            <CardTitle>Feature Request</CardTitle>
            <CardDescription>
              Suggest an improvement for Connect Camp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={featureRequest}
              onChange={(event) => setFeatureRequest(event.target.value)}
              rows={5}
              placeholder="Describe the workflow pain point and proposed improvement."
            />
            <Button onClick={submitFeatureRequest} disabled={submittingFeature}>
              {submittingFeature && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit feature request
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Escalation & Response SLA</CardTitle>
          <CardDescription>
            For urgent issues, escalate immediately through the contacts below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border bg-card/70 p-4">
            <p className="text-sm font-semibold">Urgent contacts</p>
            <p className="text-sm text-muted-foreground">
              Connect Camp Technical Lead: {TECH_LEAD_EMAIL}
            </p>
            <p className="text-sm text-muted-foreground">
              Student Life IT: {STUDENT_LIFE_IT_EMAIL}
            </p>
            <p className="text-sm text-muted-foreground">
              Emergency campus contact: {EMERGENCY_CONTACT}
            </p>
          </div>
          <div className="space-y-2 rounded-lg border bg-card/70 p-4">
            <p className="text-sm font-semibold">Response SLA</p>
            <p className="text-sm text-muted-foreground">Critical: &lt; 2 hours</p>
            <p className="text-sm text-muted-foreground">High: &lt; 24 hours</p>
            <p className="text-sm text-muted-foreground">Normal: 1–2 business days</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={issueModalOpen} onOpenChange={setIssueModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
            <DialogDescription>
              Submit platform issues to Student Life IT and the Connect Camp dev team.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue-type">Issue Type</Label>
              <select
                id="issue-type"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={ticketForm.issueType}
                onChange={(event) =>
                  setTicketForm((prev) => ({
                    ...prev,
                    issueType: event.target.value as TicketIssueType,
                  }))
                }
              >
                {ISSUE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campus">Affected Campus</Label>
              <select
                id="campus"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={ticketForm.campus}
                onChange={(event) =>
                  setTicketForm((prev) => ({
                    ...prev,
                    campus: event.target.value as TicketCampus,
                  }))
                }
              >
                {CAMPUSES.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                value={ticketForm.description}
                onChange={(event) =>
                  setTicketForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Describe what happened, expected behavior, and exact steps to reproduce."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="screenshot">Screenshot Upload</Label>
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setTicketForm((prev) => ({
                    ...prev,
                    screenshotFile: event.target.files?.[0] ?? null,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <select
                id="priority"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={ticketForm.priority}
                onChange={(event) =>
                  setTicketForm((prev) => ({
                    ...prev,
                    priority: event.target.value as TicketPriority,
                  }))
                }
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={ticketForm.contactEmail}
                onChange={(event) =>
                  setTicketForm((prev) => ({
                    ...prev,
                    contactEmail: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitSupportTicket} disabled={submittingTicket}>
              {submittingTicket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit to IT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  actionLabel,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-card/90"
    >
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        {actionLabel}
        <LifeBuoy className="h-4 w-4" />
      </p>
    </button>
  );
}

export default Support;
