import { useMemo } from "react";
import { CalendarRange, Clock3, Sparkles, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type { EventDayStat } from "@/lib/supabaseDashboardApi";
import { cn } from "@/lib/utils";

interface MostActiveDaysChartProps {
  data: EventDayStat[];
  loading?: boolean;
}

const DAY_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function MostActiveDaysChart({ data, loading }: MostActiveDaysChartProps) {
  const summary = useMemo(() => {
    const normalized = DAY_ORDER.map((day) => ({
      label: day,
      value: data.find((item) => item.label === day)?.value ?? 0,
    }));

    const total = normalized.reduce((sum, item) => sum + item.value, 0);
    const ranked = normalized
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value || DAY_ORDER.indexOf(left.label) - DAY_ORDER.indexOf(right.label));

    const topDay = ranked[0] ?? null;
    const secondDay = ranked[1] ?? null;
    const highestValue = topDay?.value ?? 0;
    const activeDays = ranked.length;
    const weekendTotal = normalized
      .filter((item) => item.label === "Saturday" || item.label === "Sunday")
      .reduce((sum, item) => sum + item.value, 0);
    const weekendShare = total > 0 ? Math.round((weekendTotal / total) * 100) : 0;
    const topDayShare = total > 0 && topDay ? Math.round((topDay.value / total) * 100) : 0;

    let planningNote = "No scheduled events yet. Once events are added, this card will show where the week is clustering.";
    if (topDay && secondDay) {
      planningNote = `${topDay.label} leads the calendar, with ${secondDay.label} close behind. Keep staffing, approvals, and support coverage strongest around those windows.`;
    } else if (topDay) {
      planningNote = `${topDay.label} currently carries the schedule. If more events are added, watch whether activity starts spreading across the week.`;
    }

    return {
      normalized,
      ranked,
      total,
      topDay,
      secondDay,
      highestValue,
      activeDays,
      weekendShare,
      topDayShare,
      planningNote,
    };
  }, [data]);

  if (loading) {
    return <Skeleton className="h-[420px] w-full rounded-xl" />;
  }

  return (
    <SectionCard
      title="Most Active Days"
      subtitle="Weekly event rhythm with planning cues"
      className="h-full"
      action={
        summary.topDay ? (
          <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Peak: {summary.topDay.label}
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <InsightTile
            icon={TrendingUp}
            label="Peak day"
            value={summary.topDay?.label ?? "None yet"}
            helper={summary.topDay ? `${summary.topDayShare}% of scheduled events` : "Waiting on event data"}
            tone="blue"
          />
          <InsightTile
            icon={CalendarRange}
            label="Active days"
            value={`${summary.activeDays}/7`}
            helper={summary.total > 0 ? `${summary.total} scheduled event${summary.total === 1 ? "" : "s"}` : "No events scheduled"}
            tone="slate"
          />
          <InsightTile
            icon={Clock3}
            label="Weekend share"
            value={`${summary.weekendShare}%`}
            helper={summary.weekendShare > 0 ? "Saturday and Sunday activity" : "No weekend-heavy pattern"}
            tone="violet"
          />
        </div>

        {summary.ranked.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-900">No event pattern yet</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              As events are scheduled, this panel will show which days are carrying the heaviest load.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.ranked.map((item, index) => {
              const share = summary.total > 0 ? Math.round((item.value / summary.total) * 100) : 0;
              const width = summary.highestValue > 0 ? Math.max((item.value / summary.highestValue) * 100, 10) : 0;
              const isLead = index === 0;

              return (
                <div key={item.label} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
                          isLead ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {DAY_SHORT[item.label]} schedule load · {share}% of all events
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tracking-tight text-slate-950">{item.value}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">events</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isLead
                          ? "bg-[linear-gradient(90deg,#2563eb_0%,#60a5fa_100%)]"
                          : "bg-[linear-gradient(90deg,#cbd5e1_0%,#94a3b8_100%)]",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#5865f2] shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Planning note</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{summary.planningNote}</p>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function InsightTile({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "slate" | "violet";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "violet"
        ? "bg-violet-50 text-violet-700"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-2xl", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}
