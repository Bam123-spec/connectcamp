import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type { PendingItem } from "@/lib/supabaseDashboardApi";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PendingApprovalsCardProps {
    items: PendingItem[];
    loading?: boolean;
}

export function PendingApprovalsCard({ items, loading }: PendingApprovalsCardProps) {
    if (loading) {
        return <Skeleton className="h-[400px] w-full rounded-xl" />;
    }

    return (
        <SectionCard
            title="Pending Approvals"
            subtitle="Items requiring attention"
            className="h-full"
        >
            {items.length === 0 ? (
                <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-medium text-gray-900">All caught up!</p>
                        <p className="text-sm text-gray-500">No pending items to review.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="group flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-all hover:bg-white hover:shadow-sm hover:border-gray-200"
                        >
                            <div className="min-w-0 space-y-1">
                                <p className="font-semibold text-gray-900 truncate text-sm">{item.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>{item.owner}</span>
                                    <span className="text-gray-300">•</span>
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-white border-gray-200">
                                        {item.type}
                                    </Badge>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" className="ml-3 h-8 text-xs shrink-0 border-gray-200 hover:bg-gray-50 hover:text-gray-900" asChild>
                                <Link to="/approvals">Review</Link>
                            </Button>
                        </div>
                    ))}
                    <Button variant="ghost" className="w-full text-xs text-gray-500 hover:text-gray-900" asChild>
                        <Link to="/approvals" className="flex items-center justify-center gap-1">
                            View All Pending <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            )}
        </SectionCard>
    );
}
