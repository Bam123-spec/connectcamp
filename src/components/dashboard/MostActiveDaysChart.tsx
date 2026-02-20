import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Cell,
} from "recharts";
import type { EventDayStat } from "@/lib/supabaseDashboardApi";

interface MostActiveDaysChartProps {
    data: EventDayStat[];
    loading?: boolean;
}

export function MostActiveDaysChart({ data, loading }: MostActiveDaysChartProps) {
    if (loading) {
        return <Skeleton className="h-[400px] w-full rounded-xl" />;
    }

    return (
        <SectionCard
            title="Most Active Days"
            subtitle="Event distribution by day"
            className="h-full"
        >
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e5e7eb"
                            strokeOpacity={0.5}
                        />
                        <XAxis
                            dataKey="label"
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
                        />
                        <Tooltip
                            cursor={{ fill: "#f3f4f6", opacity: 0.5 }}
                            contentStyle={{
                                backgroundColor: "rgba(255, 255, 255, 0.9)",
                                borderRadius: "12px",
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                backdropFilter: "blur(4px)",
                            }}
                            itemStyle={{ color: "#111827", fontSize: "12px", fontWeight: 600 }}
                            labelStyle={{ display: "none" }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                            {data.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={index === 0 ? "#3b82f6" : "#cbd5e1"}
                                    className="transition-all duration-300 hover:opacity-80"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </SectionCard>
    );
}
