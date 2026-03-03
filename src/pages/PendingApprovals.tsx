import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { CalendarDays, Check, RefreshCw, RotateCcw, X } from "lucide-react";

type ApprovalValue = boolean | null;
type EntityKind = "clubs" | "events";

type Club = {
  id: string;
  name: string;
  description: string | null;
  approved: ApprovalValue;
  created_at: string | null;
};

type Event = {
  id: string;
  name: string;
  description: string | null;
  approved: ApprovalValue;
  date: string | null;
  time: string | null;
  location: string | null;
  created_at: string | null;
};

function formatDateLabel(date: string | null, time: string | null) {
  if (!date) return "Date TBA";

  const day = new Date(`${date}T00:00:00`);
  const dateLabel = day.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!time) return dateLabel;

  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return `${dateLabel} • ${time}`;

  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${dateLabel} • ${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

function PendingApprovals() {
  const { toast } = useToast();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingKeys, setUpdatingKeys] = useState<Record<string, boolean>>({});

  const setKeyLoading = (key: string, state: boolean) => {
    setUpdatingKeys((prev) => {
      if (!state) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: true };
    });
  };

  const loadApprovals = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [clubResult, eventResult] = await Promise.all([
      supabase
        .from("clubs")
        .select("id,name,description,approved,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("id,name,description,approved,date,time,location,created_at")
        .order("created_at", { ascending: false }),
    ]);

    const firstError = clubResult.error ?? eventResult.error ?? null;
    if (firstError) {
      setError(firstError.message);
      if (isRefresh) {
        toast({
          variant: "destructive",
          title: "Unable to refresh approvals",
          description: firstError.message,
        });
      }
    } else {
      setClubs((clubResult.data ?? []) as Club[]);
      setEvents((eventResult.data ?? []) as Event[]);
      setError(null);
    }

    if (isRefresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const mutateApproval = async (
    kind: EntityKind,
    id: string,
    nextApproved: ApprovalValue,
  ) => {
    const key = `${kind}:${id}`;
    setKeyLoading(key, true);

    const { error: updateError } = await supabase
      .from(kind)
      .update({ approved: nextApproved })
      .eq("id", id);

    setKeyLoading(key, false);

    if (updateError) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: updateError.message,
      });
      return;
    }

    if (kind === "clubs") {
      setClubs((prev) => prev.map((club) => (club.id === id ? { ...club, approved: nextApproved } : club)));
    } else {
      setEvents((prev) => prev.map((event) => (event.id === id ? { ...event, approved: nextApproved } : event)));
    }

    const statusLabel = nextApproved === true ? "approved" : nextApproved === false ? "rejected" : "moved back to pending";

    toast({
      title: "Decision saved",
      description: `${kind === "clubs" ? "Club" : "Event"} was ${statusLabel}.`,
    });
  };

  const pendingClubs = useMemo(() => clubs.filter((club) => club.approved === null), [clubs]);
  const pendingEvents = useMemo(() => events.filter((event) => event.approved === null), [events]);
  const rejectedClubs = useMemo(() => clubs.filter((club) => club.approved === false), [clubs]);
  const rejectedEvents = useMemo(() => events.filter((event) => event.approved === false), [events]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pending Approvals</h1>
          <p className="text-sm text-muted-foreground">Approve or reject submissions from clubs and events.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-gray-50 text-gray-700">
            {pendingClubs.length + pendingEvents.length} pending
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadApprovals(true)}
            loading={refreshing}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Unable to load approvals: {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending Clubs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : pendingClubs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clubs waiting for review.</p>
            ) : (
              <div className="space-y-3">
                {pendingClubs.map((club) => {
                  const key = `clubs:${club.id}`;
                  const busy = Boolean(updatingKeys[key]);

                  return (
                    <article key={club.id} className="rounded-xl border p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-semibold leading-tight">{club.name}</p>
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground">{club.description ?? "No description."}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => mutateApproval("clubs", club.id, true)}
                          loading={busy}
                          leftIcon={<Check className="h-4 w-4" />}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => mutateApproval("clubs", club.id, false)}
                          loading={busy}
                          leftIcon={<X className="h-4 w-4" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Events</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : pendingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events waiting for review.</p>
            ) : (
              <div className="space-y-3">
                {pendingEvents.map((event) => {
                  const key = `events:${event.id}`;
                  const busy = Boolean(updatingKeys[key]);

                  return (
                    <article key={event.id} className="rounded-xl border p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-semibold leading-tight">{event.name}</p>
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
                      </div>

                      <p className="mb-2 text-sm text-muted-foreground">{event.description ?? "No description."}</p>
                      <p className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateLabel(event.date, event.time)}
                        {event.location ? ` • ${event.location}` : ""}
                      </p>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => mutateApproval("events", event.id, true)}
                          loading={busy}
                          leftIcon={<Check className="h-4 w-4" />}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => mutateApproval("events", event.id, false)}
                          loading={busy}
                          leftIcon={<X className="h-4 w-4" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rejected Clubs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : rejectedClubs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rejected clubs.</p>
            ) : (
              <div className="space-y-3">
                {rejectedClubs.map((club) => {
                  const key = `clubs:${club.id}`;
                  const busy = Boolean(updatingKeys[key]);

                  return (
                    <article key={club.id} className="rounded-xl border p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-semibold leading-tight">{club.name}</p>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground">{club.description ?? "No description."}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mutateApproval("clubs", club.id, null)}
                        loading={busy}
                        leftIcon={<RotateCcw className="h-4 w-4" />}
                      >
                        Move to Pending
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rejected Events</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : rejectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rejected events.</p>
            ) : (
              <div className="space-y-3">
                {rejectedEvents.map((event) => {
                  const key = `events:${event.id}`;
                  const busy = Boolean(updatingKeys[key]);

                  return (
                    <article key={event.id} className="rounded-xl border p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-semibold leading-tight">{event.name}</p>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground">{event.description ?? "No description."}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mutateApproval("events", event.id, null)}
                        loading={busy}
                        leftIcon={<RotateCcw className="h-4 w-4" />}
                      >
                        Move to Pending
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PendingApprovals;
