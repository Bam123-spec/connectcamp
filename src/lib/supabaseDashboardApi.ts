import { supabase } from "@/lib/supabaseClient";

export type DashboardStats = {
    activeClubs: number;
    approvedClubs: number;
    totalMembers: number;
    upcomingEvents: number;
    pendingEvents: number;
    officerAccounts: number;
    totalProfiles: number;
};

export type TrendPoint = {
    date: string;
    dateLabel: string;
    members: number;
    clubs: number;
};

export type EventDayStat = {
    label: string;
    value: number;
};

export type DashboardEvent = {
    id: string;
    name: string;
    description: string | null;
    approved: boolean | null;
    date: string | null;
    time: string | null;
    location: string | null;
    created_at: string | null;
};

export type PendingItem = {
    id: string;
    name: string;
    owner: string;
    type: "Club approval" | "Event approval";
    created_at: string;
};

export async function getDashboardStats(): Promise<DashboardStats> {
    await supabase.rpc("sync_approval_requests");

    const [clubs, events, profiles, approvals] = await Promise.all([
        supabase.from("clubs").select("id, approved, member_count"),
        supabase.from("events").select("id, approved"),
        supabase.from("profiles").select("id, role, officer_title"),
        supabase.from("approval_requests").select("id, queue, status"),
    ]);

    if (clubs.error) throw clubs.error;
    if (events.error) throw events.error;
    if (profiles.error) throw profiles.error;
    if (approvals.error) throw approvals.error;

    const clubData = clubs.data ?? [];
    const eventData = events.data ?? [];
    const profileData = profiles.data ?? [];
    const approvalData = approvals.data ?? [];

    const totalMembers = clubData.reduce((sum, club) => sum + (club.member_count ?? 0), 0);
    const officerProfiles = profileData.filter((p) => {
        if (p.officer_title) return true;
        if (!p.role) return false;
        return ["admin", "officer", "advisor"].includes(p.role);
    });

    return {
        activeClubs: clubData.length,
        approvedClubs: clubData.filter((c) => c.approved !== false).length,
        totalMembers,
        upcomingEvents: eventData.length,
        pendingEvents: approvalData.filter((item) => item.queue === "events" && ["pending_review", "in_review", "changes_requested"].includes(item.status)).length,
        officerAccounts: officerProfiles.length,
        totalProfiles: profileData.length,
    };
}

export async function getClubEngagementTrend(): Promise<TrendPoint[]> {
    const { data: clubs, error } = await supabase
        .from("clubs")
        .select("created_at, member_count")
        .order("created_at", { ascending: true });

    if (error) throw error;
    if (!clubs) return [];

    const grouped = new Map<string, { date: Date; members: number; clubs: number }>();
    const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

    clubs.forEach((club) => {
        const created = club.created_at ? new Date(club.created_at) : new Date();
        const key = created.toISOString().split("T")[0];
        const entry = grouped.get(key) ?? { date: created, members: 0, clubs: 0 };

        entry.members += club.member_count ?? 0;
        entry.clubs += 1;
        grouped.set(key, entry);
    });

    const sorted = Array.from(grouped.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningMembers = 0;
    let runningClubs = 0;

    return sorted.map((entry) => {
        runningMembers += entry.members;
        runningClubs += entry.clubs;

        return {
            date: entry.date.toISOString(),
            dateLabel: dateFormatter.format(entry.date),
            members: runningMembers,
            clubs: runningClubs,
        };
    });
}

export async function getMostActiveDays(): Promise<EventDayStat[]> {
    const { data: events, error } = await supabase.from("events").select("date");

    if (error) throw error;
    if (!events) return [];

    const dayOrder = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ];
    const map = new Map<string, number>(dayOrder.map((day) => [day, 0]));
    const dateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });

    events.forEach((event) => {
        if (!event.date) return;

        // Parse the date string "YYYY-MM-DD"
        const dateObj = new Date(event.date + "T00:00:00");
        if (Number.isNaN(dateObj.getTime())) return;

        const dayName = dateFormatter.format(dateObj);
        map.set(dayName, (map.get(dayName) ?? 0) + 1);
    });

    return dayOrder.map((label) => ({
        label,
        value: map.get(label) ?? 0,
    }));
}

export async function getRecentEvents(): Promise<DashboardEvent[]> {
    const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) throw error;
    return data ?? [];
}

export async function getPendingApprovals(): Promise<PendingItem[]> {
    await supabase.rpc("sync_approval_requests");

    const { data, error } = await supabase
        .from("approval_requests")
        .select("id, title, queue, status, last_action_at, metadata, assigned_to")
        .in("status", ["pending_review", "in_review", "changes_requested"])
        .order("last_action_at", { ascending: false })
        .limit(5);

    if (error) throw error;

    return ((data ?? []) as Array<{ id: string; title: string; queue: "clubs" | "events" | "budgets"; status: string; last_action_at: string | null; metadata: Record<string, unknown> | null; assigned_to: string | null }>).map((item) => {
        const metadata = (item.metadata ?? {}) as Record<string, unknown>;
        const owner =
            item.assigned_to
                ? "Assigned"
                : item.queue === "clubs"
                    ? (typeof metadata.location === "string" ? metadata.location : "Club review")
                    : (typeof metadata.club_name === "string" ? metadata.club_name : "Event review");

        return {
            id: item.id,
            name: item.title,
            owner,
            type: item.queue === "clubs" ? "Club approval" : "Event approval",
            created_at: item.last_action_at ?? new Date().toISOString(),
        } satisfies PendingItem;
    });
}
