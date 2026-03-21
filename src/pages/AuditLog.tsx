import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNowStrict, isToday, subDays } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Bell,
  ClipboardCheck,
  Clock3,
  Filter,
  FolderKanban,
  Loader2,
  Search,
  Settings2,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { type AuditEventRow, fetchAuditSnapshot } from "@/lib/auditApi";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All activity" },
  { value: "approvals", label: "Approvals" },
  { value: "settings", label: "Settings" },
  { value: "security", label: "Security" },
  { value: "officers", label: "Officers" },
  { value: "members", label: "Members" },
  { value: "events", label: "Events" },
  { value: "forms", label: "Forms" },
  { value: "tasks", label: "Tasks" },
  { value: "messaging", label: "Messaging" },
] as const;

type CategoryFilter = (typeof CATEGORY_OPTIONS)[number]["value"];
type WindowFilter = "24h" | "7d" | "30d" | "all";

function formatCategoryLabel(category: string) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatActionLabel(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "approvals":
      return ClipboardCheck;
    case "settings":
      return Settings2;
    case "security":
      return Shield;
    case "officers":
      return UserCog;
    case "members":
      return Users;
    case "events":
      return Bell;
    case "forms":
      return FolderKanban;
    case "tasks":
      return FolderKanban;
    default:
      return Activity;
  }
}

function matchesWindowFilter(timestamp: string, windowFilter: WindowFilter) {
  if (windowFilter === "all") return true;
  const createdAt = new Date(timestamp);
  const threshold = windowFilter === "24h" ? subDays(new Date(), 1) : windowFilter === "7d" ? subDays(new Date(), 7) : subDays(new Date(), 30);
  return createdAt >= threshold;
}

function stringifyMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return "";
  return Object.entries(metadata)
    .map(([key, value]) => `${key} ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ")
    .toLowerCase();
}

export default function AuditLog() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const orgId = profile?.org_id ?? null;

  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [actorsById, setActorsById] = useState<Record<string, { full_name: string | null; email: string | null; avatar_url: string | null; role: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("30d");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadAudit = useCallback(
    async (isRefresh = false) => {
      if (!orgId) {
        setError("This admin account is missing an organization context.");
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const snapshot = await fetchAuditSnapshot(orgId, 400);
        setEvents(snapshot.events);
        setActorsById(snapshot.actorsById);
        setSelectedId((current) => current && snapshot.events.some((event) => event.id === current) ? current : snapshot.events[0]?.id ?? null);
        setError(null);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Unable to load audit history.";
        setError(message);
        if (isRefresh) {
          toast({ variant: "destructive", title: "Audit refresh failed", description: message });
        }
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [orgId, toast],
  );

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      if (categoryFilter !== "all" && event.category !== categoryFilter) return false;
      if (!matchesWindowFilter(event.created_at, windowFilter)) return false;
      if (!query) return true;

      const actor = event.actor_id ? actorsById[event.actor_id] : null;
      const haystack = [
        event.title,
        event.summary ?? "",
        event.category,
        event.action,
        event.entity_type ?? "",
        actor?.full_name ?? "",
        actor?.email ?? "",
        stringifyMetadata(event.metadata),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [actorsById, categoryFilter, events, searchQuery, windowFilter]);

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredEvents.some((event) => event.id === selectedId)) {
      setSelectedId(filteredEvents[0].id);
    }
  }, [filteredEvents, selectedId]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.id === selectedId) ?? null,
    [filteredEvents, selectedId],
  );

  const summary = useMemo(() => {
    const todayCount = events.filter((event) => isToday(new Date(event.created_at))).length;
    const approvalCount = events.filter((event) => event.category === "approvals").length;
    const staffingCount = events.filter((event) => ["officers", "members"].includes(event.category)).length;
    const settingsCount = events.filter((event) => ["settings", "security"].includes(event.category)).length;
    return { total: events.length, todayCount, approvalCount, staffingCount, settingsCount };
  }, [events]);

  const sensitiveActions = useMemo(
    () => events.filter((event) => ["security", "settings", "approvals"].includes(event.category)).slice(0, 6),
    [events],
  );

  const selectedActor = selectedEvent?.actor_id ? actorsById[selectedEvent.actor_id] : null;

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_45%,#eff6ff_100%)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Audit Trail</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Track who changed what across the admin workspace.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This is the operational history feed for approvals, settings, staffing, events, forms, tasks, and other sensitive admin actions.
            </p>
          </div>
          <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={() => void loadAudit(true)} disabled={loading || refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
            Refresh feed
          </Button>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total events", value: summary.total, helper: "Recorded admin actions in the current feed", icon: Activity },
            { label: "Today", value: summary.todayCount, helper: "Actions recorded since midnight", icon: Clock3 },
            { label: "Approval actions", value: summary.approvalCount, helper: "Reviews, assignments, and decisions", icon: ClipboardCheck },
            { label: "Config and staffing", value: summary.settingsCount + summary.staffingCount, helper: "Settings, security, officers, and membership changes", icon: AlertTriangle },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-slate-500">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">{stat.label}</p>
                  <Icon className="h-4 w-4" />
                </div>
                {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>}
                <p className="mt-2 text-sm text-slate-500">{stat.helper}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_380px]">
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="space-y-4 border-b border-slate-200 pb-5">
            <div>
              <CardTitle className="text-2xl tracking-tight">Activity feed</CardTitle>
              <CardDescription className="mt-1">Filter by category, timeframe, or operator, then open any item for the full record.</CardDescription>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search titles, operators, actions, or metadata..."
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={windowFilter} onValueChange={(value) => setWindowFilter(value as WindowFilter)}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                  <SelectValue placeholder="Window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-[22px]" />)
            ) : error ? (
              <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                Unable to load audit history: {error}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                <Filter className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-4 text-lg font-semibold text-slate-900">No audit entries match this view.</p>
                <p className="mt-2 text-sm text-slate-500">Try widening the time window or clearing the search query.</p>
              </div>
            ) : (
              filteredEvents.map((event) => {
                const Icon = getCategoryIcon(event.category);
                const actor = event.actor_id ? actorsById[event.actor_id] : null;
                const selected = event.id === selectedId;
                return (
                  <article
                    key={event.id}
                    onClick={() => setSelectedId(event.id)}
                    className={cn(
                      "cursor-pointer rounded-[22px] border px-4 py-4 transition-colors",
                      selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-950">{event.title}</p>
                          <Badge className="rounded-full border-0 bg-slate-900 text-white">{formatCategoryLabel(event.category)}</Badge>
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{formatActionLabel(event.action)}</Badge>
                          {event.entity_type ? <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{formatCategoryLabel(event.entity_type)}</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{event.summary || "No additional summary was captured for this action."}</p>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>{actor?.full_name || actor?.email || "Unknown operator"}</span>
                          <span>{formatDistanceToNowStrict(new Date(event.created_at), { addSuffix: true })}</span>
                          <span>{format(new Date(event.created_at), "MMM d, yyyy h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">Selected entry</CardTitle>
              <CardDescription>Use this panel to inspect the actor, exact time, and structured metadata behind each action.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedEvent ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500">
                  Select an audit entry to inspect its details.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 rounded-2xl border border-slate-200">
                        <AvatarImage src={selectedActor?.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                          {(selectedActor?.full_name || selectedActor?.email || "AU").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-slate-950">{selectedActor?.full_name || selectedActor?.email || "Unknown operator"}</p>
                        <p className="mt-1 text-sm text-slate-500">{selectedActor?.email || "No email on file"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge className="rounded-full border-0 bg-slate-900 text-white">{formatCategoryLabel(selectedEvent.category)}</Badge>
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{formatActionLabel(selectedEvent.action)}</Badge>
                          {selectedActor?.role ? <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{formatCategoryLabel(selectedActor.role)}</Badge> : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-lg font-semibold tracking-tight text-slate-950">{selectedEvent.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{selectedEvent.summary || "No summary was captured."}</p>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                        <span className="font-medium text-slate-900">Recorded</span>
                        <span>{format(new Date(selectedEvent.created_at), "PPP p")}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                        <span className="font-medium text-slate-900">Entity</span>
                        <span>{selectedEvent.entity_type ? formatCategoryLabel(selectedEvent.entity_type) : "Workspace action"}</span>
                      </div>
                      {selectedEvent.entity_id ? (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                          <span className="font-medium text-slate-900">Entity ID</span>
                          <span className="truncate text-right">{selectedEvent.entity_id}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Metadata</p>
                    {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {Object.entries(selectedEvent.metadata).map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm">
                            <span className="font-medium text-slate-900">{formatCategoryLabel(key)}</span>
                            <span className="max-w-[60%] break-words text-right text-slate-600">
                              {typeof value === "string" ? value : JSON.stringify(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No structured metadata was attached to this action.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">Sensitive actions</CardTitle>
              <CardDescription>The latest configuration, security, and approval actions in the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
              ) : sensitiveActions.length === 0 ? (
                <p className="text-sm text-slate-500">No sensitive actions have been recorded yet.</p>
              ) : (
                sensitiveActions.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedId(event.id)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition-colors hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">{event.title}</p>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">{formatCategoryLabel(event.category)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{format(new Date(event.created_at), "MMM d, h:mm a")}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
