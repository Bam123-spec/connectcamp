import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/line-charts-6";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { TrendPoint } from "@/lib/supabaseDashboardApi";

const chartConfig: ChartConfig = {
    members: {
        label: "Members",
        color: "hsl(var(--primary))",
    },
    clubs: {
        label: "Clubs",
        color: "hsl(var(--chart-2))",
    },
};

interface ClubTrendChartProps {
    data: TrendPoint[];
    loading?: boolean;
}

export function ClubTrendChart({ data, loading }: ClubTrendChartProps) {
    if (loading) {
        return <Skeleton className="h-[400px] w-full rounded-xl" />;
    }

    return (
        <Card className="col-span-2 h-full">
            <CardHeader>
                <CardTitle>Club Engagement Trend</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Growth in members and clubs over time.
                </p>
            </CardHeader>
            <CardContent className="pl-0">
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="dateLabel"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                minTickGap={30}
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            />
                            <ChartTooltip
                                content={<ChartTooltipContent indicator="line" />}
                                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
                            />
                            <Line
                                type="monotone"
                                dataKey="members"
                                stroke="var(--color-members)"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="clubs"
                                stroke="var(--color-clubs)"
                                strokeWidth={3}
                                dot={false}
                                strokeDasharray="4 4"
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
