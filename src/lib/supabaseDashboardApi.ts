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
    const [clubs, events, profiles] = await Promise.all([
        supabase.from("clubs").select("id, approved, member_count"),
        supabase.from("events").select("id, approved"),
        supabase.from("profiles").select("id, role, officer_title"),
    ]);

    if (clubs.error) throw clubs.error;
    if (events.error) throw events.error;
    if (profiles.error) throw profiles.error;

    const clubData = clubs.data ?? [];
    const eventData = events.data ?? [];
    const profileData = profiles.data ?? [];

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
        pendingEvents: eventData.filter((e) => e.approved === false).length,
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

    const map = new Map<string, number>();
    const dateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });

    events.forEach((event) => {
        if (!event.date) return;

        // Parse the date string "YYYY-MM-DD"
        const dateObj = new Date(event.date + "T00:00:00");
        if (Number.isNaN(dateObj.getTime())) return;

        const dayName = dateFormatter.format(dateObj);
        map.set(dayName, (map.get(dayName) ?? 0) + 1);
    });

    return Array.from(map.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
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
    const [clubs, events] = await Promise.all([
        supabase
            .from("clubs")
            .select("id, name, location, created_at")
            .eq("approved", false)
            .limit(5),
        supabase
            .from("events")
            .select("id, name, location, created_at")
            .eq("approved", false)
            .limit(5),
    ]);

    if (clubs.error) throw clubs.error;
    if (events.error) throw events.error;

    const pendingClubs: PendingItem[] = (clubs.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        owner: c.location ?? "Club",
        type: "Club approval",
        created_at: c.created_at ?? new Date().toISOString(),
    }));

    const pendingEvents: PendingItem[] = (events.data ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        owner: e.location ?? "Event",
        type: "Event approval",
        created_at: e.created_at ?? new Date().toISOString(),
    }));

    return [...pendingClubs, ...pendingEvents]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
}
