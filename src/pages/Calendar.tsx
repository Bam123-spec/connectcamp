import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import {
  fetchCalendarWorkspace,
  type ApprovalBottleneck,
  type CalendarViewEvent,
  type CalendarWorkspaceSnapshot,
  type ProgrammingOverlap,
  type RoomConflict,
} from "@/lib/calendarWorkspaceApi";
import { cn } from "@/lib/utils";

type CalendarFilter = "all" | "needs_review" | "conflicts" | "overlap" | "scheduled" | "unscheduled";
type CalendarView = "month" | "week";

const FILTERS: Array<{ key: CalendarFilter; label: string }> = [
  { key: "all", label: "All events" },
  { key: "needs_review", label: "Needs review" },
  { key: "conflicts", label: "Room conflicts" },
  { key: "overlap", label: "Programming overlap" },
  { key: "scheduled", label: "Scheduled" },
  { key: "unscheduled", label: "Unscheduled" },
];

function formatDateLabel(dateValue: string) {
  return format(parseISO(`${dateValue}T00:00:00`), "EEE, MMM d");
}

function formatPeriodLabel(date: Date, view: CalendarView) {
  if (view === "week") {
    const start = startOfWeek(date, { weekStartsOn: 0 });
    const end = endOfWeek(date, { weekStartsOn: 0 });
    if (format(start, "MMM") === format(end, "MMM")) {
      return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
    }
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  }

  return format(date, "MMMM yyyy");
}

function matchesFilter(event: CalendarViewEvent, filter: CalendarFilter) {
  switch (filter) {
    case "needs_review":
      return event.isPending;
    case "conflicts":
      return event.roomConflictCount > 1;
    case "overlap":
      return event.overlapCount > 1;
    case "scheduled":
      return !event.needsScheduling;
    case "unscheduled":
      return event.needsScheduling;
    default:
      return true;
  }
}

function getSearchableText(event: CalendarViewEvent) {
  return [event.name, event.description ?? "", event.location ?? "", event.clubName ?? "Student Life", event.campusLabel ?? ""]
    .join(" ")
    .toLowerCase();
}

function eventTone(event: CalendarViewEvent) {
  if (event.roomConflictCount > 1) return "urgent" as const;
  if (event.isPending || event.needsScheduling) return "watch" as const;
  if (event.overlapCount > 1) return "busy" as const;
  return "healthy" as const;
}

function groupEventsByDate(events: CalendarViewEvent[]) {
  const map = new Map<string, CalendarViewEvent[]>();
  events.forEach((event) => {
    if (!event.date) return;
    map.set(event.date, [...(map.get(event.date) ?? []), event]);
  });
  return map;
}

function dateEventSort(left: CalendarViewEvent, right: CalendarViewEvent) {
  if (left.time && right.time) {
    return left.time.localeCompare(right.time);
  }
  if (left.time) return -1;
  if (right.time) return 1;
  return left.name.localeCompare(right.name);
}

function CalendarPage() {
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;

  const [snapshot, setSnapshot] = useState<CalendarWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<CalendarFilter>("all");

  const loadCalendar = useCallback(async () => {
    if (!orgId) {
      setError("This admin account is missing an organization context.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextSnapshot = await fetchCalendarWorkspace(orgId);
      setSnapshot(nextSnapshot);
      setError(null);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Could not load calendar workspace.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (snapshot?.events ?? []).filter((event) => {
      const matchesSearch = !query || getSearchableText(event).includes(query);
      return matchesSearch && matchesFilter(event, filter);
    });
  }, [filter, searchQuery, snapshot?.events]);

  const eventsByDate = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);

  const visibleDays = useMemo(() => {
    if (view === "week") {
      return eachDayOfInterval({
        start: startOfWeek(cursorDate, { weekStartsOn: 0 }),
        end: endOfWeek(cursorDate, { weekStartsOn: 0 }),
      });
    }

    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 0 }),
    });
  }, [cursorDate, view]);

  const visibleDateKeys = useMemo(() => new Set(visibleDays.map((day) => format(day, "yyyy-MM-dd"))), [visibleDays]);

  const periodEvents = useMemo(
    () => filteredEvents.filter((event) => event.date && visibleDateKeys.has(event.date)),
    [filteredEvents, visibleDateKeys],
  );

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedDayEvents = useMemo(
    () => (eventsByDate.get(selectedDateKey) ?? []).slice().sort(dateEventSort),
    [eventsByDate, selectedDateKey],
  );

  const periodSummary = useMemo(() => {
    const scheduled = periodEvents.filter((event) => !event.needsScheduling).length;
    const pending = periodEvents.filter((event) => event.isPending).length;
    const registrations = periodEvents.reduce((sum, event) => sum + event.registrationCount, 0);
    const conflicts = new Set(periodEvents.filter((event) => event.roomConflictKey).map((event) => event.roomConflictKey)).size;
    const overlaps = new Set(periodEvents.filter((event) => event.overlapCount > 1).map((event) => `${event.date}::${event.campusLabel ?? "general"}`)).size;
    return { scheduled, pending, registrations, conflicts, overlaps };
  }, [periodEvents]);

  const visibleRoomConflicts = useMemo(
    () => (snapshot?.roomConflicts ?? []).filter((item) => visibleDateKeys.has(item.date)).slice(0, 6),
    [snapshot?.roomConflicts, visibleDateKeys],
  );

  const visibleBottlenecks = useMemo(
    () => (snapshot?.approvalBottlenecks ?? []).filter((item) => visibleDateKeys.has(item.date)).slice(0, 6),
    [snapshot?.approvalBottlenecks, visibleDateKeys],
  );

  const visibleOverlaps = useMemo(
    () => (snapshot?.programmingOverlaps ?? []).filter((item) => visibleDateKeys.has(item.date)).slice(0, 6),
    [snapshot?.programmingOverlaps, visibleDateKeys],
  );

  const unscheduledEvents = useMemo(() => (snapshot?.unscheduledEvents ?? []).slice(0, 6), [snapshot?.unscheduledEvents]);

  const goToPrevious = () => {
    setCursorDate((current) => (view === "month" ? subMonths(current, 1) : subWeeks(current, 1)));
  };

  const goToNext = () => {
    setCursorDate((current) => (view === "month" ? addMonths(current, 1) : addWeeks(current, 1)));
  };

  const goToToday = () => {
    const today = new Date();
    setCursorDate(today);
    setSelectedDate(today);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_42%,#eff6ff_100%)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Calendar Workspace</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">See the schedule the way Student Life actually runs it.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use a true month or week calendar to spot room conflicts, stacked programming days, and approval bottlenecks before they become operational problems.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={view} onValueChange={(next) => setView(next as CalendarView)}>
              <TabsList className="rounded-full bg-slate-100 p-1">
                <TabsTrigger value="month" className="rounded-full px-4">Month</TabsTrigger>
                <TabsTrigger value="week" className="rounded-full px-4">Week</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" className="rounded-full border-slate-200 bg-white" onClick={goToToday}>
              Today
            </Button>
            <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
              <Link to="/events">Open events workspace</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link to="/events/create">
                <Plus className="h-4 w-4" />
                Create event
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Scheduled in view" value={periodSummary.scheduled} helper="Events with date, time, and location" icon={CheckCircle2} loading={loading} />
          <KpiCard label="Needs review" value={periodSummary.pending} helper="Approval queue pressure by date" icon={AlertTriangle} loading={loading} />
          <KpiCard label="Registrations" value={periodSummary.registrations} helper="Student interest in the visible period" icon={Ticket} loading={loading} />
          <KpiCard label="Room conflicts" value={periodSummary.conflicts} helper="Same room, same date, same time" icon={Building2} loading={loading} />
          <KpiCard label="Overlap days" value={periodSummary.overlaps} helper="Multiple events sharing the same day cluster" icon={Sparkles} loading={loading} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_380px]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader className="gap-4 border-b border-slate-200 pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Schedule calendar</CardTitle>
                  <CardDescription>
                    Calendar-first scheduling for non-technical staff. Click any day to inspect the agenda and the approvals pressure around it.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white p-1">
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={goToPrevious} aria-label="Previous period">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[180px] px-2 text-center text-sm font-semibold text-slate-900">
                    {formatPeriodLabel(cursorDate, view)}
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={goToNext} aria-label="Next period">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search events, locations, or club owners"
                    className="h-11 rounded-2xl border-slate-200 pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((option) => (
                    <Button
                      key={option.key}
                      type="button"
                      variant={filter === option.key ? "default" : "outline"}
                      className={cn("rounded-full", filter !== option.key && "border-slate-200 bg-white text-slate-700")}
                      onClick={() => setFilter(option.key)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-[720px] rounded-[24px]" />
              ) : error ? (
                <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
                  Unable to load calendar workspace: {error}
                </div>
              ) : view === "month" ? (
                <MonthGrid
                  days={visibleDays}
                  cursorDate={cursorDate}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  eventsByDate={eventsByDate}
                />
              ) : (
                <WeekGrid
                  days={visibleDays}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  eventsByDate={eventsByDate}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <SelectedDayCard selectedDate={selectedDate} events={selectedDayEvents} loading={loading} />
          <InsightListCard title="Room conflicts" description="Conflicts in the visible period that need a room or time adjustment." items={visibleRoomConflicts} loading={loading} emptyLabel="No room conflicts in this view." />
          <BottleneckCard items={visibleBottlenecks} loading={loading} />
          <OverlapCard items={visibleOverlaps} loading={loading} />
          <UnscheduledCard items={unscheduledEvents} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  days,
  cursorDate,
  selectedDate,
  onSelectDate,
  eventsByDate,
}: {
  days: Date[];
  cursorDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  eventsByDate: Map<string, CalendarViewEvent[]>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {Array.from({ length: 7 }).map((_, index) => {
          const day = days[index];
          return <div key={day.toISOString()}>{format(day, "EEE")}</div>;
        })}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = (eventsByDate.get(key) ?? []).slice().sort(dateEventSort);
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, cursorDate);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "min-h-[140px] rounded-[22px] border p-3 text-left transition-all",
                isSelected ? "border-slate-900 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
                !isCurrentMonth && !isSelected && "bg-slate-50 text-slate-400",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm font-semibold", !isSelected && isCurrentMonth && "text-slate-950")}>{format(day, "d")}</span>
                {dayEvents.length > 0 && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600")}>{dayEvents.length}</span>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {dayEvents.slice(0, 3).map((event) => (
                  <MiniEventChip key={event.id} event={event} selected={isSelected} />
                ))}
                {dayEvents.length > 3 && (
                  <div className={cn("text-xs font-medium", isSelected ? "text-white/70" : "text-slate-500")}>+{dayEvents.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  selectedDate,
  onSelectDate,
  eventsByDate,
}: {
  days: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  eventsByDate: Map<string, CalendarViewEvent[]>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayEvents = (eventsByDate.get(key) ?? []).slice().sort(dateEventSort);
        const isSelected = isSameDay(day, selectedDate);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDate(day)}
            className={cn(
              "flex min-h-[420px] flex-col rounded-[24px] border p-4 text-left transition-all",
              isSelected ? "border-slate-900 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
            )}
          >
            <div className="border-b border-slate-200/70 pb-3">
              <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", isSelected ? "text-white/70" : "text-slate-500")}>{format(day, "EEE")}</p>
              <p className={cn("mt-1 text-lg font-semibold", isSelected ? "text-white" : "text-slate-950")}>{format(day, "MMM d")}</p>
            </div>

            <div className="mt-4 flex-1 space-y-2">
              {dayEvents.length === 0 ? (
                <div className={cn("rounded-[18px] border border-dashed px-3 py-6 text-center text-sm", isSelected ? "border-white/20 text-white/70" : "border-slate-200 text-slate-500")}>No scheduled events.</div>
              ) : (
                dayEvents.map((event) => <MiniEventChip key={event.id} event={event} selected={isSelected} expanded />)
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MiniEventChip({ event, selected, expanded = false }: { event: CalendarViewEvent; selected: boolean; expanded?: boolean }) {
  const tone = eventTone(event);
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-left",
        selected
          ? "border-white/15 bg-white/10 text-white"
          : tone === "urgent"
            ? "border-red-200 bg-red-50 text-red-700"
            : tone === "watch"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : tone === "busy"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-semibold leading-5", selected && "text-white")}>{event.name}</p>
        {event.roomConflictCount > 1 && <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5", selected ? "text-white" : "text-red-500")} />}
      </div>
      <div className={cn("mt-1 text-xs", selected ? "text-white/75" : "text-slate-500")}>
        {event.time || "Time TBD"}
        {event.location ? ` • ${event.location}` : ""}
      </div>
      {expanded && (
        <div className={cn("mt-2 flex flex-wrap gap-1", selected ? "text-white/80" : "text-slate-500")}>
          {event.isPending && <Badge className={cn("rounded-full border-0", selected ? "bg-white/15 text-white" : "bg-amber-100 text-amber-800")}>Needs review</Badge>}
          {event.overlapCount > 1 && <Badge className={cn("rounded-full border-0", selected ? "bg-white/15 text-white" : "bg-sky-100 text-sky-700")}>Overlap</Badge>}
          {event.registrationCount > 0 && <Badge className={cn("rounded-full border-0", selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700")}>{event.registrationCount} registrations</Badge>}
        </div>
      )}
    </div>
  );
}

function SelectedDayCard({ selectedDate, events, loading }: { selectedDate: Date; events: CalendarViewEvent[]; loading: boolean }) {
  return (
    <Card className="rounded-[28px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">{format(selectedDate, "EEEE, MMMM d")}</CardTitle>
        <CardDescription>Agenda for the selected day, sorted for quick review.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-[20px]" />)
        ) : events.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No events are scheduled for this date.
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{event.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{event.clubName || "Student Life"}</p>
                </div>
                <EventStateBadge event={event} />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  <span>{event.time || "Time not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>{event.location || "Location not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-slate-400" />
                  <span>{event.registrationCount} registration{event.registrationCount === 1 ? "" : "s"}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {event.roomConflictCount > 1 && <Badge className="rounded-full border-0 bg-red-100 text-red-700">Room conflict</Badge>}
                {event.overlapCount > 1 && <Badge className="rounded-full border-0 bg-sky-100 text-sky-700">Programming overlap</Badge>}
                {event.needsScheduling && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Schedule incomplete</Badge>}
                {event.campusLabel && <Badge className="rounded-full border-0 bg-slate-100 text-slate-700">{event.campusLabel}</Badge>}
              </div>
            </div>
          ))
        )}
        <Button asChild variant="outline" className="w-full rounded-full border-slate-200 bg-white">
          <Link to="/events">Open full event operations</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function InsightListCard({
  title,
  description,
  items,
  loading,
  emptyLabel,
}: {
  title: string;
  description: string;
  items: RoomConflict[];
  loading: boolean;
  emptyLabel: string;
}) {
  return (
    <Card className="rounded-[28px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-[20px]" />)
        ) : items.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <div key={item.key} className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{item.location}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatDateLabel(item.date)} • {item.time}</p>
                </div>
                <Badge className="rounded-full border-0 bg-red-100 text-red-700">{item.events.length} events</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.events.map((event) => (
                  <Badge key={event.id} variant="outline" className="rounded-full border-red-200 bg-white text-red-700">{event.name}</Badge>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function BottleneckCard({ items, loading }: { items: ApprovalBottleneck[]; loading: boolean }) {
  return (
    <Card className="rounded-[28px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">Approval bottlenecks</CardTitle>
        <CardDescription>Dates carrying the most approval work in the current view.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-[20px]" />)
        ) : items.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No active approval bottlenecks in this period.</div>
        ) : (
          items.map((item) => (
            <div key={item.date} className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{formatDateLabel(item.date)}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.events[0]?.name}{item.events.length > 1 ? ` + ${item.events.length - 1} more` : ""}</p>
                </div>
                <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">{item.count} waiting</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function OverlapCard({ items, loading }: { items: ProgrammingOverlap[]; loading: boolean }) {
  return (
    <Card className="rounded-[28px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">Programming overlap</CardTitle>
        <CardDescription>Heavy program clustering by day. Campus is estimated from location until dedicated campus fields land.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-[20px]" />)
        ) : items.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No overlap pressure in this period.</div>
        ) : (
          items.map((item) => (
            <div key={item.key} className="rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{formatDateLabel(item.date)}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.campusLabel ? `${item.campusLabel} overlap` : "General same-day overlap"}</p>
                </div>
                <Badge className="rounded-full border-0 bg-sky-100 text-sky-700">{item.count} events</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function UnscheduledCard({ items, loading }: { items: CalendarViewEvent[]; loading: boolean }) {
  return (
    <Card className="rounded-[28px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">Scheduling queue</CardTitle>
        <CardDescription>Events still missing date, time, or location.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-[20px]" />)
        ) : items.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Everything in the workspace has core schedule data.</div>
        ) : (
          items.map((event) => (
            <div key={event.id} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-950">{event.name}</p>
              <p className="mt-1 text-sm text-slate-500">{event.clubName || "Student Life"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!event.date && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Date missing</Badge>}
                {!event.time && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Time missing</Badge>}
                {!event.location && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Location missing</Badge>}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
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
  icon: typeof CalendarDays;
  loading: boolean;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-3 text-slate-500">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>}
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function EventStateBadge({ event }: { event: CalendarViewEvent }) {
  if (event.roomConflictCount > 1) {
    return <Badge className="rounded-full border-0 bg-red-100 text-red-700">Conflict</Badge>;
  }
  if (event.isPending) {
    return <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Needs review</Badge>;
  }
  if (event.overlapCount > 1) {
    return <Badge className="rounded-full border-0 bg-sky-100 text-sky-700">Busy day</Badge>;
  }
  return <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">Ready</Badge>;
}

export default CalendarPage;
