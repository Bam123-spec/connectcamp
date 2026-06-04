import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { TimePicker } from "@/components/ui/time-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { logAuditEventSafe } from "@/lib/auditApi";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

type ClubOption = {
  id: string;
  name: string;
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  approved: boolean | null;
  created_at: string | null;
  club_id: string | null;
  cover_image_url: string | null;
};

type EventRegistrationRow = {
  id: string;
  event_id: string | null;
};

type EventInsight = EventRow & {
  clubName: string | null;
  registrationCount: number;
  needsScheduling: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  attentionReasons: string[];
  health: "strong" | "watch" | "urgent";
};

type EventFormState = {
  name: string;
  description: string;
  time: string;
  location: string;
  coverImage: string;
  clubId: string;
  status: "approved" | "pending";
};

type FilterKey = "all" | "upcoming" | "pending" | "unassigned" | "unscheduled" | "registered";
type EventsInspectorTab = "selected" | "ownership" | "schedule" | "interest";

const initialFormState: EventFormState = {
  name: "",
  description: "",
  time: "",
  location: "",
  coverImage: "",
  clubId: "workspace",
  status: "pending",
};

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All events" },
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Pending review" },
  { key: "unassigned", label: "No owning club" },
  { key: "unscheduled", label: "Schedule incomplete" },
  { key: "registered", label: "Has registrations" },
];

function parseStoredDate(dateValue: string | null) {
  if (!dateValue) return undefined;
  const parsed = parse(dateValue, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function safeDate(dateValue: string | null) {
  if (!dateValue) return null;
  const next = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(next.getTime()) ? null : next;
}

function formatDateLabel(dateValue: string | null) {
  const parsed = safeDate(dateValue);
  if (!parsed) return "Date not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatLastUpdated(value: string | null) {
  if (!value) return "No update timestamp";
  return new Date(value).toLocaleString();
}

function getAttentionReasons(event: {
  approved: boolean | null;
  clubId: string | null;
  needsScheduling: boolean;
  registrationCount: number;
  isUpcoming: boolean;
}) {
  const reasons: string[] = [];
  if (event.approved !== true) reasons.push("Pending approval");
  if (!event.clubId) reasons.push("No owning club linked");
  if (event.needsScheduling) reasons.push("Schedule incomplete");
  if (event.isUpcoming && event.registrationCount === 0) reasons.push("No registrations yet");
  return reasons;
}

function getHealth(reasons: string[]) {
  if (reasons.some((reason) => reason.includes("Pending approval") || reason.includes("No owning club"))) {
    return "urgent" as const;
  }
  if (reasons.length > 0) return "watch" as const;
  return "strong" as const;
}

function buildEventInsights(events: EventRow[], clubs: ClubOption[], registrations: EventRegistrationRow[]) {
  const clubMap = new Map(clubs.map((club) => [club.id, club.name]));
  const registrationMap = new Map<string, number>();

  registrations.forEach((registration) => {
    if (!registration.event_id) return;
    registrationMap.set(registration.event_id, (registrationMap.get(registration.event_id) ?? 0) + 1);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return events
    .map((event) => {
      const parsedDate = safeDate(event.date);
      const isUpcoming = !!parsedDate && parsedDate.getTime() >= today.getTime();
      const isPast = !!parsedDate && parsedDate.getTime() < today.getTime();
      const registrationCount = registrationMap.get(event.id) ?? 0;
      const needsScheduling = !event.date || !event.time || !event.location;
      const attentionReasons = getAttentionReasons({
        approved: event.approved,
        clubId: event.club_id,
        needsScheduling,
        registrationCount,
        isUpcoming,
      });

      return {
        ...event,
        clubName: event.club_id ? clubMap.get(event.club_id) ?? null : null,
        registrationCount,
        needsScheduling,
        isUpcoming,
        isPast,
        attentionReasons,
        health: getHealth(attentionReasons),
      } satisfies EventInsight;
    })
    .sort((a, b) => {
      const healthRank = { urgent: 0, watch: 1, strong: 2 };
      const healthDiff = healthRank[a.health] - healthRank[b.health];
      if (healthDiff !== 0) return healthDiff;
      if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;
      const aDate = safeDate(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = safeDate(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
}

function Events() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;

  const [events, setEvents] = useState<EventInsight[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<EventsInspectorTab>("selected");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [formState, setFormState] = useState<EventFormState>(initialFormState);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [editingEvent, setEditingEvent] = useState<EventInsight | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!orgId) {
      setError("This admin account is missing an organization context.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const clubsResult = await supabase
      .from("clubs")
      .select("id, name")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (clubsResult.error) {
      setError(clubsResult.error.message);
      setLoading(false);
      return;
    }

    const clubOptions = (clubsResult.data ?? []) as ClubOption[];
    const clubIds = new Set(clubOptions.map((club) => club.id));

    const [eventsResult, registrationsResult] = await Promise.all([
      supabase
        .from("events")
        .select("id, name, description, date, time, location, approved, created_at, club_id, cover_image_url")
        .order("created_at", { ascending: false }),
      supabase.from("event_registrations").select("id, event_id"),
    ]);

    if (eventsResult.error || registrationsResult.error) {
      const firstError = eventsResult.error ?? registrationsResult.error;
      setError(firstError?.message ?? "Could not load events.");
      setLoading(false);
      return;
    }

    const scopedEvents = ((eventsResult.data ?? []) as EventRow[]).filter((event) => !event.club_id || clubIds.has(event.club_id));
    const registrationRows = (registrationsResult.data ?? []) as EventRegistrationRow[];

    setClubs(clubOptions);
    setEvents(buildEventInsights(scopedEvents, clubOptions, registrationRows));
    setError(null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const resetForm = () => {
    setFormState(initialFormState);
    setDate(undefined);
    setEditingEvent(null);
    setFormError(null);
  };

  const openEdit = (event: EventInsight) => {
    setSelectedEventId(event.id);
    setInspectorTab("selected");
    setEditingEvent(event);
    setFormState({
      name: event.name,
      description: event.description || "",
      time: event.time || "",
      location: event.location || "",
      coverImage: event.cover_image_url || "",
      clubId: event.club_id || "workspace",
      status: event.approved === true ? "approved" : "pending",
    });
    setDate(parseStoredDate(event.date));
    setFormError(null);
    setSheetOpen(true);
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setFormError(null);

    if (!profile?.org_id) {
      setFormError("This admin account is missing an organization context.");
      return;
    }

    if (!formState.name.trim()) {
      setFormError("Event name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        date: date ? format(date, "yyyy-MM-dd") : null,
        time: formState.time.trim() || null,
        location: formState.location.trim() || null,
        cover_image_url: formState.coverImage || null,
        approved: formState.status === "approved" ? true : null,
        club_id: formState.clubId === "workspace" ? null : formState.clubId,
      };

      let saveError: { message?: string } | null = null;
      let savedEventId: string | null = editingEvent?.id ?? null;
      if (editingEvent) {
        const { data, error: updateError } = await supabase.from("events").update(payload).eq("id", editingEvent.id).select("id").single();
        saveError = updateError;
        savedEventId = (data as { id: string } | null)?.id ?? editingEvent.id;
      } else {
        const { data, error: insertError } = await supabase.from("events").insert({ ...payload, created_at: new Date().toISOString() }).select("id").single();
        saveError = insertError;
        savedEventId = (data as { id: string } | null)?.id ?? null;
      }

      if (saveError) {
        throw new Error(saveError.message ?? `Unable to ${editingEvent ? "update" : "create"} event.`);
      }

      void logAuditEventSafe({
        orgId: profile?.org_id,
        category: "events",
        action: editingEvent ? "event_updated" : "event_created",
        entityType: "event",
        entityId: savedEventId,
        title: editingEvent ? "Event updated" : "Event created",
        summary: `${payload.name} ${editingEvent ? "was updated in" : "was added to"} the events workspace.`,
        metadata: {
          status: formState.status,
          location: payload.location,
          date: payload.date,
          time: payload.time,
          club_id: payload.club_id,
        },
      });

      toast({
        title: `Event ${editingEvent ? "updated" : "created"}`,
        description: `${payload.name} is now part of the event workspace.`,
      });

      setSheetOpen(false);
      resetForm();
      await fetchEvents();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Unable to ${editingEvent ? "update" : "create"} event.`;
      setFormError(message);
      toast({
        variant: "destructive",
        title: `Unable to ${editingEvent ? "update" : "create"} event`,
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalUpdate = async (eventId: string, approved: boolean | null) => {
    if (!profile?.org_id) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: "This admin account is missing an organization context.",
      });
      return;
    }

    setUpdatingStatusId(eventId);
    const { error: updateError } = await supabase.from("events").update({ approved }).eq("id", eventId);
    setUpdatingStatusId(null);

    if (updateError) {
      toast({ variant: "destructive", title: "Status update failed", description: updateError.message });
      return;
    }

    const currentEvent = events.find((event) => event.id === eventId);
    void logAuditEventSafe({
      orgId: profile?.org_id,
      category: "events",
      action: "event_approval_state_updated",
      entityType: "event",
      entityId: eventId,
      title: approved ? "Event approved" : "Event moved to pending",
      summary: `${currentEvent?.name ?? "Event"} is now ${approved ? "approved" : "back in pending review"}.`,
      metadata: {
        approved,
        previous_approved: currentEvent?.approved ?? null,
      },
    });

    toast({
      title: approved ? "Event approved" : "Moved to pending",
      description: approved ? "The event is now marked approved." : "The event has been moved back to pending review.",
    });
    await fetchEvents();
  };

  const summary = useMemo(() => {
    const total = events.length;
    const upcoming = events.filter((event) => event.isUpcoming).length;
    const pending = events.filter((event) => event.approved !== true).length;
    const totalRegistrations = events.reduce((sum, event) => sum + event.registrationCount, 0);
    return { total, upcoming, pending, totalRegistrations };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch =
        !query ||
        [event.name, event.description ?? "", event.location ?? "", event.clubName ?? "Student Life"]
          .join(" ")
          .toLowerCase()
          .includes(query);
      if (!matchesSearch) return false;

      switch (activeFilter) {
        case "upcoming":
          return event.isUpcoming;
        case "pending":
          return event.approved !== true;
        case "unassigned":
          return !event.club_id;
        case "unscheduled":
          return event.needsScheduling;
        case "registered":
          return event.registrationCount > 0;
        default:
          return true;
      }
    });
  }, [activeFilter, events, searchQuery]);

  const ownershipGaps = useMemo(() => events.filter((event) => !event.club_id).slice(0, 8), [events]);
  const scheduleGaps = useMemo(() => events.filter((event) => event.needsScheduling).slice(0, 8), [events]);
  const topInterest = useMemo(
    () => [...events].sort((a, b) => b.registrationCount - a.registrationCount).filter((event) => event.registrationCount > 0).slice(0, 8),
    [events],
  );

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedEventId(null);
      return;
    }

    setSelectedEventId((current) => {
      if (current && filteredEvents.some((event) => event.id === current)) {
        return current;
      }
      return filteredEvents[0].id;
    });
  }, [filteredEvents]);

  const selectedEvent = useMemo(
    () => (selectedEventId ? filteredEvents.find((event) => event.id === selectedEventId) ?? null : null),
    [filteredEvents, selectedEventId],
  );

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Event operations</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Run events from one queue.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review ownership, scheduling, approvals, and registrations in a list-first workspace that keeps the event queue readable.
            </p>
          </div>

          <Sheet
            open={sheetOpen}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) resetForm();
            }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                <Link to="/calendar">Open calendar</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                <Link to="/approvals">Pending approvals</Link>
              </Button>
              <SheetTrigger asChild>
                <Button className="rounded-full px-5">
                  <Plus className="h-4 w-4" />
                  Create event
                </Button>
              </SheetTrigger>
            </div>

            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>{editingEvent ? "Edit event" : "Create event"}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {editingEvent
                    ? "Adjust scheduling, ownership, and approval state without leaving the events workspace."
                    : "Create a new event with club ownership, scheduling, and approval status in one place."}
                </p>
              </SheetHeader>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Event name *</label>
                  <Input
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Glow & Grow Workshop"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Textarea
                    value={formState.description}
                    onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Describe the purpose, key activities, and intended audience."
                    rows={4}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Owning club</label>
                    <Select value={formState.clubId} onValueChange={(value) => setFormState((prev) => ({ ...prev, clubId: value }))}>
                      <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                        <SelectValue placeholder="Choose a club owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="workspace">Student Life / unassigned</SelectItem>
                        {clubs.map((club) => (
                          <SelectItem key={club.id} value={club.id}>
                            {club.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Approval state</label>
                    <Select value={formState.status} onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value as "approved" | "pending" }))}>
                      <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                        <SelectValue placeholder="Choose status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col space-y-2">
                    <label className="text-sm font-medium text-foreground">Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                          <CalendarClock className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Time</label>
                    <TimePicker value={formState.time} onChange={(value) => setFormState((prev) => ({ ...prev, time: value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Location</label>
                  <Input
                    value={formState.location}
                    onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder="Community Commons, Room 204"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Cover image</label>
                  <ImageUpload value={formState.coverImage} onChange={(value) => setFormState((prev) => ({ ...prev, coverImage: value }))} bucket="events" />
                </div>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

                <SheetFooter className="gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSheetOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : editingEvent ? "Save changes" : "Create event"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total events" value={summary.total} helper="Programs visible in this workspace" icon={CalendarClock} loading={loading} />
          <KpiCard label="Upcoming" value={summary.upcoming} helper="Scheduled for today or later" icon={CheckCircle2} loading={loading} />
          <KpiCard label="Pending" value={summary.pending} helper="Need approval before publishing" icon={AlertTriangle} loading={loading} />
          <KpiCard label="Registrations" value={summary.totalRegistrations} helper="Known attendee signups" icon={Ticket} loading={loading} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,360px)]">
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="gap-4 border-b border-slate-200 pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-2xl tracking-tight">Event queue</CardTitle>
                <CardDescription className="mt-1">Select an event to inspect details, approvals, and any follow-up work.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                  <Link to="/calendar">Calendar view</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                  <Link to="/approvals">Pending approvals</Link>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search events, locations, descriptions, or club names"
                  className="h-11 rounded-2xl border-slate-200 pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((option) => (
                  <Button
                    key={option.key}
                    type="button"
                    variant={activeFilter === option.key ? "default" : "outline"}
                    className={cn("rounded-full", activeFilter !== option.key && "border-slate-200 bg-white text-slate-700")}
                    onClick={() => setActiveFilter(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 rounded-[22px]" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
                Unable to load events: {error}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
                <CalendarClock className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-4 text-lg font-semibold text-slate-900">No events match this view.</p>
                <p className="mt-2 text-sm text-slate-500">Try a different filter, or create a new event from this workspace.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((event) => (
                  <EventQueueRow
                    key={event.id}
                    event={event}
                    selected={selectedEventId === event.id}
                    onSelect={() => {
                      setSelectedEventId(event.id);
                      setInspectorTab("selected");
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="xl:sticky xl:top-6">
          <EventsInspector
            selectedEvent={selectedEvent}
            loading={loading}
            inspectorTab={inspectorTab}
            setInspectorTab={setInspectorTab}
            ownershipGaps={ownershipGaps}
            scheduleGaps={scheduleGaps}
            topInterest={topInterest}
            onEdit={openEdit}
            onStatusChange={handleApprovalUpdate}
            updatingStatusId={updatingStatusId}
          />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof CalendarClock;
  loading: boolean;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-3 text-slate-500">
        <p className="pr-2 text-[11px] font-semibold uppercase tracking-[0.16em] sm:tracking-[0.2em]">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      {loading ? <Skeleton className="mt-3 h-7 w-16" /> : <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>}
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2 text-slate-500">
        <p className="pr-2 text-xs font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em]">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-1.5 break-words text-sm font-semibold text-slate-950 sm:text-base">{value}</p>
    </div>
  );
}

function EventQueueRow({
  event,
  selected,
  onSelect,
}: {
  event: EventInsight;
  selected: boolean;
  onSelect: () => void;
}) {
  const compactDescription = truncateWords(event.description || "No event description has been added yet.", 18);
  const approvalLabel = event.approved === true ? "Approved" : "Pending review";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-[22px] border p-3 text-left transition-all sm:p-4",
        selected ? "border-slate-900 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border sm:h-11 sm:w-11",
              selected ? "border-white/15 bg-white/10 text-white" : "border-slate-200 bg-slate-50 text-slate-500",
            )}
          >
            {event.cover_image_url ? (
              <img src={event.cover_image_url} alt={event.name} className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-tight sm:text-base">{event.name}</h3>
              <Badge
                className={cn(
                  "rounded-full border-0",
                  selected
                    ? "bg-white/15 text-white"
                    : event.approved === true
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800",
                )}
              >
                {approvalLabel}
              </Badge>
              <StatusBadge tone={event.health} approved={event.approved === true} selected={selected} />
            </div>

            <p className={cn("mt-1 text-xs leading-5 sm:text-sm sm:leading-6", selected ? "text-white/72" : "text-slate-600")}>{compactDescription}</p>

            <div className={cn("mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:mt-3 sm:text-xs", selected ? "text-white/70" : "text-slate-500")}>
              <span className="rounded-full border border-transparent bg-transparent font-medium">{event.clubName || "Student Life"}</span>
              <span className="rounded-full border border-transparent bg-transparent">{formatDateLabel(event.date)}</span>
              <span className="rounded-full border border-transparent bg-transparent">{event.time || "Time not set"}</span>
              <span className="rounded-full border border-transparent bg-transparent">
                {event.registrationCount} registration{event.registrationCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {event.needsScheduling && (
            <Badge className={cn("hidden rounded-full border-0 sm:inline-flex", selected ? "bg-white/15 text-white" : "bg-amber-100 text-amber-800")}>Schedule incomplete</Badge>
          )}
          {!event.club_id && (
            <Badge className={cn("hidden rounded-full border-0 sm:inline-flex", selected ? "bg-white/15 text-white" : "bg-red-100 text-red-700")}>No owner</Badge>
          )}
          <Badge className={cn("rounded-full border-0", selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700")}>
            {event.isPast ? "Past" : event.isUpcoming ? "Upcoming" : "Unscheduled"}
          </Badge>
        </div>
      </div>
    </button>
  );
}

function EventsInspector({
  selectedEvent,
  loading,
  inspectorTab,
  setInspectorTab,
  ownershipGaps,
  scheduleGaps,
  topInterest,
  onEdit,
  onStatusChange,
  updatingStatusId,
}: {
  selectedEvent: EventInsight | null;
  loading: boolean;
  inspectorTab: EventsInspectorTab;
  setInspectorTab: (value: EventsInspectorTab) => void;
  ownershipGaps: EventInsight[];
  scheduleGaps: EventInsight[];
  topInterest: EventInsight[];
  onEdit: (event: EventInsight) => void;
  onStatusChange: (eventId: string, approved: boolean | null) => Promise<void>;
  updatingStatusId: string | null;
}) {
  return (
    <Tabs value={inspectorTab} onValueChange={(value) => setInspectorTab(value as EventsInspectorTab)}>
      <Card className="rounded-[28px] border-slate-200 shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl tracking-tight">Inspector</CardTitle>
            <CardDescription>Selected event details and secondary queue signals in one place.</CardDescription>
          </div>
          <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-[18px] bg-slate-100 p-1">
            <TabsTrigger value="selected" className="rounded-full px-3 py-1.5 text-xs">
              Selected
            </TabsTrigger>
            <TabsTrigger value="ownership" className="rounded-full px-3 py-1.5 text-xs">
              Ownership {ownershipGaps.length ? `(${ownershipGaps.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-full px-3 py-1.5 text-xs">
              Schedule {scheduleGaps.length ? `(${scheduleGaps.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="interest" className="rounded-full px-3 py-1.5 text-xs">
              Interest {topInterest.length ? `(${topInterest.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1 xl:pr-2">
            <TabsContent value="selected" className="mt-0 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-36 rounded-[24px]" />
                  <Skeleton className="h-24 rounded-[24px]" />
                  <Skeleton className="h-24 rounded-[24px]" />
                </div>
              ) : !selectedEvent ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  Select an event to inspect its details.
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                    {selectedEvent.cover_image_url ? (
                      <img src={selectedEvent.cover_image_url} alt={selectedEvent.name} className="h-28 w-full object-cover sm:h-36" />
                    ) : (
                      <div className="flex h-28 items-center justify-center bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_50%,#eef2ff_100%)] text-slate-500 sm:h-36">
                        <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" />
                      </div>
                    )}
                    <div className="space-y-3 p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected event</p>
                          <h3 className="mt-1 break-words text-base font-semibold tracking-tight text-slate-950 sm:text-lg">{selectedEvent.name}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {selectedEvent.description || "No event description has been added yet."}
                          </p>
                        </div>
                        <Badge className={cn("rounded-full border-0", selectedEvent.approved === true ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
                          {selectedEvent.approved === true ? "Approved" : "Pending review"}
                        </Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricPill icon={Ticket} label="Registrations" value={String(selectedEvent.registrationCount)} />
                        <MetricPill icon={Building2} label="Owner" value={selectedEvent.clubName || "Student Life"} />
                        <MetricPill icon={CalendarClock} label="Date" value={formatDateLabel(selectedEvent.date)} />
                        <MetricPill
                          icon={Users}
                          label="Status"
                          value={selectedEvent.isPast ? "Past" : selectedEvent.isUpcoming ? "Upcoming" : "Unscheduled"}
                        />
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="break-words">{selectedEvent.time || "Time not set"}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="break-words">{selectedEvent.location || "Location not set"}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.attentionReasons.length > 0 ? (
                          selectedEvent.attentionReasons.map((reason) => (
                            <Badge key={reason} variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 whitespace-normal text-left">
                              {reason}
                            </Badge>
                          ))
                        ) : (
                          <Badge className="rounded-full border-0 bg-emerald-50 text-emerald-700">Operationally healthy</Badge>
                        )}
                        <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 whitespace-normal text-left">
                          Last updated {formatLastUpdated(selectedEvent.created_at)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={() => onEdit(selectedEvent)}>
                          Edit event
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full border-slate-200 bg-white"
                          onClick={() => onStatusChange(selectedEvent.id, selectedEvent.approved === true ? null : true)}
                          disabled={updatingStatusId === selectedEvent.id}
                        >
                          {updatingStatusId === selectedEvent.id && <Loader2 className="h-4 w-4 animate-spin" />}
                          {selectedEvent.approved === true ? "Move to pending" : "Approve"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Operational notes</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedEvent.approved === true ? (
                        <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">Ready to publish</Badge>
                      ) : (
                        <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Needs approval</Badge>
                      )}
                      {selectedEvent.club_id ? (
                        <Badge className="rounded-full border-0 bg-slate-100 text-slate-700">{selectedEvent.clubName || "Club linked"}</Badge>
                      ) : (
                        <Badge className="rounded-full border-0 bg-red-100 text-red-700">No owner linked</Badge>
                      )}
                      {selectedEvent.needsScheduling ? (
                        <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Schedule incomplete</Badge>
                      ) : (
                        <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">Schedule complete</Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="ownership" className="mt-0 space-y-3">
              <InspectorListHeader
                eyebrow="Ownership"
                title="Events without a club owner"
                meta={`${ownershipGaps.length} event${ownershipGaps.length === 1 ? "" : "s"}`}
              />
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-[22px]" />
                  ))}
                </div>
              ) : ownershipGaps.length === 0 ? (
                <InspectorEmptyState message="Every visible event has a club owner." />
              ) : (
                ownershipGaps.map((event) => (
                  <InspectorListRow key={event.id} title={event.name} helper={event.location || "No location set"} badgeLabel="No owner" tone="urgent" />
                ))
              )}
            </TabsContent>

            <TabsContent value="schedule" className="mt-0 space-y-3">
              <InspectorListHeader
                eyebrow="Scheduling"
                title="Events missing details"
                meta={`${scheduleGaps.length} event${scheduleGaps.length === 1 ? "" : "s"}`}
              />
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-[22px]" />
                  ))}
                </div>
              ) : scheduleGaps.length === 0 ? (
                <InspectorEmptyState message="All visible events have date, time, and location details." />
              ) : (
                scheduleGaps.map((event) => (
                  <InspectorListRow
                    key={event.id}
                    title={event.name}
                    helper={event.attentionReasons.find((reason) => reason.includes("Schedule")) || "Missing schedule data"}
                    badgeLabel="Needs schedule"
                    tone="watch"
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="interest" className="mt-0 space-y-3">
              <InspectorListHeader
                eyebrow="Interest"
                title="Highest registration pull"
                meta={`${topInterest.length} event${topInterest.length === 1 ? "" : "s"}`}
              />
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-[22px]" />
                  ))}
                </div>
              ) : topInterest.length === 0 ? (
                <InspectorEmptyState message="No registrations have been recorded yet." />
              ) : (
                topInterest.map((event) => (
                  <InspectorListRow
                    key={event.id}
                    title={event.name}
                    helper={`${event.registrationCount} registration${event.registrationCount === 1 ? "" : "s"}`}
                    badgeLabel="High interest"
                    tone="strong"
                  />
                ))
              )}
            </TabsContent>
          </div>
        </CardContent>
      </Card>
    </Tabs>
  );
}

function InspectorListHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-950">{title}</h3>
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{meta}</span>
    </div>
  );
}

function InspectorListRow({
  title,
  helper,
  badgeLabel,
  tone,
}: {
  title: string;
  helper: string;
  badgeLabel: string;
  tone: EventInsight["health"];
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{helper}</p>
        </div>
        <StatusBadge tone={tone} approved />
      </div>
      <Badge
        className={cn(
          "mt-2 rounded-full border-0 text-[11px] sm:mt-3 sm:text-xs",
          badgeLabel === "No owner"
            ? "bg-red-100 text-red-700"
            : badgeLabel === "Needs schedule"
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-700",
        )}
      >
        {badgeLabel}
      </Badge>
    </div>
  );
}

function InspectorEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

function truncateWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return value;
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function StatusBadge({
  tone,
  approved,
  selected = false,
}: {
  tone: EventInsight["health"] | "strong";
  approved: boolean;
  selected?: boolean;
}) {
  if (tone === "strong") {
    return (
      <Badge className={cn("rounded-full border-0", selected ? "bg-white/15 text-white" : "bg-emerald-100 text-emerald-700")}>
        {approved ? "Ready" : "Watch"}
      </Badge>
    );
  }

  if (tone === "urgent") {
    return <Badge className={cn("rounded-full border-0", selected ? "bg-white/15 text-white" : "bg-red-100 text-red-700")}>Action needed</Badge>;
  }

  return <Badge className={cn("rounded-full border-0", selected ? "bg-white/15 text-white" : "bg-amber-100 text-amber-800")}>Watch</Badge>;
}

export default Events;
