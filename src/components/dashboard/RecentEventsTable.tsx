import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type { DashboardEvent } from "@/lib/supabaseDashboardApi";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/formatDate";

interface RecentEventsTableProps {
    events: DashboardEvent[];
    loading?: boolean;
}

export function RecentEventsTable({ events, loading }: RecentEventsTableProps) {
    if (loading) {
        return <Skeleton className="h-[400px] w-full rounded-xl" />;
    }

    return (
        <SectionCard
            title="Recent Events"
            subtitle="Latest submissions across all clubs"
            className="col-span-2 h-full"
            action={
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" asChild>
                    <Link to="/events" className="gap-1">
                        View All <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            }
        >
            <div className="-mx-6 -my-2 overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-gray-100">
                            <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-gray-500">Event Name</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-500">Location</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                                    No recent events found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            events.map((event) => (
                                <TableRow
                                    key={event.id}
                                    className="border-gray-100 transition-colors hover:bg-gray-50/80 group cursor-pointer"
                                >
                                    <TableCell className="pl-6 font-medium text-gray-900">
                                        <div className="flex flex-col">
                                            <span className="truncate max-w-[200px] text-sm font-semibold">{event.name}</span>
                                            {event.description && (
                                                <span className="truncate max-w-[200px] text-xs text-gray-500 mt-0.5">
                                                    {event.description}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                            {formatDate(event.date)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                            <span className="truncate max-w-[140px]">{event.location || "TBD"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                event.approved
                                                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-50"
                                                    : "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-50"
                                            }
                                        >
                                            {event.approved ? "Approved" : "Pending"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </SectionCard>
    );
}
