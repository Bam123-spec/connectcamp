import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    loading?: boolean;
    className?: string;
}

export function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    loading,
    className,
}: StatCardProps) {
    if (loading) {
        return <Skeleton className="h-32 w-full rounded-xl" />;
    }

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
                className
            )}
        >
            <div className="flex items-start justify-between">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <h4 className="text-3xl font-bold text-gray-900 tracking-tight">
                            {value}
                        </h4>
                    </div>
                    {subtitle && (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                +2.5%
                            </span>
                            <p className="text-xs text-gray-400">{subtitle}</p>
                        </div>
                    )}
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
}
