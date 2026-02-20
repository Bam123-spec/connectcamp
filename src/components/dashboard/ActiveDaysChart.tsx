import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/line-charts-6";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import type { EventDayStat } from "@/lib/supabaseDashboardApi";

const chartConfig: ChartConfig = {
    events: {
        label: "Events",
        color: "hsl(var(--primary))",
    },
};

interface ActiveDaysChartProps {
    data: EventDayStat[];
    loading?: boolean;
}

export function ActiveDaysChart({ data, loading }: ActiveDaysChartProps) {
    if (loading) {
        return <Skeleton className="h-[400px] w-full rounded-xl" />;
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Most Active Days</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Events distribution by day of week.
                </p>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            />
                            <ChartTooltip
                                cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {data.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary)/0.3)"}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
