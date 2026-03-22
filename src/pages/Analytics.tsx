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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Users, Building2, CalendarDays, ShieldCheck, AlertTriangle, Activity } from "lucide-react";
import { AnalyticsChatbot } from "@/components/AnalyticsChatbot";
import { useAuth } from "@/context/AuthContext";
import { listForms, resolveFormsOrgId } from "@/lib/formsDataApi";

type ClubRow = {
  id: string;
  name: string;
  description: string | null;
  org_id?: string | null;
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
  user_id?: string | null;
  created_at?: string | null;
};

type EventRow = {
  id: string;
  club_id: string | null;
  created_at?: string | null;
  event_date?: string | null;
  approved?: boolean | null;
};

type OfficerRow = {
  id: string;
  club_id: string | null;
  approved?: boolean | null;
};

type PostRow = {
  id: string;
  club_id: string | null;
  created_at?: string | null;
};

type FormSubmissionRow = {
  id: string;
  form_id?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
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
  healthScore: number;
  healthStatus: "Excellent" | "Fair" | "Critical";
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const weekFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function isSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("does not exist") === true
  );
}

function isAccessError(error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42501" || error.code === "PGRST301") return true;

  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    message.includes("permission denied") ||
    message.includes("not allowed") ||
    message.includes("forbidden") ||
    message.includes("row-level security")
  );
}

async function fetchOptionalTable<T>(table: string, columns: string, apply?: (query: any) => any) {
  let query = supabase.from(table).select(columns);
  if (apply) {
    query = apply(query);
  }

  const { data, error } = await query;
  if (!error) {
    return {
      data: (data as T[]) ?? [],
      missing: false,
    };
  }

  if (isSchemaError(error) || isAccessError(error)) {
    return {
      data: [] as T[],
      missing: true,
    };
  }

  throw error;
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateFromKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

async function fetchScopedClubs(orgId: string | null) {
  const candidateQueries: Array<{ columns: string; scoped: boolean }> = [
    { columns: "id,name,created_at,category,approved,is_active,org_id", scoped: true },
    { columns: "id,name,created_at,category,approved,is_active", scoped: false },
    { columns: "id,name,created_at,approved,is_active", scoped: false },
    { columns: "id,name,created_at,approved", scoped: false },
    { columns: "id,name,created_at", scoped: false },
  ];

  let lastError: { code?: string; message?: string; details?: string; hint?: string } | null = null;

  for (const candidate of candidateQueries) {
    let query = supabase.from("clubs").select(candidate.columns);
    if (orgId && candidate.scoped) {
      query = query.eq("org_id", orgId);
    }

    const { data, error } = await query;
    if (!error) {
      return ((data ?? []) as unknown[]) as ClubRow[];
    }

    if (isSchemaError(error) || isAccessError(error)) {
      lastError = error;
      continue;
    }

    throw error;
  }

  if (lastError && (isSchemaError(lastError) || isAccessError(lastError))) {
    return [];
  }

  throw lastError ?? new Error("Unable to load clubs for analytics.");
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
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalClubs: 0,
    activeClubs: 0,
    atRiskClubs: 0,
    totalMembers: 0,
    activeMemberRate: 0,
    eventsThisWeek: 0,
    avgAttendanceRatio: 0, // Placeholder
    activeOfficers: 0,
    officerVacancyRate: 0,
    newMembers7Days: 0,
    pendingApprovals: 0,
    ghostClubs: 0,
  });

  const [topClubs, setTopClubs] = useState<TopClub[]>([]);
  const [topActivity, setTopActivity] = useState<ChartPoint[]>([]);
  const [memberGrowth, setMemberGrowth] = useState<ChartPoint[]>([]);
  const [newClubs, setNewClubs] = useState<ChartPoint[]>([]);
  const [weeklyActiveMembers, setWeeklyActiveMembers] = useState<ChartPoint[]>([]);
  const [weeklyEvents, setWeeklyEvents] = useState<ChartPoint[]>([]);
  const [engagement, setEngagement] = useState<EngagementPoint[]>([]);
  const [formTrend, setFormTrend] = useState<ChartPoint[]>([]);
  const [newMembersTrend, setNewMembersTrend] = useState<ChartPoint[]>([]);
  const orgId = useMemo(() => resolveFormsOrgId(profile?.org_id), [profile?.org_id]);

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
        const last60DaysStart = new Date(now);
        last60DaysStart.setUTCDate(last60DaysStart.getUTCDate() - 59);

        const clubs = await fetchScopedClubs(orgId);
        const clubIds = clubs.map((club) => club.id);

        const [
          membersResult,
          eventsResult,
          officersResult,
          postsResult,
          formsResult,
        ] = await Promise.all([
          clubIds.length
            ? fetchOptionalTable<MemberRow>("club_members", "id,club_id,user_id,created_at", (query) =>
                query.in("club_id", clubIds)
              )
            : Promise.resolve({ data: [] as MemberRow[], missing: true }),
          clubIds.length
            ? fetchOptionalTable<EventRow>("events", "id,club_id,event_date,created_at,approved", (query) =>
                query.in("club_id", clubIds)
              )
            : Promise.resolve({ data: [] as EventRow[], missing: true }),
          clubIds.length
            ? fetchOptionalTable<OfficerRow>("officers", "id,club_id,approved", (query) =>
                query.in("club_id", clubIds)
              )
            : Promise.resolve({ data: [] as OfficerRow[], missing: true }),
          clubIds.length
            ? fetchOptionalTable<PostRow>("posts", "id,club_id,created_at", (query) =>
                query.in("club_id", clubIds)
              )
            : Promise.resolve({ data: [] as PostRow[], missing: true }),
          listForms(orgId)
            .then((forms) => ({ data: forms, missing: false }))
            .catch((error) => {
              if (isSchemaError(error) || isAccessError(error)) {
                return { data: [], missing: true };
              }
              throw error;
            }),
        ]);

        if (!active) return;

        const members = membersResult.data;
        const events = eventsResult.data;
        const officers = officersResult.data;
        const postsData = postsResult.data;
        const formIds = formsResult.data.map((form) => form.id);

        let formRows: FormSubmissionRow[] = [];
        if (formIds.length) {
          const responsesResult = await fetchOptionalTable<FormSubmissionRow>(
            "form_responses",
            "id, form_id, created_at",
            (query) => query.in("form_id", formIds),
          );

          if (!responsesResult.missing) {
            formRows = responsesResult.data.map((row) => ({
              id: row.id,
              form_id: row.form_id ?? null,
              created_at: row.created_at ?? null,
            }));
          } else {
            const legacyResult = await fetchOptionalTable<FormSubmissionRow>(
              "form_submissions",
              "id, form_id, submitted_at",
              (query) => query.in("form_id", formIds)
            );

            formRows = legacyResult.data.map((row) => ({
              id: row.id,
              form_id: row.form_id ?? null,
              created_at: row.submitted_at ?? row.created_at ?? null,
            }));
          }
        }

        // --- Basic Stats ---
        const totalClubs = clubs.length;
        const activeClubs = clubs.filter((club) => {
          if (typeof club.is_active === "boolean") return club.is_active;
          if (typeof club.approved === "boolean") return club.approved;
          return false;
        }).length;

        const uniqueMemberIds = new Set(members.map((member) => member.user_id || member.id));
        const totalMembers = uniqueMemberIds.size;

        const eventsThisWeek = events.filter((event) => {
          const dateValue = event.event_date || event.created_at;
          if (!dateValue) return false;
          const date = parseDateValue(dateValue);
          if (!date) return false;
          return date >= startOfWeek && date < endOfWeek;
        }).length;

        const activeOfficers = officers.filter((officer) => officer.approved !== false).length;

        const newMembersLast7 = members.filter((member) => {
          if (!member.created_at) return false;
          const date = parseDateValue(member.created_at);
          if (!date) return false;
          return date >= last7DaysStart && date <= now;
        }).length;

        // --- Enhanced Metrics ---

        // 1. At-Risk Clubs: 0 events AND 0 posts in last 60 days
        const recentActivityMap = new Map<string, boolean>();
        events.forEach(e => {
          const dateValue = parseDateValue(e.event_date || e.created_at || null);
          if (dateValue && dateValue >= last60DaysStart && e.club_id) recentActivityMap.set(e.club_id, true);
        });
        postsData.forEach(p => {
          const dateValue = parseDateValue(p.created_at);
          if (dateValue && dateValue >= last60DaysStart && p.club_id) recentActivityMap.set(p.club_id, true);
        });

        const atRiskClubs = clubs.filter(c => !recentActivityMap.has(c.id)).length;

        // 2. Active Member Rate (Proxy: Members in active clubs / Total Members)
        // Since we don't have attendance, we'll define "Active Member" as belonging to a club with recent activity
        const engagedMembers = new Set(
          members
            .filter((member) => member.club_id && recentActivityMap.has(member.club_id))
            .map((member) => member.user_id || member.id)
        );
        const activeMemberRate = totalMembers > 0 ? Math.round((engagedMembers.size / totalMembers) * 100) : 0;

        // 3. Officer Vacancy Rate: Clubs with < 2 active officers
        const officerCountMap = new Map<string, number>();
        officers.forEach(o => {
          if (o.approved !== false && o.club_id) {
            officerCountMap.set(o.club_id, (officerCountMap.get(o.club_id) || 0) + 1);
          }
        });
        const clubsWithVacancies = clubs.filter(c => (officerCountMap.get(c.id) || 0) < 2).length;
        const officerVacancyRate = totalClubs > 0 ? Math.round((clubsWithVacancies / totalClubs) * 100) : 0;

        // 4. Ghost Clubs: Created > 30 days ago, <= 1 member, 0 events
        const clubMemberCountMap = new Map<string, number>();
        members.forEach(m => {
          if (m.club_id) clubMemberCountMap.set(m.club_id, (clubMemberCountMap.get(m.club_id) || 0) + 1);
        });
        const clubEventCountMap = new Map<string, number>();
        events.forEach(e => {
          if (e.club_id) clubEventCountMap.set(e.club_id, (clubEventCountMap.get(e.club_id) || 0) + 1);
        });

        const ghostClubs = clubs.filter(c => {
          const created = parseDateValue(c.created_at);
          if (!created) return false;
          const ageDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
          const memberCount = clubMemberCountMap.get(c.id) || 0;
          const eventCount = clubEventCountMap.get(c.id) || 0;
          return ageDays > 30 && memberCount <= 1 && eventCount === 0;
        }).length;

        // 5. Pending Approvals (Intervention Signals)
        const pendingClubs = clubs.filter(c => c.approved === false || c.approved === null).length; // Assuming null/false is pending/unapproved
        const pendingEvents = events.filter(e => !e.approved).length;
        const pendingOfficers = officers.filter(o => !o.approved).length;
        const totalPending = pendingClubs + pendingEvents + pendingOfficers;

        setStats({
          totalClubs,
          activeClubs,
          atRiskClubs,
          totalMembers,
          activeMemberRate,
          eventsThisWeek,
          avgAttendanceRatio: 0, // No data
          activeOfficers,
          officerVacancyRate,
          newMembers7Days: newMembersLast7,
          pendingApprovals: totalPending,
          ghostClubs,
        });

        // --- Charts & Tables ---

        const engagementMap = new Map<string, EngagementPoint>();
        for (let i = 0; i < 7; i += 1) {
          const current = new Date(last7DaysStart);
          current.setUTCDate(last7DaysStart.getUTCDate() + i);
          const key = getDateKey(current);
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
          const date = parseDateValue(dateValue);
          if (!date) return;
          const key = getDateKey(date);
          if (engagementMap.has(key)) {
            engagementMap.get(key)!.events += 1;
          }
        });

        members.forEach((member) => {
          if (!member.created_at) return;
          const date = parseDateValue(member.created_at);
          if (!date) return;
          const key = getDateKey(date);
          if (engagementMap.has(key)) {
            engagementMap.get(key)!.newMembers += 1;
          }
        });

        postsData.forEach((post) => {
          if (!post.created_at) return;
          const date = parseDateValue(post.created_at);
          if (!date) return;
          const key = getDateKey(date);
          if (engagementMap.has(key)) {
            engagementMap.get(key)!.posts += 1;
          }
        });

        setEngagement(Array.from(engagementMap.values()));

        // Health Score Calculation
        const topClubList: TopClub[] = clubs.map(club => {
          const memberCount = clubMemberCountMap.get(club.id) || 0;
          const eventCount = clubEventCountMap.get(club.id) || 0;
          const officerCount = officerCountMap.get(club.id) || 0;

          // Simple Health Score (0-100)
          // 40% Engagement (Members > 5 -> full points?) -> Let's use member count relative to avg? 
          // Let's stick to the plan: 40% Engagement, 30% Consistency, 30% Compliance
          // Since we lack detailed data, we'll approximate:
          // Engagement: Member count (capped at 50 for max score) -> 40 pts
          // Consistency: Event count (capped at 5) -> 30 pts
          // Compliance: Officers >= 2 -> 30 pts

          const engagementScore = Math.min(memberCount, 50) / 50 * 40;
          const consistencyScore = Math.min(eventCount, 5) / 5 * 30;
          const complianceScore = officerCount >= 2 ? 30 : (officerCount * 15);

          const healthScore = Math.round(engagementScore + consistencyScore + complianceScore);

          let healthStatus: "Excellent" | "Fair" | "Critical" = "Critical";
          if (healthScore >= 80) healthStatus = "Excellent";
          else if (healthScore >= 50) healthStatus = "Fair";

          return {
            id: club.id,
            name: club.name,
            memberCount,
            category: club.category,
            healthScore,
            healthStatus
          };
        })
          .sort((a, b) => b.healthScore - a.healthScore || b.memberCount - a.memberCount)
          .slice(0, 5);

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
          const key = getDateKey(current);
          memberGrowthMap.set(key, 0);
          if (i >= 23) {
            newMembersTrendMap.set(key, 0);
          }
        }

        members.forEach((member) => {
          if (!member.created_at) return;
          const date = parseDateValue(member.created_at);
          if (!date) return;
          const key = getDateKey(date);
          if (memberGrowthMap.has(key)) {
            memberGrowthMap.set(key, (memberGrowthMap.get(key) ?? 0) + 1);
          }
          if (newMembersTrendMap.has(key)) {
            newMembersTrendMap.set(key, (newMembersTrendMap.get(key) ?? 0) + 1);
          }
        });

        setMemberGrowth(
          Array.from(memberGrowthMap.entries()).map(([key, value]) => ({
            label: dateFormatter.format(getDateFromKey(key)),
            value,
          })),
        );
        setNewMembersTrend(
          Array.from(newMembersTrendMap.entries()).map(([key, value]) => ({
            label: dateFormatter.format(getDateFromKey(key)),
            value,
          })),
        );

        const newClubMap = new Map<string, number>();
        for (let i = 0; i < 30; i += 1) {
          const current = new Date(last30DaysStart);
          current.setUTCDate(last30DaysStart.getUTCDate() + i);
          const key = getDateKey(current);
          newClubMap.set(key, 0);
        }

        clubs.forEach((club) => {
          if (!club.created_at) return;
          const created = parseDateValue(club.created_at);
          if (!created) return;
          const key = getDateKey(created);
          if (newClubMap.has(key)) {
            newClubMap.set(key, (newClubMap.get(key) ?? 0) + 1);
          }
        });

        setNewClubs(
          Array.from(newClubMap.entries()).map(([key, value]) => ({
            label: dateFormatter.format(getDateFromKey(key)),
            value,
          })),
        );

        const weekMemberMap = new Map<string, number>();
        const weekEventMap = new Map<string, number>();
        members.forEach((member) => {
          if (!member.created_at) return;
          const date = parseDateValue(member.created_at);
          if (!date) return;
          const week = getDateKey(getWeekStart(date));
          weekMemberMap.set(week, (weekMemberMap.get(week) ?? 0) + 1);
        });
        events.forEach((event) => {
          const dateValue = event.event_date || event.created_at;
          if (!dateValue) return;
          const date = parseDateValue(dateValue);
          if (!date) return;
          const week = getDateKey(getWeekStart(date));
          weekEventMap.set(week, (weekEventMap.get(week) ?? 0) + 1);
        });

        setWeeklyActiveMembers(
          Array.from(weekMemberMap.entries())
            .sort((a, b) => getDateFromKey(a[0]).getTime() - getDateFromKey(b[0]).getTime())
            .map(([key, value]) => ({
              label: weekFormatter.format(getDateFromKey(key)),
              value,
            })),
        );
        setWeeklyEvents(
          Array.from(weekEventMap.entries())
            .sort((a, b) => getDateFromKey(a[0]).getTime() - getDateFromKey(b[0]).getTime())
            .map(([key, value]) => ({
              label: weekFormatter.format(getDateFromKey(key)),
              value,
            })),
        );

        if (formRows.length) {
          const formMap = new Map<string, number>();
          formRows.forEach((form) => {
            if (!form.created_at) return;
            const created = parseDateValue(form.created_at);
            if (!created) return;
            const key = getDateKey(created);
            formMap.set(key, (formMap.get(key) ?? 0) + 1);
          });
          setFormTrend(
            Array.from(formMap.entries())
              .sort((a, b) => getDateFromKey(a[0]).getTime() - getDateFromKey(b[0]).getTime())
              .map(([key, value]) => ({
                label: dateFormatter.format(getDateFromKey(key)),
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
  }, [orgId]);

  const statCards = useMemo(
    () => [
      {
        title: "Total Clubs",
        value: stats.totalClubs.toLocaleString(),
        icon: Building2,
        description: `${stats.activeClubs} active`,
        insight: stats.atRiskClubs > 0 ? `⚠️ ${stats.atRiskClubs} clubs inactive for 60+ days` : undefined,
        insightColor: "text-amber-600",
      },
      {
        title: "Total Members",
        value: stats.totalMembers.toLocaleString(),
        icon: Users,
        description: `${stats.newMembers7Days} joined last 7 days`,
        insight: `${stats.activeMemberRate}% belong to clubs active in the last 60 days`,
        insightColor: "text-green-600",
      },
      {
        title: "Events This Week",
        value: stats.eventsThisWeek.toString(),
        icon: CalendarDays,
        description: "Current calendar week",
        // insight: "Avg. 65% turnout", // Placeholder until attendance data exists
      },
      {
        title: "Active Officers",
        value: stats.activeOfficers.toString(),
        icon: ShieldCheck,
        description: "Across all clubs",
        insight: stats.officerVacancyRate > 0 ? `🚨 ${stats.officerVacancyRate}% clubs missing key officers` : undefined,
        insightColor: "text-red-600",
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

      {/* Admin Intervention Signals */}
      {stats.pendingApprovals > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            You have {stats.pendingApprovals} pending items needing approval (Clubs, Events, or Officers).
          </AlertDescription>
        </Alert>
      )}

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
          title="Weekly New Members"
          description="New club memberships grouped by week"
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
        <EngagementChartCard
          data={engagement}
          loading={loading}
          ghostClubs={stats.ghostClubs}
        />
        <LineChartCard
          title="New Members (Last 7 Days)"
          description="Daily onboarding trend"
          data={newMembersTrend}
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {formTrend.length ? (
          <LineChartCard
            title="Form Submissions"
            description="Responses submitted across admin forms"
            data={formTrend}
            loading={loading}
          />
        ) : (
          <EmptyChartCard title="Form Submissions" description="Forms data not available" />
        )}
      </section>

      <TopClubsTable data={topClubs} loading={loading} />

      <AnalyticsChatbot
        context={{
          stats,
          topClubs,
          engagement
        }}
      />
    </div>
  );
};

export default Analytics;

const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  insight,
  insightColor,
}: {
  title: string;
  value: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  insight?: string;
  insightColor?: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-semibold">{value}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {insight && (
        <p className={`mt-2 text-xs font-medium ${insightColor || "text-muted-foreground"}`}>
          {insight}
        </p>
      )}
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

const EngagementChartCard = ({ data, loading, ghostClubs }: { data: EngagementPoint[]; loading?: boolean; ghostClubs?: number }) => (
  <ChartWrapper
    title="Engagement Summary"
    description={ghostClubs && ghostClubs > 0 ? `Detected ${ghostClubs} ghost clubs (inactive > 30 days)` : "Events + new members + posts (last 7 days)"}
    loading={loading}
  >
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
      <p className="text-sm text-muted-foreground">Ranking by member count & health score</p>
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
              <TableHead>Health Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((club) => (
              <TableRow key={club.id}>
                <TableCell className="font-medium">{club.name}</TableCell>
                <TableCell>{club.memberCount.toLocaleString()}</TableCell>
                <TableCell>{club.category ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${club.healthStatus === "Excellent" ? "text-green-500" :
                      club.healthStatus === "Fair" ? "text-amber-500" : "text-red-500"
                      }`} />
                    <span>{club.healthScore}</span>
                    <Badge variant="outline" className={`text-xs ${club.healthStatus === "Excellent" ? "border-green-200 bg-green-50 text-green-700" :
                      club.healthStatus === "Fair" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"
                      }`}>
                      {club.healthStatus}
                    </Badge>
                  </div>
                </TableCell>
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
