import { useEffect, useState } from "react";
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
import { StatCard } from "@/components/dashboard/StatCard";
import { ClubEngagementChart } from "@/components/dashboard/ClubEngagementChart";
import { MostActiveDaysChart } from "@/components/dashboard/MostActiveDaysChart";
import { RecentEventsTable } from "@/components/dashboard/RecentEventsTable";
import { PendingApprovalsCard } from "@/components/dashboard/PendingApprovalsCard";
import { Building2, CalendarDays, Users, ShieldCheck } from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";
import { DashboardAI } from "@/components/dashboard/DashboardAI";

export default function Dashboard() {
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
        const [
          statsData,
          trend,
          activeDays,
          events,
          pending
        ] = await Promise.all([
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
    <div className="space-y-8 p-6 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Overview of Connect Camp's performance and activity.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Clubs"
          value={stats?.activeClubs ?? 0}
          subtitle={`${stats?.approvedClubs ?? 0} approved`}
          icon={Building2}
          loading={loading}
        />
        <StatCard
          title="Total Members"
          value={formatNumber(stats?.totalMembers ?? 0)}
          subtitle="Across all clubs"
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Upcoming Events"
          value={stats?.upcomingEvents ?? 0}
          subtitle={`${stats?.pendingEvents ?? 0} pending approval`}
          icon={CalendarDays}
          loading={loading}
        />
        <StatCard
          title="Officer Accounts"
          value={stats?.officerAccounts ?? 0}
          subtitle={`${stats?.totalProfiles ?? 0} total profiles`}
          icon={ShieldCheck}
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ClubEngagementChart data={trendData} loading={loading} />
        <MostActiveDaysChart data={activeDaysData} loading={loading} />
      </div>

      {/* Tables Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RecentEventsTable events={recentEvents} loading={loading} />
        <PendingApprovalsCard items={pendingItems} loading={loading} />
      </div>

      {/* AI Assistant */}
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
