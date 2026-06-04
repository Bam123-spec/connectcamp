import { useEffect, useMemo, useState } from "react";
import {
  getDashboardStats,
  getClubEngagementTrend,
  getMostActiveDays,
  getRecentEvents,
  getPendingApprovals,
  type DashboardStats,
  type TrendPoint,
  type EventDayStat,
  type DashboardEvent,
  type PendingItem,
} from "@/lib/supabaseDashboardApi";
import { ClubEngagementChart } from "@/components/dashboard/ClubEngagementChart";
import { MostActiveDaysChart } from "@/components/dashboard/MostActiveDaysChart";
import { RecentEventsTable } from "@/components/dashboard/RecentEventsTable";
import { PendingApprovalsCard } from "@/components/dashboard/PendingApprovalsCard";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CalendarPlus,
  FileText,
  Heart,
  Search,
  Users,
} from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";
import { DashboardAI } from "@/components/dashboard/DashboardAI";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

function formatTimeLabel(value: string | null) {
  if (!value) return "Time TBA";
  const [hourRaw, minuteRaw] = value.split(":");
  const hourNumber = Number(hourRaw);
  const minuteNumber = Number(minuteRaw);
  if (Number.isNaN(hourNumber) || Number.isNaN(minuteNumber)) return value;

  const suffix = hourNumber >= 12 ? "PM" : "AM";
  const hour12 = hourNumber % 12 === 0 ? 12 : hourNumber % 12;
  return `${hour12}:${minuteNumber.toString().padStart(2, "0")} ${suffix}`;
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [activeDaysData, setActiveDaysData] = useState<EventDayStat[]>([]);
  const [recentEvents, setRecentEvents] = useState<DashboardEvent[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [statsData, trend, activeDays, events, pending] = await Promise.all([
          getDashboardStats(),
          getClubEngagementTrend(),
          getMostActiveDays(),
          getRecentEvents(),
          getPendingApprovals(),
        ]);

        setStats(statsData);
        setTrendData(trend);
        setActiveDaysData(activeDays);
        setRecentEvents(events);
        setPendingItems(pending);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const greetingName = useMemo(() => {
    const fullName = profile?.full_name?.trim();
    if (!fullName) return "Admin";
    return fullName.split(" ")[0];
  }, [profile?.full_name]);

  const approvalRate = formatPercent(stats?.approvedClubs ?? 0, stats?.activeClubs ?? 0);
  const pendingRate = formatPercent(stats?.pendingEvents ?? 0, stats?.upcomingEvents ?? 0);
  const officerCoverage = formatPercent(stats?.officerAccounts ?? 0, stats?.totalProfiles ?? 0);

  const kpiCards = [
    {
      title: "Active Students",
      value: formatNumber(stats?.totalMembers ?? 0),
      subtitle: "Across all clubs",
      icon: Users,
      trend: "+10%",
      positive: true,
    },
    {
      title: "Events Hosted",
      value: stats?.upcomingEvents ?? 0,
      subtitle: `${stats?.pendingEvents ?? 0} pending approvals`,
      icon: CalendarDays,
      trend: pendingRate > 30 ? `-${pendingRate}%` : `+${Math.max(2, 100 - pendingRate)}%`,
      positive: pendingRate <= 30,
    },
    {
      title: "Active Clubs",
      value: stats?.activeClubs ?? 0,
      subtitle: `${stats?.approvedClubs ?? 0} approved`,
      icon: Building2,
      trend: `+${approvalRate}%`,
      positive: true,
    },
    {
      title: "Approval Rate",
      value: `${approvalRate}%`,
      subtitle: "Club approval health",
      icon: Heart,
      trend: `${officerCoverage >= 50 ? "+" : "-"}${Math.max(2, Math.abs(officerCoverage - 50))}%`,
      positive: officerCoverage >= 50,
    },
  ];

  const upcomingEvents = useMemo(() => {
    const withDate = recentEvents.map((event) => {
      const stamp = event.date ? new Date(`${event.date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
      return { ...event, stamp };
    });

    return withDate.sort((a, b) => a.stamp - b.stamp).slice(0, 4);
  }, [recentEvents]);

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-600">Error Loading Dashboard</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            disabled
            placeholder="Search events, clubs, students..."
            className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-500 outline-none"
          />
        </div>
        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
          Student Life Workspace
        </Badge>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-slate-700 p-6 text-white shadow-sm sm:p-7">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-10 top-8 hidden h-24 w-24 rounded-[36px] bg-amber-400/20 md:block" />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {greetingName}!</h1>
            <p className="max-w-2xl text-sm text-slate-200 sm:text-base">
              Campus engagement is steady. {approvalRate}% of clubs are approved and there are {stats?.pendingEvents ?? 0} event approvals waiting.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
              <Link to="/events/create">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Create Event
              </Link>
            </Button>
            <Button asChild variant="secondary" className="border border-white/20 bg-white/10 text-white hover:bg-white/20">
              <Link to="/analytics">
                <FileText className="mr-2 h-4 w-4" />
                View Reports
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
          : kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        card.positive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      <ArrowUpRight className="mr-1 h-3 w-3" />
                      {card.trend}
                    </span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight text-gray-900">{card.value}</p>
                  <p className="mt-1 text-sm font-medium text-gray-700">{card.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>
                </article>
              );
            })}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ClubEngagementChart data={trendData} loading={loading} />
        </div>

        <aside className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Upcoming Events</h3>
              <p className="text-xs text-gray-500">Next scheduled activities</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-orange-600 hover:bg-orange-50 hover:text-orange-700">
              <Link to="/events">View All</Link>
            </Button>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : upcomingEvents.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                No events scheduled yet.
              </p>
            ) : (
              upcomingEvents.map((event) => {
                const dateObj = event.date ? new Date(`${event.date}T00:00:00`) : null;
                const monthLabel = dateObj
                  ? dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase()
                  : "TBD";
                const dayLabel = dateObj ? String(dateObj.getDate()).padStart(2, "0") : "--";

                return (
                  <article key={event.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-orange-50 text-orange-700">
                      <span className="text-[10px] font-semibold">{monthLabel}</span>
                      <span className="text-base font-bold leading-none">{dayLabel}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{event.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {formatTimeLabel(event.time)} {event.location ? `• ${event.location}` : ""}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <MostActiveDaysChart data={activeDaysData} loading={loading} />
        <PendingApprovalsCard items={pendingItems} loading={loading} />
      </section>

      <section>
        <RecentEventsTable events={recentEvents} loading={loading} />
      </section>

      <DashboardAI
        stats={stats}
        trendData={trendData}
        activeDaysData={activeDaysData}
        recentEvents={recentEvents}
        pendingItems={pendingItems}
      />
    </div>
  );
}
