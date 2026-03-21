import { supabase } from "@/lib/supabaseClient";

export type CalendarViewEvent = {
  id: string;
  name: string;
  description: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  approved: boolean | null;
  createdAt: string | null;
  clubId: string | null;
  clubName: string | null;
  coverImageUrl: string | null;
  registrationCount: number;
  approvalStatus: "pending_review" | "in_review" | "changes_requested" | "approved" | "rejected" | null;
  approvalPriority: "low" | "medium" | "high" | "urgent" | null;
  isApproved: boolean;
  isPending: boolean;
  needsScheduling: boolean;
  campusLabel: string | null;
  roomConflictKey: string | null;
  roomConflictCount: number;
  overlapCount: number;
};

export type RoomConflict = {
  key: string;
  date: string;
  time: string;
  location: string;
  events: CalendarViewEvent[];
};

export type ApprovalBottleneck = {
  date: string;
  count: number;
  events: CalendarViewEvent[];
};

export type ProgrammingOverlap = {
  key: string;
  date: string;
  count: number;
  campusLabel: string | null;
  events: CalendarViewEvent[];
};

export type CalendarWorkspaceSnapshot = {
  events: CalendarViewEvent[];
  roomConflicts: RoomConflict[];
  approvalBottlenecks: ApprovalBottleneck[];
  programmingOverlaps: ProgrammingOverlap[];
  unscheduledEvents: CalendarViewEvent[];
  summary: {
    total: number;
    scheduled: number;
    pending: number;
    conflicts: number;
    overlapDays: number;
    unscheduled: number;
  };
};

type ClubRow = {
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

type RegistrationRow = {
  id: string;
  event_id: string | null;
};

type ApprovalRow = {
  id: string;
  entity_id: string;
  status: "pending_review" | "in_review" | "changes_requested" | "approved" | "rejected";
  priority: "low" | "medium" | "high" | "urgent";
  last_action_at: string;
};

const ACTIVE_APPROVAL_STATUSES = new Set([
  "pending_review",
  "in_review",
  "changes_requested",
]);

const ROCKVILLE_PATTERNS = [/\brockville\b/i, /\bcomm\b/i, /\bst\b/i, /student life/i, /atrium/i, /\bp4\b/i, /\bcm\b/i];
const TPSS_PATTERNS = [/takoma/i, /silver spring/i, /\btpss\b/i];
const GERMANTOWN_PATTERNS = [/\bgermantown\b/i, /bioscience/i, /high tech/i, /\bgt\b/i];

function guessCampus(location: string | null) {
  if (!location) return null;
  const normalized = location.trim();
  if (!normalized) return null;
  if (ROCKVILLE_PATTERNS.some((pattern) => pattern.test(normalized))) return "Rockville";
  if (TPSS_PATTERNS.some((pattern) => pattern.test(normalized))) return "TPSS";
  if (GERMANTOWN_PATTERNS.some((pattern) => pattern.test(normalized))) return "Germantown";
  return null;
}

function normalizeLocation(location: string | null) {
  return location?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function sortTimeValue(date: string | null, time: string | null, createdAt: string | null) {
  if (date && time) {
    const [hourRaw, minuteRaw] = time.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
      return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`).getTime();
    }
  }

  if (date) {
    return new Date(`${date}T23:59:00`).getTime();
  }

  return createdAt ? new Date(createdAt).getTime() : Number.MAX_SAFE_INTEGER;
}

export async function fetchCalendarWorkspace(orgId: string): Promise<CalendarWorkspaceSnapshot> {
  const clubsResult = await supabase
    .from("clubs")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (clubsResult.error) throw clubsResult.error;

  const clubs = (clubsResult.data ?? []) as ClubRow[];
  const clubIds = new Set(clubs.map((club) => club.id));
  const clubMap = new Map(clubs.map((club) => [club.id, club.name]));

  const [eventsResult, registrationsResult, approvalsResult] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, description, date, time, location, approved, created_at, club_id, cover_image_url")
      .order("created_at", { ascending: false }),
    supabase.from("event_registrations").select("id, event_id"),
    supabase
      .from("approval_requests")
      .select("id, entity_id, status, priority, last_action_at")
      .eq("org_id", orgId)
      .eq("entity_type", "event")
      .order("last_action_at", { ascending: false }),
  ]);

  const firstError = eventsResult.error ?? registrationsResult.error ?? approvalsResult.error;
  if (firstError) throw firstError;

  const registrationMap = new Map<string, number>();
  ((registrationsResult.data ?? []) as RegistrationRow[]).forEach((registration) => {
    if (!registration.event_id) return;
    registrationMap.set(registration.event_id, (registrationMap.get(registration.event_id) ?? 0) + 1);
  });

  const latestApprovalByEvent = new Map<string, ApprovalRow>();
  ((approvalsResult.data ?? []) as ApprovalRow[]).forEach((approval) => {
    if (!latestApprovalByEvent.has(approval.entity_id)) {
      latestApprovalByEvent.set(approval.entity_id, approval);
    }
  });

  const scopedEvents = ((eventsResult.data ?? []) as EventRow[]).filter((event) => !event.club_id || clubIds.has(event.club_id));

  const provisionalEvents = scopedEvents.map((event) => {
    const approval = latestApprovalByEvent.get(event.id) ?? null;
    const approvalStatus = approval?.status ?? null;
    const isApproved = approvalStatus ? approvalStatus === "approved" : event.approved === true;
    const isPending = approvalStatus ? ACTIVE_APPROVAL_STATUSES.has(approvalStatus) : event.approved !== true;
    const campusLabel = guessCampus(event.location);

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      approved: event.approved,
      createdAt: event.created_at,
      clubId: event.club_id,
      clubName: event.club_id ? clubMap.get(event.club_id) ?? null : null,
      coverImageUrl: event.cover_image_url,
      registrationCount: registrationMap.get(event.id) ?? 0,
      approvalStatus,
      approvalPriority: approval?.priority ?? null,
      isApproved,
      isPending,
      needsScheduling: !event.date || !event.time || !event.location,
      campusLabel,
      roomConflictKey: null,
      roomConflictCount: 0,
      overlapCount: 0,
    } satisfies CalendarViewEvent;
  });

  const roomGroups = new Map<string, CalendarViewEvent[]>();
  const overlapGroups = new Map<string, CalendarViewEvent[]>();
  const bottleneckGroups = new Map<string, CalendarViewEvent[]>();

  provisionalEvents.forEach((event) => {
    if (event.date && event.time && event.location) {
      const roomKey = `${event.date}::${normalizeLocation(event.location)}::${event.time.trim().toLowerCase()}`;
      roomGroups.set(roomKey, [...(roomGroups.get(roomKey) ?? []), event]);
    }

    if (event.date) {
      const overlapKey = event.campusLabel ? `${event.date}::${event.campusLabel}` : `${event.date}::general`;
      overlapGroups.set(overlapKey, [...(overlapGroups.get(overlapKey) ?? []), event]);
    }

    if (event.date && event.isPending) {
      bottleneckGroups.set(event.date, [...(bottleneckGroups.get(event.date) ?? []), event]);
    }
  });

  const roomConflictMap = new Map<string, { key: string; count: number }>();
  const overlapCountMap = new Map<string, number>();

  roomGroups.forEach((group, key) => {
    if (group.length < 2) return;
    group.forEach((event) => {
      roomConflictMap.set(event.id, { key, count: group.length });
    });
  });

  overlapGroups.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((event) => {
      overlapCountMap.set(event.id, group.length);
    });
  });

  const events = provisionalEvents
    .map((event) => {
      const conflict = roomConflictMap.get(event.id);
      return {
        ...event,
        roomConflictKey: conflict?.key ?? null,
        roomConflictCount: conflict?.count ?? 0,
        overlapCount: overlapCountMap.get(event.id) ?? 0,
      } satisfies CalendarViewEvent;
    })
    .sort((left, right) => sortTimeValue(left.date, left.time, left.createdAt) - sortTimeValue(right.date, right.time, right.createdAt));

  const eventById = new Map(events.map((event) => [event.id, event]));

  const roomConflicts = Array.from(roomGroups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      date: group[0].date ?? "",
      time: group[0].time ?? "",
      location: group[0].location ?? "Unknown room",
      events: group.map((event) => eventById.get(event.id) ?? event),
    }))
    .sort((left, right) => sortTimeValue(left.date, left.time, null) - sortTimeValue(right.date, right.time, null));

  const approvalBottlenecks = Array.from(bottleneckGroups.entries())
    .map(([date, group]) => ({
      date,
      count: group.length,
      events: group
        .map((event) => eventById.get(event.id) ?? event)
        .sort((left, right) => sortTimeValue(left.date, left.time, left.createdAt) - sortTimeValue(right.date, right.time, right.createdAt)),
    }))
    .sort((left, right) => sortTimeValue(left.date, null, null) - sortTimeValue(right.date, null, null));

  const programmingOverlaps = Array.from(overlapGroups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      date: group[0].date ?? "",
      count: group.length,
      campusLabel: group[0].campusLabel ?? null,
      events: group
        .map((event) => eventById.get(event.id) ?? event)
        .sort((left, right) => sortTimeValue(left.date, left.time, left.createdAt) - sortTimeValue(right.date, right.time, right.createdAt)),
    }))
    .sort((left, right) => right.count - left.count || sortTimeValue(left.date, null, null) - sortTimeValue(right.date, null, null));

  const unscheduledEvents = events.filter((event) => event.needsScheduling);

  return {
    events,
    roomConflicts,
    approvalBottlenecks,
    programmingOverlaps,
    unscheduledEvents,
    summary: {
      total: events.length,
      scheduled: events.filter((event) => !event.needsScheduling).length,
      pending: events.filter((event) => event.isPending).length,
      conflicts: roomConflicts.length,
      overlapDays: programmingOverlaps.length,
      unscheduled: unscheduledEvents.length,
    },
  };
}
