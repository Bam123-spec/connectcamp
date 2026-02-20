import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/supabaseDashboardApi";
import { formatNumber } from "@/lib/formatNumber";

interface ClubEngagementChartProps {
    data: TrendPoint[];
    loading?: boolean;
}

export function ClubEngagementChart({ data, loading }: ClubEngagementChartProps) {
    if (loading) {
        return <Skeleton className="h-[400px] w-full rounded-xl" />;
    }

    return (
        <SectionCard
            title="Club Engagement"
            subtitle="Growth in members and clubs over time"
            className="col-span-2 h-full"
        >
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorClubs" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e5e7eb"
                            strokeOpacity={0.5}
                        />
                        <XAxis
                            dataKey="dateLabel"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tick={{ fill: "#6b7280", fontSize: 12 }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tick={{ fill: "#6b7280", fontSize: 12 }}
                            tickFormatter={(value) => formatNumber(value)}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "rgba(255, 255, 255, 0.9)",
                                borderRadius: "12px",
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                backdropFilter: "blur(4px)",
                            }}
                            itemStyle={{ fontSize: "12px", fontWeight: 500 }}
                            labelStyle={{
                                fontSize: "12px",
                                color: "#6b7280",
                                marginBottom: "4px",
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="members"
                            name="Total Members"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorMembers)"
                        />
                        <Area
                            type="monotone"
                            dataKey="clubs"
                            name="Active Clubs"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorClubs)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </SectionCard>
    );
}
