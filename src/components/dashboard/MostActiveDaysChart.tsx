import { useMemo } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EventDayStat } from "@/lib/supabaseDashboardApi";

interface MostActiveDaysChartProps {
  data: EventDayStat[];
  loading?: boolean;
}

export function MostActiveDaysChart({ data, loading }: MostActiveDaysChartProps) {
  const summary = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const lead = data[0] ?? null;
    const second = data[1] ?? null;
    const leadShare = lead && total > 0 ? Math.round((lead.value / total) * 100) : 0;

    let note = "No event activity has been scheduled yet.";
    if (lead && second) {
      note = `${lead.label} is currently the busiest day, with ${second.label} close behind. That is where staffing and approvals are most likely to bunch up.`;
    } else if (lead) {
      note = `${lead.label} is currently carrying the schedule load.`;
    }

    return { total, lead, second, leadShare, note };
  }, [data]);

  if (loading) {
    return <Skeleton className="h-[400px] w-full rounded-xl" />;
  }

  return (
    <SectionCard
      title="Most Active Days"
      subtitle="Event distribution by day"
      className="h-full"
      action={
        summary.lead ? (
          <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {summary.lead.label} leads
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Top day
              </p>
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <CalendarClock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              {summary.lead?.label ?? "No data yet"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {summary.lead ? `${summary.lead.value} events · ${summary.leadShare}% of visible activity` : "Schedule events to reveal activity patterns."}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Weekly load
              </p>
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              {summary.total}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Total events represented across the busiest days in the current view.
            </p>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-900">No event pattern yet</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              As events are scheduled, this chart will show which weekdays carry the most activity.
            </p>
          </div>
        ) : (
          <div className="h-[280px] w-full rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 18, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                  strokeOpacity={0.8}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#eff6ff", opacity: 0.9 }}
                  contentStyle={{
                    backgroundColor: "rgba(255,255,255,0.96)",
                    borderRadius: "14px",
                    border: "1px solid #dbeafe",
                    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
                  }}
                  formatter={(value: number) => [`${value} events`, "Scheduled"]}
                  labelFormatter={(label: string) => label}
                  itemStyle={{ color: "#0f172a", fontSize: "12px", fontWeight: 600 }}
                  labelStyle={{ color: "#475569", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={46}>
                  <LabelList dataKey="value" position="top" fill="#64748b" fontSize={12} />
                  {data.map((item, index) => (
                    <Cell
                      key={item.label}
                      fill={index === 0 ? "#3b82f6" : index === 1 ? "#7dd3fc" : "#cbd5e1"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Helpful read
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary.note}</p>
        </div>
      </div>
    </SectionCard>
  );
}
