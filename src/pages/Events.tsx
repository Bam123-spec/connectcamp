import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
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
    const unassigned = events.filter((event) => !event.club_id).length;
    const unscheduled = events.filter((event) => event.needsScheduling).length;
    return { total, upcoming, pending, totalRegistrations, unassigned, unscheduled };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch = !query || [event.name, event.description ?? "", event.location ?? "", event.clubName ?? "Student Life"]
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

  const scheduleGaps = useMemo(() => events.filter((event) => event.needsScheduling).slice(0, 6), [events]);
  const ownershipGaps = useMemo(() => events.filter((event) => !event.club_id).slice(0, 6), [events]);
  const topInterest = useMemo(() => [...events].sort((a, b) => b.registrationCount - a.registrationCount).filter((event) => event.registrationCount > 0).slice(0, 5), [events]);

  const content = () => {
    if (loading) {
      return (
        <div className="grid gap-4 2xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-[24px]" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
          Unable to load events: {error}
        </div>
      );
    }

    if (filteredEvents.length === 0) {
      return (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-4 text-lg font-semibold text-slate-900">No events match this view.</p>
          <p className="mt-2 text-sm text-slate-500">Try a different filter, or create a new event from this workspace.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 2xl:grid-cols-2">
        {filteredEvents.map((event) => (
          <EventOperationalCard
            key={event.id}
            event={event}
            onEdit={() => openEdit(event)}
            onStatusChange={handleApprovalUpdate}
            updatingStatus={updatingStatusId === event.id}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_42%,#eff6ff_100%)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Event Operations</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Make events easy to run, not hard to interpret.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This workspace now highlights what is scheduled, what still needs approval, which events are missing ownership, and where student interest is already showing up.
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
                          <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
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
                  <div className="space-y-2 flex flex-col">
                    <label className="text-sm font-medium text-foreground">Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                        >
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
                  <Button type="button" variant="outline" onClick={() => { setSheetOpen(false); resetForm(); }}>
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

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard label="Total events" value={summary.total} helper="Programs visible in this workspace" icon={CalendarClock} loading={loading} />
          <KpiCard label="Upcoming" value={summary.upcoming} helper="Scheduled for today or later" icon={CheckCircle2} loading={loading} />
          <KpiCard label="Pending" value={summary.pending} helper="Need approval before publishing" icon={AlertTriangle} loading={loading} />
          <KpiCard label="Registrations" value={summary.totalRegistrations} helper="Known attendee signups" icon={Ticket} loading={loading} />
          <KpiCard label="No owning club" value={summary.unassigned} helper="Events missing a clear owner" icon={Building2} loading={loading} />
          <KpiCard label="Schedule gaps" value={summary.unscheduled} helper="Missing date, time, or location" icon={ClipboardList} loading={loading} />
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,360px)]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader className="gap-4 border-b border-slate-200 pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Event portfolio</CardTitle>
                  <CardDescription className="mt-1">Filter for the events that need attention, not just the ones that already look complete.</CardDescription>
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
                      className={cn(
                        "rounded-full",
                        activeFilter !== option.key && "border-slate-200 bg-white text-slate-700",
                      )}
                      onClick={() => setActiveFilter(option.key)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">{content()}</CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <SideListCard
            title="Ownership gaps"
            description="Events that still are not tied to a club owner."
            emptyLabel="Every event has a club owner right now."
            items={ownershipGaps.map((event) => ({
              id: event.id,
              label: event.name,
              helper: event.location || "No location set",
              tone: "urgent",
            }))}
          />

          <SideListCard
            title="Schedule gaps"
            description="Events missing date, time, or location details."
            emptyLabel="Every event has a complete schedule."
            items={scheduleGaps.map((event) => ({
              id: event.id,
              label: event.name,
              helper: event.attentionReasons.find((reason) => reason.includes("Schedule")) || "Missing schedule data",
              tone: "watch",
            }))}
          />

          <SideListCard
            title="Top interest"
            description="Events already showing the strongest registration pull."
            emptyLabel="No registrations have been recorded yet."
            items={topInterest.map((event) => ({
              id: event.id,
              label: event.name,
              helper: `${event.registrationCount} registration${event.registrationCount === 1 ? "" : "s"}`,
              tone: "strong",
            }))}
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
        <p className="pr-2 text-xs font-semibold uppercase tracking-[0.16em] sm:tracking-[0.2em]">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>}
      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function SideListCard({
  title,
  description,
  items,
  emptyLabel,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; label: string; helper: string; tone: EventInsight["health"] | "strong" }>;
  emptyLabel: string;
}) {
  return (
    <Card className="rounded-[28px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 break-words text-sm text-slate-500">{item.helper}</p>
                </div>
                <div className="shrink-0 self-start">
                  <StatusBadge tone={item.tone} approved />
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EventOperationalCard({
  event,
  onEdit,
  onStatusChange,
  updatingStatus,
}: {
  event: EventInsight;
  onEdit: () => void;
  onStatusChange: (eventId: string, approved: boolean | null) => Promise<void>;
  updatingStatus: boolean;
}) {
  const compactDescription = truncateWords(
    event.description || "No event description has been added yet.",
    28,
  );

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      {event.cover_image_url ? (
        <img src={event.cover_image_url} alt={event.name} className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-20 items-center justify-center bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_50%,#eef2ff_100%)] text-slate-500">
          <Sparkles className="h-6 w-6" />
        </div>
      )}

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-lg font-semibold tracking-tight text-slate-950">{event.name}</h3>
              <Badge className={cn("rounded-full border-0", event.approved === true ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
                {event.approved === true ? "Approved" : "Pending review"}
              </Badge>
              <StatusBadge tone={event.health} approved={event.approved === true} />
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{compactDescription}</p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" size="sm" className="rounded-full border-slate-200" onClick={onEdit}>Edit</Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-slate-200 bg-white"
              onClick={() => onStatusChange(event.id, event.approved === true ? null : true)}
              disabled={updatingStatus}
            >
              {updatingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
              {event.approved === true ? "Move to pending" : "Approve"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <MetricPill icon={Ticket} label="Registrations" value={String(event.registrationCount)} />
          <MetricPill icon={Building2} label="Owner" value={event.clubName || "Student Life"} />
          <MetricPill icon={CalendarClock} label="Date" value={formatDateLabel(event.date)} />
          <MetricPill icon={Users} label="Status" value={event.isPast ? "Past" : event.isUpcoming ? "Upcoming" : "Unscheduled"} />
        </div>

        <div className="grid gap-2.5 text-sm text-slate-600 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="break-words">{event.time || "Time not set"}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="break-words">{event.location || "Location not set"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {event.attentionReasons.length > 0 ? (
            event.attentionReasons.map((reason) => (
              <Badge key={reason} variant="outline" className="rounded-full border-slate-200 bg-slate-50 whitespace-normal text-left text-slate-700">
                {reason}
              </Badge>
            ))
          ) : (
            <Badge className="rounded-full border-0 bg-emerald-50 text-emerald-700">Operationally healthy</Badge>
          )}
          <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 whitespace-normal text-left text-slate-700">
            Last updated {formatLastUpdated(event.created_at)}
          </Badge>
        </div>
      </div>
    </article>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2 text-slate-500">
        <p className="pr-2 text-xs font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em]">{label}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-1.5 break-words text-base font-semibold text-slate-950">{value}</p>
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

function StatusBadge({ tone, approved }: { tone: EventInsight["health"] | "strong"; approved: boolean }) {
  if (tone === "strong") {
    return <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">{approved ? "Ready" : "Watch"}</Badge>;
  }
  if (tone === "urgent") {
    return <Badge className="rounded-full border-0 bg-red-100 text-red-700">Action needed</Badge>;
  }
  return <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Watch</Badge>;
}

export default Events;
