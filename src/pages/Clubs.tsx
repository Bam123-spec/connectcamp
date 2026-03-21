import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { TimePicker } from "@/components/ui/time-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

type ClubRow = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  day: string | null;
  time: string | null;
  cover_image_url: string | null;
  member_count: number | null;
  approved: boolean | null;
  email: string | null;
  org_id: string | null;
  primary_user_id: string | null;
  created_at: string | null;
};

type OfficerRow = {
  id: string;
  club_id: string | null;
  role: string | null;
  email: string | null;
};

type TaskRow = {
  id: string;
  club_id: string | null;
  status: string | null;
  due_date: string | null;
};

type ConversationRow = {
  id: string;
  club_id: string | null;
  last_message_at: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  role: string | null;
};

type EventRow = {
  id: string;
  club_id: string | null;
  date: string | null;
};

type ClubInsight = ClubRow & {
  memberCount: number;
  officerCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  upcomingEventCount: number;
  messagingReady: boolean;
  lastMessageAt: string | null;
  attentionReasons: string[];
  health: "strong" | "watch" | "urgent";
};

type CreateClubForm = {
  name: string;
  description: string;
  time: string;
  location: string;
  email: string;
};

type FilterKey = "all" | "attention" | "officers" | "messaging" | "tasks";

const initialCreateClubState: CreateClubForm = {
  name: "",
  description: "",
  time: "",
  location: "",
  email: "",
};

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All clubs" },
  { key: "attention", label: "Needs attention" },
  { key: "officers", label: "No officers" },
  { key: "messaging", label: "Chat setup needed" },
  { key: "tasks", label: "Open tasks" },
];

function parseStoredDate(day: string | null) {
  if (!day) return undefined;
  const parsed = parse(day, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function formatMeeting(day: string | null, time: string | null) {
  if (!day && !time) return "Meeting schedule not set";
  if (!day) return time ?? "Meeting schedule not set";
  if (!time) return day;
  return `${day} • ${time}`;
}

function getAttentionReasons(club: {
  approved: boolean | null;
  memberCount: number;
  officerCount: number;
  messagingReady: boolean;
  openTaskCount: number;
  overdueTaskCount: number;
}) {
  const reasons: string[] = [];
  if (!club.approved) reasons.push("Prospect awaiting approval");
  if (club.officerCount === 0) reasons.push("No officer coverage");
  if (!club.messagingReady) reasons.push("Chat access not connected");
  if (club.memberCount === 0) reasons.push("No recorded members");
  if (club.overdueTaskCount > 0) reasons.push(`${club.overdueTaskCount} overdue task${club.overdueTaskCount === 1 ? "" : "s"}`);
  else if (club.openTaskCount > 0) reasons.push(`${club.openTaskCount} open task${club.openTaskCount === 1 ? "" : "s"}`);
  return reasons;
}

function getHealth(reasons: string[]) {
  if (reasons.some((reason) => reason.includes("approval") || reason.includes("No officer") || reason.includes("overdue"))) {
    return "urgent" as const;
  }
  if (reasons.length > 0) return "watch" as const;
  return "strong" as const;
}

function summarizeClubInsights(params: {
  clubs: ClubRow[];
  officers: OfficerRow[];
  tasks: TaskRow[];
  conversations: ConversationRow[];
  conversationMembers: ConversationMemberRow[];
  events: EventRow[];
}) {
  const officerMap = new Map<string, OfficerRow[]>();
  params.officers.forEach((officer) => {
    if (!officer.club_id) return;
    officerMap.set(officer.club_id, [...(officerMap.get(officer.club_id) ?? []), officer]);
  });

  const taskMap = new Map<string, TaskRow[]>();
  params.tasks.forEach((task) => {
    if (!task.club_id) return;
    taskMap.set(task.club_id, [...(taskMap.get(task.club_id) ?? []), task]);
  });

  const eventMap = new Map<string, EventRow[]>();
  params.events.forEach((event) => {
    if (!event.club_id) return;
    eventMap.set(event.club_id, [...(eventMap.get(event.club_id) ?? []), event]);
  });

  const conversationByClub = new Map<string, ConversationRow>();
  params.conversations.forEach((conversation) => {
    if (conversation.club_id) conversationByClub.set(conversation.club_id, conversation);
  });

  const clubRoleConversationIds = new Set(
    params.conversationMembers.filter((member) => member.role === "club").map((member) => member.conversation_id),
  );

  return params.clubs
    .map((club) => {
      const officers = officerMap.get(club.id) ?? [];
      const tasks = taskMap.get(club.id) ?? [];
      const upcomingEvents = eventMap.get(club.id) ?? [];
      const conversation = conversationByClub.get(club.id);
      const memberCount = typeof club.member_count === "number" ? club.member_count : 0;
      const openTaskCount = tasks.filter((task) => task.status !== "completed").length;
      const overdueTaskCount = tasks.filter((task) => {
        if (!task.due_date || task.status === "completed") return false;
        return new Date(task.due_date).getTime() < Date.now();
      }).length;
      const messagingReady = conversation ? clubRoleConversationIds.has(conversation.id) : false;
      const attentionReasons = getAttentionReasons({
        approved: club.approved,
        memberCount,
        officerCount: officers.length,
        messagingReady,
        openTaskCount,
        overdueTaskCount,
      });

      return {
        ...club,
        memberCount,
        officerCount: officers.length,
        openTaskCount,
        overdueTaskCount,
        upcomingEventCount: upcomingEvents.length,
        messagingReady,
        lastMessageAt: conversation?.last_message_at ?? null,
        attentionReasons,
        health: getHealth(attentionReasons),
      } satisfies ClubInsight;
    })
    .sort((a, b) => {
      const healthRank = { urgent: 0, watch: 1, strong: 2 };
      const healthDiff = healthRank[a.health] - healthRank[b.health];
      if (healthDiff !== 0) return healthDiff;
      return a.name.localeCompare(b.name);
    });
}

function Clubs() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;

  const [clubs, setClubs] = useState<ClubInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateClubForm>(initialCreateClubState);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubInsight | null>(null);

  const fetchClubs = useCallback(async () => {
    if (!orgId) {
      setError("This admin account is missing an organization context.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data: clubRows, error: clubError } = await supabase
      .from("clubs")
      .select("id, name, description, location, day, time, cover_image_url, member_count, approved, email, org_id, primary_user_id, created_at")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (clubError) {
      setError(clubError.message);
      setLoading(false);
      return;
    }

    const typedClubs = (clubRows ?? []) as ClubRow[];
    if (typedClubs.length === 0) {
      setClubs([]);
      setError(null);
      setLoading(false);
      return;
    }

    const clubIds = typedClubs.map((club) => club.id);

    const [officersResult, tasksResult, conversationsResult, eventsResult] = await Promise.all([
      supabase.from("officers").select("id, club_id, role, email").in("club_id", clubIds),
      supabase.from("club_tasks").select("id, club_id, status, due_date").in("club_id", clubIds),
      supabase.from("admin_conversations").select("id, club_id, last_message_at").eq("org_id", orgId).eq("type", "club").in("club_id", clubIds),
      supabase.from("events").select("id, club_id, date").in("club_id", clubIds).gte("date", today),
    ]);

    if (officersResult.error || tasksResult.error || conversationsResult.error || eventsResult.error) {
      const firstError = officersResult.error ?? tasksResult.error ?? conversationsResult.error ?? eventsResult.error;
      setError(firstError?.message ?? "Could not load club operations data.");
      setLoading(false);
      return;
    }

    const conversations = (conversationsResult.data ?? []) as ConversationRow[];
    const conversationIds = conversations.map((conversation) => conversation.id);
    const membersResult = conversationIds.length > 0
      ? await supabase.from("admin_conversation_members").select("conversation_id, role").in("conversation_id", conversationIds)
      : { data: [], error: null };

    if (membersResult.error) {
      setError(membersResult.error.message);
      setLoading(false);
      return;
    }

    const nextClubs = summarizeClubInsights({
      clubs: typedClubs,
      officers: (officersResult.data ?? []) as OfficerRow[],
      tasks: (tasksResult.data ?? []) as TaskRow[],
      conversations,
      conversationMembers: (membersResult.data ?? []) as ConversationMemberRow[],
      events: (eventsResult.data ?? []) as EventRow[],
    });

    setClubs(nextClubs);
    setError(null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const resetForm = () => {
    setCreateForm(initialCreateClubState);
    setDate(undefined);
    setLogoUrl("");
    setCreateError(null);
    setEditingClub(null);
  };

  const handleEditClub = (club: ClubInsight) => {
    setEditingClub(club);
    setCreateForm({
      name: club.name,
      description: club.description || "",
      time: club.time || "",
      location: club.location || "",
      email: club.email || "",
    });
    setDate(parseStoredDate(club.day));
    setLogoUrl(club.cover_image_url || "");
    setCreateError(null);
    setSheetOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    if (!orgId) {
      setCreateError("This account is missing an organization context.");
      return;
    }

    if (!createForm.name.trim()) {
      setCreateError("Club name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        day: date ? format(date, "yyyy-MM-dd") : null,
        time: createForm.time.trim() || null,
        location: createForm.location.trim() || null,
        cover_image_url: logoUrl || null,
        email: createForm.email.trim() || null,
        approved: true,
      };

      let submitError: { message?: string } | null = null;
      if (editingClub) {
        const { error: updateError } = await supabase
          .from("clubs")
          .update(payload)
          .eq("id", editingClub.id)
          .eq("org_id", orgId);
        submitError = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("clubs")
          .insert([{ ...payload, org_id: orgId, created_at: new Date().toISOString() }]);
        submitError = insertError;
      }

      if (submitError) {
        throw new Error(submitError.message ?? `Unable to ${editingClub ? "update" : "create"} club.`);
      }

      toast({
        title: `Club ${editingClub ? "updated" : "created"}`,
        description: `${payload.name} has been ${editingClub ? "updated" : "added"} to the workspace.`,
      });
      resetForm();
      setSheetOpen(false);
      await fetchClubs();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Unable to ${editingClub ? "update" : "create"} club.`;
      setCreateError(message);
      toast({
        title: `Unable to ${editingClub ? "update" : "create"} club`,
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    const total = clubs.length;
    const approved = clubs.filter((club) => club.approved).length;
    const messagingReady = clubs.filter((club) => club.messagingReady).length;
    const withOfficers = clubs.filter((club) => club.officerCount > 0).length;
    const openTasks = clubs.reduce((sum, club) => sum + club.openTaskCount, 0);
    const needsAttention = clubs.filter((club) => club.health !== "strong").length;
    return { total, approved, messagingReady, withOfficers, openTasks, needsAttention };
  }, [clubs]);

  const filteredClubs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return clubs.filter((club) => {
      const matchesSearch = !query || [club.name, club.description ?? "", club.location ?? "", club.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
      if (!matchesSearch) return false;

      switch (activeFilter) {
        case "attention":
          return club.health !== "strong";
        case "officers":
          return club.officerCount === 0;
        case "messaging":
          return !club.messagingReady;
        case "tasks":
          return club.openTaskCount > 0;
        default:
          return true;
      }
    });
  }, [activeFilter, clubs, searchQuery]);

  const attentionClubs = useMemo(() => clubs.filter((club) => club.health !== "strong").slice(0, 6), [clubs]);
  const messagingGaps = useMemo(() => clubs.filter((club) => !club.messagingReady).slice(0, 6), [clubs]);

  const content = () => {
    if (loading) {
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-[24px]" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
          Unable to load clubs: {error}
        </div>
      );
    }

    if (filteredClubs.length === 0) {
      return (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-4 text-lg font-semibold text-slate-900">No clubs match this view.</p>
          <p className="mt-2 text-sm text-slate-500">Try a different filter or search term, or add a new club to the workspace.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {filteredClubs.map((club) => (
          <ClubOperationalCard key={club.id} club={club} onEdit={() => handleEditClub(club)} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Club workspace</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Manage club records, spot coverage gaps, and jump to the right operational tool without digging through decorative cards.
          </p>
        </div>

        <Sheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) resetForm();
          }}
        >
          <SheetTrigger asChild>
            <Button className="rounded-full px-5">
              <Plus className="h-4 w-4" />
              Add club
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{editingClub ? "Edit club" : "Create a club"}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {editingClub
                  ? "Update the details, coverage state, and contact information for this club."
                  : "Add a new official club into the workspace with proper org-scoped metadata."}
              </p>
            </SheetHeader>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Club name *</label>
                <Input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Outdoor Adventure Society"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Club email</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="club@montgomerycollege.edu"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="What is the club for, and why should Student Life care about it?"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-medium text-foreground">Meeting day</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                      >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Meeting time</label>
                  <TimePicker value={createForm.time} onChange={(value) => setCreateForm((prev) => ({ ...prev, time: value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Room / location</label>
                <Input
                  value={createForm.location}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Student Center, Room 203"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Cover image</label>
                <ImageUpload value={logoUrl} onChange={setLogoUrl} bucket="club-logos" />
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <SheetFooter className="gap-3">
                <Button type="button" variant="outline" onClick={() => { setSheetOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : editingClub ? "Save changes" : "Create club"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CompactKpiCard label="Total clubs" value={summary.total} helper={`${summary.approved} official`} icon={Building2} loading={loading} />
        <CompactKpiCard label="Needs attention" value={summary.needsAttention} helper={`${Math.max(summary.total - summary.needsAttention, 0)} healthy`} icon={AlertTriangle} loading={loading} />
        <CompactKpiCard label="Officer coverage" value={summary.withOfficers} helper={`${Math.max(summary.total - summary.withOfficers, 0)} missing officers`} icon={ShieldCheck} loading={loading} />
        <CompactKpiCard label="Messaging ready" value={summary.messagingReady} helper={`${Math.max(summary.total - summary.messagingReady, 0)} need chat access`} icon={MessageSquare} loading={loading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_320px]">
        <div className="space-y-6">
          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader className="gap-4 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Club list</CardTitle>
                  <CardDescription className="mt-1">A simpler, action-first view of every club in the workspace.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                    <Link to="/officers">Officers</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                    <Link to="/messaging">Messaging</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                    <Link to="/tasks">Tasks</Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search clubs, locations, descriptions, or club emails"
                    className="h-11 rounded-2xl border-slate-200 pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {FILTER_OPTIONS.map((option) => (
                    <Button
                      key={option.key}
                      type="button"
                      variant={activeFilter === option.key ? "default" : "outline"}
                      className={cn(
                        "rounded-full",
                        activeFilter !== option.key && "border-slate-200 bg-white text-slate-700",
                      )}
                      onClick={() => setActiveFilter(option.key)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="border-t border-slate-200 pt-4">{content()}</CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <SideListCard
            title="Watchlist"
            description="The first clubs that need action."
            emptyLabel="No clubs are currently flagged."
            items={attentionClubs.map((club) => ({
              id: club.id,
              label: club.name,
              helper: club.attentionReasons[0] ?? "Operationally healthy",
              tone: club.health,
            }))}
          />

          <SideListCard
            title="Messaging gaps"
            description="Clubs without a club-side participant in the dedicated admin chat."
            emptyLabel="Every club already has club-side messaging access."
            items={messagingGaps.map((club) => ({
              id: club.id,
              label: club.name,
              helper: club.officerCount > 0 ? "Officer exists, but chat access is not connected" : "No officer account to attach yet",
              tone: club.officerCount > 0 ? "watch" : "urgent",
            }))}
            actionHref="/messaging"
            actionLabel="Open Messaging"
          />

        </div>
      </div>
    </div>
  );
}

function CompactKpiCard({
  label,
  value,
  helper,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Building2;
  loading: boolean;
}) {
  return (
    <Card className="rounded-[20px] border-slate-200 shadow-sm">
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            {loading ? <Skeleton className="mt-3 h-8 w-14" /> : <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>}
            <p className="mt-1 text-sm text-slate-500">{helper}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClubOperationalCard({ club, onEdit }: { club: ClubInsight; onEdit: () => void }) {
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 transition-colors hover:border-slate-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {club.cover_image_url ? (
                <img src={club.cover_image_url} alt={club.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <Building2 className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">{club.name}</h3>
                <Badge className={cn("rounded-full border-0", club.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
                  {club.approved ? "Official" : "Prospect"}
                </Badge>
                <StatusBadge tone={club.health} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{club.description || "No club description has been added yet."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {club.attentionReasons.length > 0 ? (
                  club.attentionReasons.slice(0, 3).map((reason) => (
                    <Badge key={reason} variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                      {reason}
                    </Badge>
                  ))
                ) : (
                  <Badge className="rounded-full border-0 bg-emerald-50 text-emerald-700">Operationally healthy</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <InfoPill icon={Users} label="Members" value={String(club.memberCount)} />
            <InfoPill icon={ShieldCheck} label="Officers" value={String(club.officerCount)} />
            <InfoPill icon={MessageSquare} label="Messaging" value={club.messagingReady ? "Ready" : "Setup needed"} />
            <InfoPill icon={CalendarClock} label="Meeting" value={formatMeeting(club.day, club.time)} />
            <InfoPill icon={MapPin} label="Location" value={club.location || "Location not set"} />
            <InfoPill icon={Mail} label="Email" value={club.email || "No email on file"} />
          </div>
        </div>

        <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
          <Button variant="outline" size="sm" className="rounded-full border-slate-200" onClick={onEdit}>Edit</Button>
          <Button asChild variant="outline" size="sm" className="rounded-full border-slate-200 bg-white">
            <Link to={`/clubs/manage?id=${club.id}`}>Manage</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full border-slate-200 bg-white text-slate-700">
            <Link to="/messaging">Chat</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function InfoPill({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function SideListCard({
  title,
  description,
  items,
  emptyLabel,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; label: string; helper: string; tone: ClubInsight["health"] | "watch" }>;
  emptyLabel: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="rounded-[24px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5 text-slate-950">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.helper}</p>
                </div>
                <StatusBadge tone={item.tone} />
              </div>
            </div>
          ))
        )}
        {actionHref && actionLabel ? (
          <Button asChild variant="outline" className="w-full rounded-full border-slate-200 bg-white">
            <Link to={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ tone }: { tone: ClubInsight["health"] | "watch" }) {
  if (tone === "strong") {
    return <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">Healthy</Badge>;
  }
  if (tone === "urgent") {
    return <Badge className="rounded-full border-0 bg-red-100 text-red-700">Action needed</Badge>;
  }
  return <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Watch</Badge>;
}

export default Clubs;
