import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/line-charts-6";
import { Line, LineChart as ReLineChart, XAxis, YAxis, CartesianGrid } from "recharts";

type Club = {
  id: string;
  name: string;
  description: string | null;
  approved: boolean | null;
  day: string | null;
  time: string | null;
  member_count: number | null;
  created_at: string | null;
  location: string | null;
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  approved: boolean | null;
  day: string | null;
  time: string | null;
  location: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  officer_title: string | null;
  created_at: string | null;
};

type PendingItem = {
  id: string;
  name: string;
  owner: string;
  type: string;
};

const memberTrendConfig: ChartConfig = {
  members: {
    label: "Members",
    color: "hsl(var(--primary))",
  },
  clubs: {
    label: "Clubs",
    color: "hsl(var(--chart-2, var(--secondary)))",
  },
};

function Dashboard() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchAllData = async () => {
      setLoading(true);

      const [clubResult, eventResult, profileResult] = await Promise.all([
        supabase.from("clubs").select("*").order("created_at", { ascending: true }),
        supabase.from("events").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);

      if (!active) return;

      const firstError =
        clubResult.error ?? eventResult.error ?? profileResult.error ?? null;

      if (firstError) {
        setError(firstError.message);
      } else {
        setClubs(clubResult.data ?? []);
        setEvents(eventResult.data ?? []);
        setProfiles(profileResult.data ?? []);
        setError(null);
      }

      setLoading(false);
    };

    fetchAllData();

    return () => {
      active = false;
    };
  }, []);

  const officerProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      if (profile.officer_title) return true;
      if (!profile.role) return false;
      return ["admin", "officer", "advisor"].includes(profile.role);
    });
  }, [profiles]);

  const totalMembers = useMemo(
    () => clubs.reduce((sum, club) => sum + (club.member_count ?? 0), 0),
    [clubs],
  );

  const pendingItems: PendingItem[] = useMemo(() => {
    const pendingClubs =
      clubs
        .filter((club) => club.approved === false)
        .map((club) => ({
          id: club.id,
          name: club.name,
          owner: club.location ?? "Club",
          type: "Club approval",
        })) ?? [];

    const pendingEvents =
      events
        .filter((event) => event.approved === false)
        .map((event) => ({
          id: event.id,
          name: event.name,
          owner: event.location ?? "Event",
          type: "Event approval",
        })) ?? [];

    return [...pendingClubs, ...pendingEvents].slice(0, 4);
  }, [clubs, events]);

  const trendData = useMemo(() => {
    if (!clubs.length) return [];

    const grouped = new Map<
      string,
      { dateLabel: string; members: number; clubs: number; timestamp: number }
    >();

    clubs.forEach((club) => {
      const created = club.created_at ? new Date(club.created_at) : null;
      const key = created ? created.toISOString().split("T")[0] : `unknown-${club.id}`;
      const dateLabel = created
        ? created.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "Pending";
      const entry =
        grouped.get(key) ??
        {
          dateLabel,
          members: 0,
          clubs: 0,
          timestamp: created?.getTime() ?? Date.now(),
        };

      entry.members += club.member_count ?? 0;
      entry.clubs += 1;
      grouped.set(key, entry);
    });

    return Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [clubs]);

  const chartData =
    trendData.length > 0
      ? trendData
      : [
          { dateLabel: "Week 1", members: 0, clubs: 0, timestamp: 1 },
          { dateLabel: "Week 2", members: 0, clubs: 0, timestamp: 2 },
        ];

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => {
      const key = event.day ?? "TBD";
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [events]);

  const recentEvents = useMemo(
    () => events.slice(0, 4),
    [events],
  );

  const kpiCards = [
    {
      label: "Active Clubs",
      value: clubs.length.toString(),
      helper: `${clubs.filter((club) => club.approved !== false).length} approved`,
    },
    {
      label: "Total Members",
      value: totalMembers.toLocaleString(),
      helper: `Across ${clubs.length} clubs`,
    },
    {
      label: "Upcoming Events",
      value: events.length.toString(),
      helper: `${events.filter((event) => event.approved === false).length} pending`,
    },
    {
      label: "Officer Accounts",
      value: officerProfiles.length.toString(),
      helper: `${profiles.length} total profiles`,
    },
  ];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Unable to load dashboard data: {error}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((item) => (
            <Card key={item.label}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
                <p className="text-2xl font-semibold">{item.value}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Club engagement trend</CardTitle>
            <p className="text-sm text-muted-foreground">
              Member growth and club submissions pulled directly from Supabase.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <ChartContainer config={memberTrendConfig} className="h-64 w-full rounded-xl bg-muted/30">
                <ReLineChart data={chartData} margin={{ left: 12, right: 24, top: 20, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted-foreground) / 0.25)" />
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Line
                    type="monotone"
                    dataKey="members"
                    stroke="var(--color-members)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="clubs"
                    stroke="var(--color-clubs)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="6 4"
                  />
                </ReLineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most active days</CardTitle>
            <p className="text-sm text-muted-foreground">
              Days with the most published events in Supabase.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full rounded-xl" />
            ) : eventsByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events found yet.
              </p>
            ) : (
              <div className="flex h-56 items-end gap-3">
                {(() => {
                  const maxValue = eventsByDay[0]?.value ?? 1;
                  return eventsByDay.map((bar, index) => {
                    const heightPercentage =
                      maxValue > 0 ? (bar.value / maxValue) * 100 : 0;
                    return (
                      <div key={`${bar.label}-${index}`} className="flex-1">
                        <div
                          className="rounded-t-md bg-secondary"
                          style={{ height: `${heightPercentage}%` }}
                        />
                        <p className="mt-2 text-center text-sm font-medium">
                          {bar.value}
                        </p>
                        <p className="text-center text-xs text-muted-foreground">
                          {bar.label}
                        </p>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest entries from the Supabase `events` table.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        {event.name}
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      </TableCell>
                      <TableCell>{event.day ?? "TBD"}</TableCell>
                      <TableCell>{event.location ?? "TBD"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={event.approved ? "default" : "destructive"}
                        >
                          {event.approved ? "Approved" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
            <p className="text-sm text-muted-foreground">
              Items requiring attention from the Connect Camp team.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))
            ) : pendingItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing needs approval right now.
              </p>
            ) : (
              pendingItems.map((item) => (
                <div key={item.id} className="rounded-lg border bg-card/70 p-3">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.owner}</p>
                  <Badge variant="outline" className="mt-2">
                    {item.type}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
