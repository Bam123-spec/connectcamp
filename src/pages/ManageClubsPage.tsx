import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Search,
    MoreVertical,
    Users,
    Calendar,
    User,
    ArrowUpRight,
    Clock,
    MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

type Club = {
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
    member_count: number | null;
    created_at: string;
    approved: boolean | null;
    location: string | null;
    day: string | null;
    time: string | null;
};

type Event = {
    id: string;
    title: string;
    date: string;
    location: string | null;
    description: string | null;
};

export default function ManageClubsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialClubId = searchParams.get("id");

    const [clubs, setClubs] = useState<Club[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedClubId, setSelectedClubId] = useState<string | null>(initialClubId);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("All");

    const fetchClubs = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("clubs")
            .select("*")
            .order("name");

        if (!error && data) {
            setClubs(data);
            if (!selectedClubId && data.length > 0) {
                setSelectedClubId(data[0].id);
            }
        }
        setLoading(false);
    }, [selectedClubId]);

    const fetchEvents = useCallback(async (clubId: string) => {
        const { data, error } = await supabase
            .from("events")
            .select("*")
            .eq("club_id", clubId)
            .gte("date", new Date().toISOString()) // Only future events
            .order("date", { ascending: true });

        if (!error && data) {
            setEvents(data);
        } else {
            setEvents([]);
        }
    }, []);

    useEffect(() => {
        fetchClubs();
    }, [fetchClubs]);

    useEffect(() => {
        if (selectedClubId) {
            fetchEvents(selectedClubId);
            // Update URL without reloading
            setSearchParams({ id: selectedClubId });
        }
    }, [selectedClubId, fetchEvents, setSearchParams]);

    const selectedClub = clubs.find(c => c.id === selectedClubId) || clubs[0];

    const filteredClubs = clubs.filter(club =>
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (activeTab === "All" ||
            (activeTab === "Active" && club.approved) ||
            (activeTab === "Pending" && !club.approved))
    );

    if (loading && clubs.length === 0) {
        return <div className="p-8">Loading...</div>;
    }

    if (!selectedClub) {
        return <div className="p-8">No clubs found.</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50/50 p-8 font-sans text-slate-900">
            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Manage Clubs</h1>
                    <p className="text-lg text-slate-500">Overview and management of all student organizations.</p>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

                    {/* Left Column: Featured Club (8 cols) */}
                    <div className="lg:col-span-8">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">

                            {/* Cover Image */}
                            <div className="relative h-64 w-full bg-slate-100">
                                {selectedClub.cover_image_url ? (
                                    <img
                                        src={selectedClub.cover_image_url}
                                        alt={selectedClub.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400">
                                        No Cover Image
                                    </div>
                                )}
                                <div className="absolute right-4 top-4">
                                    <Badge className={cn(
                                        "rounded-full px-3 py-1 text-sm font-medium backdrop-blur-md",
                                        selectedClub.approved
                                            ? "bg-emerald-500/90 text-white hover:bg-emerald-600"
                                            : "bg-amber-500/90 text-white hover:bg-amber-600"
                                    )}>
                                        {selectedClub.approved ? "Active" : "Pending"}
                                    </Badge>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="space-y-8 p-8">

                                {/* Header Info */}
                                <div className="flex items-start justify-between">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <h2 className="text-3xl font-bold text-slate-900">{selectedClub.name}</h2>
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <MapPin className="h-4 w-4" />
                                                <span>{selectedClub.location || "No location set"}</span>
                                                <span className="mx-2">•</span>
                                                <Clock className="h-4 w-4" />
                                                <span>{selectedClub.day || "TBD"} at {selectedClub.time || "TBD"}</span>
                                            </div>
                                        </div>
                                        <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
                                            {selectedClub.description || "No description provided."}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    <MetricCard
                                        icon={Users}
                                        label="Total Members"
                                        value={selectedClub.member_count || 0}
                                        trend="Active members"
                                    />
                                    <MetricCard
                                        icon={Calendar}
                                        label="Upcoming Events"
                                        value={events.length}
                                        trend="Planned events"
                                    />
                                    <MetricCard
                                        icon={User}
                                        label="Status"
                                        value={selectedClub.approved ? "Approved" : "Pending"}
                                        trend="Club status"
                                    />
                                </div>

                                {/* Events Section */}
                                <div className="space-y-4">
                                    <h3 className="text-xl font-semibold text-slate-900">Upcoming Events</h3>
                                    {events.length > 0 ? (
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            {events.map(event => (
                                                <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                    <p className="font-semibold text-slate-900">{event.title}</p>
                                                    <p className="text-sm text-slate-500">{format(new Date(event.date), "PPP p")}</p>
                                                    <p className="text-sm text-slate-500">{event.location}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-slate-500">No upcoming events scheduled.</p>
                                    )}
                                </div>

                                {/* Footer Actions */}
                                <div className="flex items-center justify-between border-t border-slate-100 pt-8">
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Clock className="h-4 w-4" />
                                        <span>Created {format(new Date(selectedClub.created_at), "PPP")}</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                                            View as student
                                            <ArrowUpRight className="ml-2 h-4 w-4" />
                                        </Button>
                                        <Button className="rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                                            Edit club details
                                        </Button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Right Column: List (4 cols) */}
                    <div className="space-y-6 lg:col-span-4">

                        {/* Tabs & Search */}
                        <div className="space-y-4">
                            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                                {["All", "Active", "Pending"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                                            activeTab === tab
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder="Search clubs..."
                                    className="rounded-xl border-slate-200 bg-white pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-200"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="space-y-3 h-[600px] overflow-y-auto pr-2">
                            {filteredClubs.map((club) => (
                                <div
                                    key={club.id}
                                    onClick={() => setSelectedClubId(club.id)}
                                    className={cn(
                                        "group cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md",
                                        selectedClubId === club.id
                                            ? "border-slate-300 bg-white ring-1 ring-slate-300"
                                            : "border-transparent bg-white hover:border-slate-200"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        {club.cover_image_url ? (
                                            <img
                                                src={club.cover_image_url}
                                                alt={club.name}
                                                className="h-12 w-12 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="h-12 w-12 rounded-lg bg-slate-200" />
                                        )}
                                        <div className="flex-1 overflow-hidden">
                                            <h3 className={cn(
                                                "truncate font-semibold",
                                                selectedClubId === club.id ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                                            )}>
                                                {club.name}
                                            </h3>
                                            <p className="truncate text-sm text-slate-500">
                                                {club.member_count || 0} members
                                            </p>
                                        </div>
                                        {selectedClubId === club.id && (
                                            <div className="h-2 w-2 rounded-full bg-slate-900" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, trend }: { icon: any, label: string, value: string | number, trend: string }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100">
                    <Icon className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-lg font-bold text-slate-900">{value}</p>
                    </div>
                    <p className="text-xs text-slate-400">{trend}</p>
                </div>
            </div>
        </div>
    );
}
