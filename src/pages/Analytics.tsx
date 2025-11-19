import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Users, Building2, CalendarDays, ShieldCheck } from "lucide-react";

type ClubRow = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string | null;
  location?: string | null;
  day?: string | null;
  time?: string | null;
  approved?: boolean | null;
  is_active?: boolean | null;
  category?: string | null;
};

type MemberRow = {
  id: string;
  club_id: string | null;
  student_id?: string | null;
  user_id?: string | null;
  email?: string | null;
  created_at?: string | null;
};

type EventRow = {
  id: string;
  club_id: string | null;
  created_at?: string | null;
  event_date?: string | null;
};

type OfficerRow = {
  id: string;
  approved?: boolean | null;
};

type PostRow = {
  id: string;
  club_id: string | null;
  created_at?: string | null;
};

type AttendanceRow = {
  id: string;
  created_at?: string | null;
};

type FormSubmissionRow = {
  id: string;
  created_at?: string | null;
};

type ChartPoint = {
  label: string;
  value: number;
};

type EngagementPoint = {
  label: string;
  events: number;
  newMembers: number;
  posts: number;
};

type TopClub = {
  id: string;
  name: string;
  memberCount: number;
  category?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const weekFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

async function fetchOptionalTable<T>(table: string, columns: string) {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) {
    console.warn(`[Analytics] ${table} unavailable`, error.message);
    return [] as T[];
  }
  return (data as T[]) ?? [];
}

function getWeekStart(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  if (day > 1) {
    utc.setUTCDate(utc.getUTCDate() - (day - 1));
  }
  return utc;
}

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalClubs: 0,
    activeClubs: 0,
    totalMembers: 0,
    eventsThisWeek: 0,
    activeOfficers: 0,
    newMembers7Days: 0,
  });

  const [topClubs, setTopClubs] = useState<TopClub[]>([]);
  const [topActivity, setTopActivity] = useState<ChartPoint[]>([]);
  const [memberGrowth, setMemberGrowth] = useState<ChartPoint[]>([]);
  const [newClubs, setNewClubs] = useState<ChartPoint[]>([]);
  const [weeklyActiveMembers, setWeeklyActiveMembers] = useState<ChartPoint[]>([]);
  const [weeklyEvents, setWeeklyEvents] = useState<ChartPoint[]>([]);
  const [engagement, setEngagement] = useState<EngagementPoint[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<ChartPoint[]>([]);
  const [formTrend, setFormTrend] = useState<ChartPoint[]>([]);
  const [newMembersTrend, setNewMembersTrend] = useState<ChartPoint[]>([]);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const startOfWeek = getWeekStart(now);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 7);
        const last7DaysStart = new Date(now);
        last7DaysStart.setUTCDate(last7DaysStart.getUTCDate() - 6);
        const last30DaysStart = new Date(now);
        last30DaysStart.setUTCDate(last30DaysStart.getUTCDate() - 29);

        const [
          { data: clubsData = [] },
          { data: membersData = [] },
          { data: eventsData = [] },
          { data: officersData = [] },
          postsData,
          attendanceData,
          formData,
        ] = await Promise.all([
          supabase.from("clubs").select("id,name,created_at,category,approved,is_active"),
          supabase.from("club_members").select("id,club_id,student_id,user_id,email,created_at"),
          supabase.from("events").select("id,club_id,event_date,created_at"),
          supabase.from("officers").select("id,approved"),
          fetchOptionalTable<PostRow>("posts", "id,club_id,created_at"),
          fetchOptionalTable<AttendanceRow>("event_attendance", "id,created_at"),
          fetchOptionalTable<FormSubmissionRow>("form_submissions", "id,created_at"),
        ]);

        if (!active) return;

        const clubs = (clubsData as ClubRow[]) ?? [];
        const members = (membersData as MemberRow[]) ?? [];
        const events = (eventsData as EventRow[]) ?? [];
        const officers = (officersData as OfficerRow[]) ?? [];

        const totalClubs = clubs.length;
        const activeClubs = clubs.filter((club) => {
          if (typeof club.is_active === "boolean") return club.is_active;
          if (typeof club.approved === "boolean") return club.approved;
          return true;
        }).length;

        const uniqueMemberIds = new Set(members.map((member) => member.student_id || member.user_id || member.email || member.id));

        const eventsThisWeek = events.filter((event) => {
          const dateValue = event.event_date || event.created_at;
          if (!dateValue) return false;
          const date = new Date(dateValue);
          return date >= startOfWeek && date < endOfWeek;
        }).length;

        const activeOfficers = officers.filter((officer) => officer.approved !== false).length;

        const newMembersLast7 = members.filter((member) => {
          if (!member.created_at) return false;
          const date = new Date(member.created_at);
          return date >= last7DaysStart && date <= now;
        }).length;

        setStats({
          totalClubs,
          activeClubs,
          totalMembers: uniqueMemberIds.size,
          eventsThisWeek,
          activeOfficers,
          newMembers7Days: newMembersLast7,
        });

        const engagementMap = new Map<string, EngagementPoint>();
        for (let i = 0; i < 7; i += 1) {
          const current = new Date(last7DaysStart);
          current.setUTCDate(last7DaysStart.getUTCDate() + i);
          const key = current.toISOString().split("T")[0];
          engagementMap.set(key, {
            label: dateFormatter.format(current),
            events: 0,
            newMembers: 0,
            posts: 0,
          });
        }

        events.forEach((event) => {
          const dateValue = event.event_date || event.created_at;
          if (!dateValue) return;
          const date = new Date(dateValue);
          const key = date.toISOString().split("T")[0];
          if (engagementMap.has(key)) {
            engagementMap.get(key)!.events += 1;
          }
        });

        members.forEach((member) => {
          if (!member.created_at) return;
          const date = new Date(member.created_at);
          const key = date.toISOString().split("T")[0];
          if (engagementMap.has(key)) {
            engagementMap.get(key)!.newMembers += 1;
          }
        });

        postsData.forEach((post) => {
          if (!post.created_at) return;
          const date = new Date(post.created_at);
          const key = date.toISOString().split("T")[0];
          if (engagementMap.has(key)) {
            engagementMap.get(key)!.posts += 1;
          }
        });

        setEngagement(Array.from(engagementMap.values()));

        const topClubMap = new Map<string, { name: string; count: number; category?: string | null }>();
        members.forEach((member) => {
          if (!member.club_id) return;
          const club = clubs.find((c) => c.id === member.club_id);
          if (!club) return;

          const existing = topClubMap.get(member.club_id) || {
            name: club.name,
            count: 0,
            category: club.category,
          };
          existing.count += 1;
          topClubMap.set(member.club_id, existing);
        });

        const topClubList: TopClub[] = Array.from(topClubMap.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([id, info]) => ({
            id,
            name: info.name,
            memberCount: info.count,
            category: info.category,
          }));

        setTopClubs(topClubList);

        const activityMap = new Map<string, number>();
        events.forEach((event) => {
          if (!event.club_id) return;
          activityMap.set(event.club_id, (activityMap.get(event.club_id) ?? 0) + 1);
        });
        members.forEach((member) => {
          if (!member.club_id) return;
          activityMap.set(member.club_id, (activityMap.get(member.club_id) ?? 0) + 1);
        });
        postsData.forEach((post) => {
          if (!post.club_id) return;
          activityMap.set(post.club_id, (activityMap.get(post.club_id) ?? 0) + 1);
        });

        const topActivityList: ChartPoint[] = Array.from(activityMap.entries())
          .map(([clubId, score]) => {
            const club = clubs.find((c) => c.id === clubId);
            return {
              label: club?.name ?? "Unknown",
              value: score,
            };
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setTopActivity(topActivityList);

        const memberGrowthMap = new Map<string, number>();
        const newMembersTrendMap = new Map<string, number>();
        for (let i = 0; i < 30; i += 1) {
          const current = new Date(last30DaysStart);
          current.setUTCDate(last30DaysStart.getUTCDate() + i);
          const key = current.toISOString().split("T")[0];
          memberGrowthMap.set(key, 0);
          if (i >= 23) {
            newMembersTrendMap.set(key, 0);
          }
        }

        members.forEach((member) => {
          if (!member.created_at) return;
          const date = new Date(member.created_at);
          const key = date.toISOString().split("T")[0];
          if (memberGrowthMap.has(key)) {
            memberGrowthMap.set(key, (memberGrowthMap.get(key) ?? 0) + 1);
          }
          if (newMembersTrendMap.has(key)) {
            newMembersTrendMap.set(key, (newMembersTrendMap.get(key) ?? 0) + 1);
          }
        });

        setMemberGrowth(
          Array.from(memberGrowthMap.entries()).map(([key, value]) => ({
            label: dateFormatter.format(new Date(key)),
            value,
          })),
        );
        setNewMembersTrend(
          Array.from(newMembersTrendMap.entries()).map(([key, value]) => ({
            label: dateFormatter.format(new Date(key)),
            value,
          })),
        );

        const newClubMap = new Map<string, number>();
        for (let i = 0; i < 30; i += 1) {
          const current = new Date(last30DaysStart);
          current.setUTCDate(last30DaysStart.getUTCDate() + i);
          const key = current.toISOString().split("T")[0];
          newClubMap.set(key, 0);
        }

        clubs.forEach((club) => {
          if (!club.created_at) return;
          const key = new Date(club.created_at).toISOString().split("T")[0];
          if (newClubMap.has(key)) {
            newClubMap.set(key, (newClubMap.get(key) ?? 0) + 1);
          }
        });

        setNewClubs(
          Array.from(newClubMap.entries()).map(([key, value]) => ({
            label: dateFormatter.format(new Date(key)),
            value,
          })),
        );

        const weekMemberMap = new Map<string, number>();
        const weekEventMap = new Map<string, number>();
        members.forEach((member) => {
          if (!member.created_at) return;
          const date = new Date(member.created_at);
          const week = getWeekStart(date).toISOString().split("T")[0];
          weekMemberMap.set(week, (weekMemberMap.get(week) ?? 0) + 1);
        });
        events.forEach((event) => {
          const dateValue = event.event_date || event.created_at;
          if (!dateValue) return;
          const date = new Date(dateValue);
          const week = getWeekStart(date).toISOString().split("T")[0];
          weekEventMap.set(week, (weekEventMap.get(week) ?? 0) + 1);
        });

        setWeeklyActiveMembers(
          Array.from(weekMemberMap.entries())
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([key, value]) => ({
              label: weekFormatter.format(new Date(key)),
              value,
            })),
        );
        setWeeklyEvents(
          Array.from(weekEventMap.entries())
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([key, value]) => ({
              label: weekFormatter.format(new Date(key)),
              value,
            })),
        );

        if (attendanceData.length) {
          const attendanceMap = new Map<string, number>();
          attendanceData.forEach((record) => {
            if (!record.created_at) return;
            const week = getWeekStart(new Date(record.created_at)).toISOString().split("T")[0];
            attendanceMap.set(week, (attendanceMap.get(week) ?? 0) + 1);
          });
          setAttendanceTrend(
            Array.from(attendanceMap.entries())
              .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
              .map(([key, value]) => ({
                label: weekFormatter.format(new Date(key)),
                value,
              })),
          );
        } else {
          setAttendanceTrend([]);
        }

        if (formData.length) {
          const formMap = new Map<string, number>();
          formData.forEach((form) => {
            if (!form.created_at) return;
            const key = new Date(form.created_at).toISOString().split("T")[0];
            formMap.set(key, (formMap.get(key) ?? 0) + 1);
          });
          setFormTrend(
            Array.from(formMap.entries())
              .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
              .map(([key, value]) => ({
                label: dateFormatter.format(new Date(key)),
                value,
              })),
          );
        } else {
          setFormTrend([]);
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load analytics.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const statCards = useMemo(
    () => [
      {
        title: "Total Clubs",
        value: stats.totalClubs.toLocaleString(),
        icon: Building2,
        description: `${stats.activeClubs} active`,
      },
      {
        title: "Total Members",
        value: stats.totalMembers.toLocaleString(),
        icon: Users,
        description: `${stats.newMembers7Days} joined last 7 days`,
      },
      {
        title: "Events This Week",
        value: stats.eventsThisWeek.toString(),
        icon: CalendarDays,
        description: "Current calendar week",
      },
      {
        title: "Active Officers",
        value: stats.activeOfficers.toString(),
        icon: ShieldCheck,
        description: "Across all clubs",
      },
    ],
    [stats],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Insight into Student Life engagement across clubs.</p>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Unable to load analytics: {error}
        </div>
      )}
      <section>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Top Clubs by Member Count"
          description="Most subscribed clubs"
          data={topClubs.map((club) => ({ label: club.name, value: club.memberCount }))}
          loading={loading}
        />
        <BarChartCard
          title="Top Clubs by Activity"
          description="Events + new members + posts"
          data={topActivity}
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <LineChartCard
          title="Member Growth (Last 30 Days)"
          description="New members per day"
          data={memberGrowth}
          loading={loading}
        />
        <BarChartCard
          title="New Clubs Created (Last 30 Days)"
          description="Daily club creation trend"
          data={newClubs}
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <LineChartCard
          title="Weekly Active Members"
          description="Members who joined a club recently"
          data={weeklyActiveMembers}
          loading={loading}
        />
        <BarChartCard
          title="Weekly Event Count"
          description="Events grouped by week"
          data={weeklyEvents}
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EngagementChartCard data={engagement} loading={loading} />
        <LineChartCard
          title="New Members (Last 7 Days)"
          description="Daily onboarding trend"
          data={newMembersTrend}
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {attendanceTrend.length ? (
          <LineChartCard
            title="Event Attendance Trend"
            description="Weekly attendance submissions"
            data={attendanceTrend}
            loading={loading}
          />
        ) : (
          <EmptyChartCard title="Event Attendance Trend" description="Attendance table unavailable" />
        )}
        {formTrend.length ? (
          <LineChartCard
            title="Form Submissions"
            description="If applicable forms table is present"
            data={formTrend}
            loading={loading}
          />
        ) : (
          <EmptyChartCard title="Form Submissions" description="Forms data not available" />
        )}
      </section>

      <TopClubsTable data={topClubs} loading={loading} />
    </div>
  );
};

export default Analytics;

const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-semibold">{value}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

const ChartWrapper = ({
  title,
  description,
  children,
  loading,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
}) => (
  <Card className="h-full">
    <CardHeader className="space-y-1">
      <CardTitle>{title}</CardTitle>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </CardHeader>
    <CardContent className="h-72">
      {loading ? <Skeleton className="h-full w-full rounded-xl" /> : children}
    </CardContent>
  </Card>
);

const BarChartCard = ({
  title,
  description,
  data,
  loading,
}: {
  title: string;
  description?: string;
  data: ChartPoint[];
  loading?: boolean;
}) => (
  <ChartWrapper title={title} description={description} loading={loading}>
    {data.length ? (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <EmptyState />
    )}
  </ChartWrapper>
);

const LineChartCard = ({
  title,
  description,
  data,
  loading,
}: {
  title: string;
  description?: string;
  data: ChartPoint[];
  loading?: boolean;
}) => (
  <ChartWrapper title={title} description={description} loading={loading}>
    {data.length ? (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    ) : (
      <EmptyState />
    )}
  </ChartWrapper>
);

const EngagementChartCard = ({ data, loading }: { data: EngagementPoint[]; loading?: boolean }) => (
  <ChartWrapper title="Engagement Summary" description="Events + new members + posts (last 7 days)" loading={loading}>
    {data.length ? (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="events" stackId="a" fill="hsl(var(--primary))" />
          <Bar dataKey="newMembers" stackId="a" fill="hsl(var(--chart-2, var(--muted-foreground)))" />
          <Bar dataKey="posts" stackId="a" fill="hsl(var(--chart-3, var(--secondary)))" />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <EmptyState />
    )}
  </ChartWrapper>
);

const EmptyChartCard = ({ title, description }: { title: string; description?: string }) => (
  <Card className="h-full">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </CardHeader>
    <CardContent className="flex h-72 items-center justify-center">
      <EmptyState />
    </CardContent>
  </Card>
);

const EmptyState = () => (
  <div className="text-center text-sm text-muted-foreground">No data available.</div>
);

const TopClubsTable = ({ data, loading }: { data: TopClub[]; loading?: boolean }) => (
  <Card>
    <CardHeader>
      <CardTitle>Top Clubs</CardTitle>
      <p className="text-sm text-muted-foreground">Ranking by member count</p>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : data.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Club</TableHead>
              <TableHead>Member Count</TableHead>
              <TableHead>Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((club) => (
              <TableRow key={club.id}>
                <TableCell className="font-medium">{club.name}</TableCell>
                <TableCell>{club.memberCount.toLocaleString()}</TableCell>
                <TableCell>{club.category ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState />
      )}
    </CardContent>
  </Card>
);
