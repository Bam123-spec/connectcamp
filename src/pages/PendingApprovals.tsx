import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Filter,
  MessageSquareText,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  addApprovalComment,
  assignApprovalRequest,
  fetchApprovalWorkspace,
  setApprovalStatus,
  syncApprovalRequests,
  updateApprovalPriority,
  type ApprovalActivityRow,
  type ApprovalAdminProfile,
  type ApprovalCommentRow,
  type ApprovalPriority,
  type ApprovalQueue,
  type ApprovalRequestRow,
  type ApprovalStatus,
} from "@/lib/approvalsApi";
import { cn } from "@/lib/utils";

type QueueFilter = "all" | ApprovalQueue;
type StatusFilter = "all" | "active" | ApprovalStatus;
type PriorityFilter = "all" | ApprovalPriority;
type AssigneeFilter = "all" | "mine" | "unassigned";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Active work" },
  { value: "all", label: "All statuses" },
  { value: "pending_review", label: "Pending review" },
  { value: "in_review", label: "In review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const PRIORITY_OPTIONS: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const QUEUE_OPTIONS: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All queues" },
  { value: "clubs", label: "Clubs" },
  { value: "events", label: "Events" },
  { value: "budgets", label: "Budgets" },
];

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value: string | null) {
  if (!value) return "Date TBA";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status: ApprovalStatus) {
  switch (status) {
    case "pending_review":
      return "Pending review";
    case "in_review":
      return "In review";
    case "changes_requested":
      return "Changes requested";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
  }
}

function formatPriorityLabel(priority: ApprovalPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function formatQueueLabel(queue: ApprovalQueue) {
  switch (queue) {
    case "clubs":
      return "Clubs";
    case "events":
      return "Events";
    case "budgets":
      return "Budgets";
  }
}

function getStatusClasses(status: ApprovalStatus) {
  switch (status) {
    case "pending_review":
      return "bg-amber-100 text-amber-800";
    case "in_review":
      return "bg-blue-100 text-blue-700";
    case "changes_requested":
      return "bg-orange-100 text-orange-800";
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-red-100 text-red-700";
  }
}

function getPriorityClasses(priority: ApprovalPriority) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-slate-100 text-slate-700";
    case "low":
      return "bg-slate-50 text-slate-600";
  }
}

function getAssigneeLabel(request: ApprovalRequestRow, admins: ApprovalAdminProfile[]) {
  if (!request.assigned_to) return "Unassigned";
  const assignee = admins.find((admin) => admin.id === request.assigned_to);
  return assignee?.full_name || assignee?.email || "Assigned admin";
}

function getRequesterLabel(request: ApprovalRequestRow, admins: ApprovalAdminProfile[]) {
  if (!request.submitted_by) return "System or workspace";
  const submitter = admins.find((admin) => admin.id === request.submitted_by);
  return submitter?.full_name || submitter?.email || "Workspace user";
}

function getRequestContext(request: ApprovalRequestRow) {
  const metadata = request.metadata ?? {};

  if (request.entity_type === "club") {
    const meetingDay = typeof metadata.meeting_day === "string" ? metadata.meeting_day : null;
    const meetingTime = typeof metadata.meeting_time === "string" ? metadata.meeting_time : null;
    const email = typeof metadata.email === "string" ? metadata.email : null;
    const location = typeof metadata.location === "string" ? metadata.location : null;

    return [
      location || "Location not set",
      meetingDay || meetingTime ? [meetingDay, meetingTime].filter(Boolean).join(" • ") : null,
      email,
    ]
      .filter(Boolean)
      .join(" • ");
  }

  const date = typeof metadata.date === "string" ? metadata.date : null;
  const time = typeof metadata.time === "string" ? metadata.time : null;
  const location = typeof metadata.location === "string" ? metadata.location : null;
  const clubName = typeof metadata.club_name === "string" ? metadata.club_name : null;

  return [clubName || "Student Life", date ? formatDateOnly(date) : null, time, location].filter(Boolean).join(" • ");
}

function ApprovalKpi({
  label,
  value,
  helper,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof ClipboardCheck;
  loading: boolean;
}) {
  return (
    <Card className="rounded-[20px] border-slate-200 shadow-sm">
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            {loading ? <Skeleton className="mt-3 h-8 w-14" /> : <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>}
            <p className="mt-1 text-sm text-slate-500">{helper}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingApprovals() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;
  const userId = profile?.id ?? null;

  const [requests, setRequests] = useState<ApprovalRequestRow[]>([]);
  const [comments, setComments] = useState<ApprovalCommentRow[]>([]);
  const [activity, setActivity] = useState<ApprovalActivityRow[]>([]);
  const [admins, setAdmins] = useState<ApprovalAdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  const loadWorkspace = useCallback(async (isRefresh = false) => {
    if (!orgId) {
      setError("This admin account is missing an organization context.");
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setSyncing(true);
    } else {
      setLoading(true);
    }

    try {
      await syncApprovalRequests();
      const snapshot = await fetchApprovalWorkspace(orgId);
      setRequests(snapshot.requests);
      setComments(snapshot.comments);
      setActivity(snapshot.activity);
      setAdmins(snapshot.admins);
      setError(null);

      setSelectedRequestId((current) => {
        if (current && snapshot.requests.some((request) => request.id === current)) {
          return current;
        }
        return snapshot.requests[0]?.id ?? null;
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load approval queue.";
      setError(message);
      if (isRefresh) {
        toast({
          variant: "destructive",
          title: "Unable to refresh approvals",
          description: message,
        });
      }
    } finally {
      if (isRefresh) setSyncing(false);
      else setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const summary = useMemo(() => {
    const pending = requests.filter((request) => request.status === "pending_review").length;
    const inReview = requests.filter((request) => request.status === "in_review").length;
    const changesRequested = requests.filter((request) => request.status === "changes_requested").length;
    const approved = requests.filter((request) => request.status === "approved").length;
    const assignedToMe = requests.filter((request) => request.assigned_to === userId && !["approved", "rejected"].includes(request.status)).length;
    return { pending, inReview, changesRequested, approved, assignedToMe };
  }, [requests, userId]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesQuery = !query || [request.title, request.summary ?? "", getRequestContext(request)].join(" ").toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (queueFilter !== "all" && request.queue !== queueFilter) return false;
      if (statusFilter === "active") {
        if (!["pending_review", "in_review", "changes_requested"].includes(request.status)) return false;
      } else if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== "all" && request.priority !== priorityFilter) return false;
      if (assigneeFilter === "mine" && request.assigned_to !== userId) return false;
      if (assigneeFilter === "unassigned" && request.assigned_to) return false;
      return true;
    });
  }, [assigneeFilter, priorityFilter, queueFilter, requests, searchQuery, statusFilter, userId]);

  useEffect(() => {
    if (filteredRequests.length === 0) {
      if (!selectedRequestId) return;
      if (!filteredRequests.some((request) => request.id === selectedRequestId)) {
        setSelectedRequestId(null);
      }
      return;
    }

    if (!selectedRequestId || !filteredRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(filteredRequests[0].id);
    }
  }, [filteredRequests, selectedRequestId]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const selectedComments = useMemo(
    () => (selectedRequest ? comments.filter((comment) => comment.request_id === selectedRequest.id) : []),
    [comments, selectedRequest],
  );

  const selectedActivity = useMemo(
    () => (selectedRequest ? activity.filter((entry) => entry.request_id === selectedRequest.id) : []),
    [activity, selectedRequest],
  );

  const activeAlerts = useMemo(
    () => requests.filter((request) => !request.assigned_to && ["urgent", "high"].includes(request.priority) && request.status !== "approved").slice(0, 5),
    [requests],
  );

  const recentDecisions = useMemo(
    () => requests.filter((request) => ["approved", "rejected", "changes_requested"].includes(request.status)).slice(0, 5),
    [requests],
  );

  const adminMap = useMemo(
    () => Object.fromEntries(admins.map((admin) => [admin.id, admin])),
    [admins],
  );

  const runAction = async (key: string, action: () => Promise<void>, successTitle: string, successDescription: string, clearNotes = false) => {
    setActioning(key);
    try {
      await action();
      toast({ title: successTitle, description: successDescription });
      if (clearNotes) {
        setDecisionNote("");
        setCommentDraft("");
      }
      await loadWorkspace(true);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "The action could not be completed.";
      toast({ variant: "destructive", title: "Action failed", description: message });
    } finally {
      setActioning(null);
    }
  };

  const handleStatusChange = async (nextStatus: ApprovalStatus) => {
    if (!selectedRequest) return;
    await runAction(
      `status:${nextStatus}`,
      () => setApprovalStatus(selectedRequest.id, nextStatus, decisionNote),
      "Approval updated",
      `${selectedRequest.title} is now ${formatStatusLabel(nextStatus).toLowerCase()}.`,
      true,
    );
  };

  const handlePriorityChange = async (nextPriority: ApprovalPriority) => {
    if (!selectedRequest || nextPriority === selectedRequest.priority) return;
    await runAction(
      `priority:${nextPriority}`,
      () => updateApprovalPriority(selectedRequest.id, nextPriority, decisionNote),
      "Priority updated",
      `${selectedRequest.title} is now ${formatPriorityLabel(nextPriority).toLowerCase()} priority.`,
      true,
    );
  };

  const handleAssigneeChange = async (value: string) => {
    if (!selectedRequest) return;
    const assigneeId = value === "unassigned" ? null : value;
    if (assigneeId === selectedRequest.assigned_to) return;
    await runAction(
      `assignee:${value}`,
      () => assignApprovalRequest(selectedRequest.id, assigneeId, decisionNote),
      "Assignment updated",
      assigneeId ? `${selectedRequest.title} has been assigned.` : `${selectedRequest.title} is now unassigned.`,
      true,
    );
  };

  const handleAddComment = async () => {
    if (!selectedRequest || !commentDraft.trim()) return;
    await runAction(
      "comment",
      () => addApprovalComment(selectedRequest.id, commentDraft),
      "Note added",
      `Internal note saved on ${selectedRequest.title}.`,
      true,
    );
  };

  const emptyState = () => {
    if (loading) {
      return <Skeleton className="h-72 rounded-[24px]" />;
    }

    if (error) {
      return (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
          Unable to load approvals: {error}
        </div>
      );
    }

    if (filteredRequests.length === 0) {
      return (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900">No requests in this view.</p>
          <p className="mt-2 text-sm text-slate-500">
            {statusFilter === "active"
              ? "You are caught up on active review work. Switch the status filter to Approved or All if you want to audit past decisions."
              : "Try a different search or filter combination."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredRequests.map((request) => {
          const selected = request.id === selectedRequestId;
          return (
            <article
              key={request.id}
              onClick={() => {
                setSelectedRequestId(request.id);
                setDetailOpen(true);
              }}
              className={cn(
                "w-full cursor-pointer rounded-[22px] border px-4 py-4 text-left transition-colors",
                selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-950">{request.title}</p>
                    <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{formatQueueLabel(request.queue)}</Badge>
                    <Badge className={cn("rounded-full border-0", getStatusClasses(request.status))}>{formatStatusLabel(request.status)}</Badge>
                    <Badge className={cn("rounded-full border-0", getPriorityClasses(request.priority))}>{formatPriorityLabel(request.priority)}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{request.summary || "No submission summary is on file yet."}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>Assignee: {getAssigneeLabel(request, admins)}</span>
                    <span>Submitted: {formatDateTime(request.submitted_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{getRequestContext(request) || "No operational context has been attached yet."}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!request.assigned_to && userId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-slate-200"
                      loading={actioning === `assign-self:${request.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        runAction(
                          `assign-self:${request.id}`,
                          () => assignApprovalRequest(request.id, userId),
                          "Assigned to you",
                          `${request.title} is now in your queue.`
                        );
                      }}
                    >
                      Assign to me
                    </Button>
                  ) : null}
                    <Button size="sm" className="rounded-full">Review</Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Approvals</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Run club and event review from one operational queue with assignment, reviewer notes, decision history, and clean separation between active work and archive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full border-slate-200 bg-white" asChild>
            <Link to="/events">Open events</Link>
          </Button>
          <Button variant="outline" className="rounded-full border-slate-200 bg-white" asChild>
            <Link to="/clubs">Open clubs</Link>
          </Button>
          <Button className="rounded-full" loading={syncing} leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => loadWorkspace(true)}>
            Sync queue
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <ApprovalKpi label="Pending review" value={summary.pending} helper="Fresh submissions waiting for triage" icon={Clock3} loading={loading} />
        <ApprovalKpi label="In review" value={summary.inReview} helper="Work actively being processed" icon={ClipboardCheck} loading={loading} />
        <ApprovalKpi label="Changes requested" value={summary.changesRequested} helper="Need submitter follow-up" icon={AlertTriangle} loading={loading} />
        <ApprovalKpi label="Approved" value={summary.approved} helper="Closed successfully" icon={CheckCircle2} loading={loading} />
        <ApprovalKpi label="Assigned to me" value={summary.assignedToMe} helper="Your current workload" icon={UserCheck} loading={loading} />
      </div>

      <Card className="rounded-[24px] border-slate-200 shadow-sm">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_180px_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search requests, summaries, dates, or locations"
                className="h-11 rounded-2xl border-slate-200 pl-10"
              />
            </div>
            <Select value={queueFilter} onValueChange={(value) => setQueueFilter(value as QueueFilter)}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                <SelectValue placeholder="Queue" />
              </SelectTrigger>
              <SelectContent>
                {QUEUE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={(value) => setAssigneeFilter(value as AssigneeFilter)}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="mine">Assigned to me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_340px]">
        <Card className="rounded-[24px] border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl tracking-tight">Approval queue</CardTitle>
                <CardDescription>Process active work, then audit decisions without leaving the queue.</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                <Filter className="mr-1 h-3.5 w-3.5" />
                {filteredRequests.length} visible
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">{emptyState()}</CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg tracking-tight">Urgent and unassigned</CardTitle>
              <CardDescription>High-risk work with no owner attached yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-44 rounded-[20px]" />
              ) : activeAlerts.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                  No urgent unassigned approvals right now.
                </div>
              ) : (
                activeAlerts.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(request.id);
                      setDetailOpen(true);
                    }}
                    className="w-full rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition-colors hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{request.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatQueueLabel(request.queue)} • {formatPriorityLabel(request.priority)}</p>
                      </div>
                      <Badge className={cn("rounded-full border-0", getPriorityClasses(request.priority))}>{formatPriorityLabel(request.priority)}</Badge>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg tracking-tight">Recent decisions</CardTitle>
              <CardDescription>Latest closed or returned requests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-44 rounded-[20px]" />
              ) : recentDecisions.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                  No recent decisions have been recorded yet.
                </div>
              ) : (
                recentDecisions.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(request.id);
                      setDetailOpen(true);
                    }}
                    className="w-full rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition-colors hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{request.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatDateTime(request.last_action_at)}</p>
                      </div>
                      <Badge className={cn("rounded-full border-0", getStatusClasses(request.status))}>{formatStatusLabel(request.status)}</Badge>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={detailOpen && Boolean(selectedRequest)} onOpenChange={(open) => {
        setDetailOpen(open);
        if (!open) {
          setDecisionNote("");
          setCommentDraft("");
        }
      }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selectedRequest ? (
            <div className="space-y-6 pr-2">
              <SheetHeader>
                <SheetTitle className="text-2xl tracking-tight">{selectedRequest.title}</SheetTitle>
                <SheetDescription>
                  {formatQueueLabel(selectedRequest.queue)} request • submitted {formatDateTime(selectedRequest.submitted_at)} • current owner {getAssigneeLabel(selectedRequest, admins)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{formatQueueLabel(selectedRequest.queue)}</Badge>
                <Badge className={cn("rounded-full border-0", getStatusClasses(selectedRequest.status))}>{formatStatusLabel(selectedRequest.status)}</Badge>
                <Badge className={cn("rounded-full border-0", getPriorityClasses(selectedRequest.priority))}>{formatPriorityLabel(selectedRequest.priority)}</Badge>
              </div>

              <Card className="rounded-[22px] border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Request context</CardTitle>
                  <CardDescription>{selectedRequest.summary || "No submission summary is on file yet."}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Submitted by</p>
                    <p className="mt-2 text-sm font-medium text-slate-950">{getRequesterLabel(selectedRequest, admins)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operational context</p>
                    <p className="mt-2 text-sm font-medium text-slate-950">{getRequestContext(selectedRequest) || "No extra context on file."}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last action</p>
                    <p className="mt-2 text-sm font-medium text-slate-950">{formatDateTime(selectedRequest.last_action_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Decision recorded</p>
                    <p className="mt-2 text-sm font-medium text-slate-950">{selectedRequest.decided_at ? formatDateTime(selectedRequest.decided_at) : "Not decided yet"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[22px] border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Workflow controls</CardTitle>
                  <CardDescription>Assign ownership, set priority, then move the request through the queue with a reviewer note.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-900">Assigned reviewer</label>
                      <Select value={selectedRequest.assigned_to ?? "unassigned"} onValueChange={handleAssigneeChange}>
                        <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                          <SelectValue placeholder="Assign reviewer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {admins.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.full_name || admin.email || "Admin"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-900">Priority</label>
                      <Select value={selectedRequest.priority} onValueChange={(value) => handlePriorityChange(value as ApprovalPriority)}>
                        <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                          <SelectValue placeholder="Set priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {(["urgent", "high", "medium", "low"] as ApprovalPriority[]).map((priority) => (
                            <SelectItem key={priority} value={priority}>{formatPriorityLabel(priority)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Reviewer note</label>
                    <Textarea
                      value={decisionNote}
                      onChange={(event) => setDecisionNote(event.target.value)}
                      placeholder="Capture why this is approved, rejected, or needs changes. The note is stored in the audit trail."
                      className="min-h-[110px] rounded-2xl border-slate-200"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-full border-slate-200" loading={actioning === "status:pending_review"} onClick={() => handleStatusChange("pending_review")}>Move to pending</Button>
                    <Button variant="outline" className="rounded-full border-slate-200" loading={actioning === "status:in_review"} onClick={() => handleStatusChange("in_review")}>Start review</Button>
                    <Button variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100" loading={actioning === "status:changes_requested"} onClick={() => handleStatusChange("changes_requested")}>Request changes</Button>
                    <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" loading={actioning === "status:approved"} onClick={() => handleStatusChange("approved")}>Approve</Button>
                    <Button variant="destructive" className="rounded-full" loading={actioning === "status:rejected"} onClick={() => handleStatusChange("rejected")}>Reject</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[22px] border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Reviewer notes</CardTitle>
                  <CardDescription>Internal comments stay with the request and help the next admin understand what happened.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Add an internal note, context for another admin, or what the requester needs to fix."
                      className="min-h-[96px] rounded-2xl border-slate-200"
                    />
                    <Button className="rounded-full" loading={actioning === "comment"} leftIcon={<MessageSquareText className="h-4 w-4" />} onClick={handleAddComment}>
                      Save note
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedComments.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                        No internal notes yet.
                      </div>
                    ) : (
                      selectedComments.map((comment) => (
                        <div key={comment.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-950">{adminMap[comment.author_id]?.full_name || adminMap[comment.author_id]?.email || "Admin"}</p>
                            <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{comment.kind === "decision" ? "Decision" : "Note"}</Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{comment.body}</p>
                          <p className="mt-2 text-xs text-slate-400">{formatDateTime(comment.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[22px] border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Activity trail</CardTitle>
                  <CardDescription>Assignment, status, and note history for this request.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedActivity.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                      No activity has been recorded yet.
                    </div>
                  ) : (
                    selectedActivity.map((entry) => (
                      <div key={entry.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{entry.action.replaceAll("_", " ")}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {entry.from_status && entry.to_status
                                ? `${formatStatusLabel(entry.from_status)} → ${formatStatusLabel(entry.to_status)}`
                                : "Workflow event recorded"}
                            </p>
                          </div>
                          <span className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default PendingApprovals;
