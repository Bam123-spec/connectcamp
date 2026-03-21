import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

type OfficerRole = "president" | "vice_president" | "treasurer" | "secretary";

type OfficerRow = {
  id: string;
  userId: string | null;
  clubId: string | null;
  role: OfficerRole | null;
  createdAt: string | null;
  email: string | null;
  name: string;
  profileEmail: string | null;
  avatarUrl: string | null;
  clubName: string;
  inAdminChat: boolean;
};

type ClubCoverage = {
  id: string;
  name: string;
  officerCount: number;
  roles: OfficerRole[];
  hasPresident: boolean;
  hasMessagingAccess: boolean;
};

type OfficerPerson = {
  key: string;
  userId: string | null;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  assignments: OfficerRow[];
};

const ROLE_OPTIONS: Array<{ value: OfficerRole; label: string }> = [
  { value: "president", label: "President" },
  { value: "vice_president", label: "Vice President" },
  { value: "treasurer", label: "Treasurer" },
  { value: "secretary", label: "Secretary" },
];

const PERSON_FILTERS = [
  { value: "all", label: "All officers" },
  { value: "needs_chat", label: "Needs chat access" },
  { value: "multi_club", label: "Multi-club" },
] as const;

type PersonFilter = (typeof PERSON_FILTERS)[number]["value"];

type NestedOfficerRow = {
  id: string;
  role: OfficerRole | null;
  user_id: string | null;
  club_id: string | null;
  email: string | null;
  created_at: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  clubs?: {
    id?: string | null;
    name?: string | null;
    approved?: boolean | null;
  } | null;
};

const formatRoleLabel = (role: OfficerRole | null) => {
  if (!role) return "Unassigned";
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
};

function Officers() {
  const { toast } = useToast();
  const [officers, setOfficers] = useState<OfficerRow[]>([]);
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [personFilter, setPersonFilter] = useState<PersonFilter>("all");
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [linkingChatId, setLinkingChatId] = useState<string | null>(null);
  const [syncingAllChats, setSyncingAllChats] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [officersResult, clubsResult, conversationsResult, membersResult] = await Promise.all([
        supabase
          .from("officers")
          .select("id,role,user_id,club_id,email,created_at,profiles(full_name,email,avatar_url),clubs(id,name,approved)")
          .order("created_at", { ascending: false }),
        supabase.from("clubs").select("id,name").order("name", { ascending: true }),
        supabase.from("admin_conversations").select("id,club_id").eq("type", "club"),
        supabase.from("admin_conversation_members").select("conversation_id,user_id,role,club_id"),
      ]);

      if (officersResult.error) throw officersResult.error;
      if (clubsResult.error) throw clubsResult.error;
      if (conversationsResult.error) throw conversationsResult.error;
      if (membersResult.error) throw membersResult.error;

      const clubConversationIds = new Map<string, string>();
      ((conversationsResult.data ?? []) as Array<{ id: string; club_id: string | null }>).forEach((row) => {
        if (row.club_id) clubConversationIds.set(row.club_id, row.id);
      });

      const memberKeys = new Set(
        ((membersResult.data ?? []) as Array<{ conversation_id: string; user_id: string | null; role: string | null }>)
          .filter((row) => row.user_id && row.role === "club")
          .map((row) => `${row.conversation_id}:${row.user_id}`),
      );

      const mapped = ((officersResult.data ?? []) as NestedOfficerRow[]).map((row) => {
        const conversationId = row.club_id ? clubConversationIds.get(row.club_id) : null;
        const inAdminChat = Boolean(conversationId && row.user_id && memberKeys.has(`${conversationId}:${row.user_id}`));

        return {
          id: row.id,
          userId: row.user_id,
          clubId: row.club_id,
          role: row.role,
          createdAt: row.created_at,
          email: row.email ?? row.profiles?.email ?? null,
          name: row.profiles?.full_name ?? row.profiles?.email ?? row.email ?? "Unknown officer",
          profileEmail: row.profiles?.email ?? null,
          avatarUrl: row.profiles?.avatar_url ?? null,
          clubName: row.clubs?.name ?? "Unassigned club",
          inAdminChat,
        } satisfies OfficerRow;
      });

      setOfficers(mapped);
      setClubs((clubsResult.data ?? []) as Array<{ id: string; name: string }>);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load officers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedPeople = useMemo<OfficerPerson[]>(() => {
    const map = new Map<string, OfficerPerson>();

    officers.forEach((officer) => {
      const key = officer.userId ?? officer.email ?? officer.id;
      const existing = map.get(key);
      if (existing) {
        existing.assignments.push(officer);
        return;
      }

      map.set(key, {
        key,
        userId: officer.userId,
        name: officer.name,
        email: officer.profileEmail ?? officer.email,
        avatarUrl: officer.avatarUrl,
        assignments: [officer],
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [officers]);

  const coverage = useMemo<ClubCoverage[]>(() => {
    const officerMap = new Map<string, OfficerRow[]>();
    officers.forEach((officer) => {
      if (!officer.clubId) return;
      const existing = officerMap.get(officer.clubId) ?? [];
      existing.push(officer);
      officerMap.set(officer.clubId, existing);
    });

    return clubs.map((club) => {
      const assignments = officerMap.get(club.id) ?? [];
      const roles = Array.from(new Set(assignments.map((row) => row.role).filter(Boolean))) as OfficerRole[];
      return {
        id: club.id,
        name: club.name,
        officerCount: assignments.length,
        roles,
        hasPresident: roles.includes("president"),
        hasMessagingAccess: assignments.some((row) => row.inAdminChat),
      };
    });
  }, [clubs, officers]);

  const coverageRisks = useMemo(
    () => coverage.filter((club) => club.officerCount === 0 || !club.hasPresident || !club.hasMessagingAccess),
    [coverage],
  );

  const multiClubPeople = useMemo(
    () => groupedPeople.filter((person) => person.assignments.length > 1),
    [groupedPeople],
  );

  const stats = useMemo(() => {
    const officerInChat = officers.filter((officer) => officer.inAdminChat).length;
    const clubsWithOfficers = coverage.filter((club) => club.officerCount > 0).length;
    const clubsMissingOfficers = coverage.filter((club) => club.officerCount === 0).length;
    return {
      officerRecords: officers.length,
      distinctPeople: groupedPeople.length,
      clubsWithOfficers,
      clubsMissingOfficers,
      officersInChat: officerInChat,
      clubsWithMessagingCoverage: coverage.filter((club) => club.hasMessagingAccess).length,
    };
  }, [coverage, groupedPeople.length, officers]);

  const filteredPeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groupedPeople.filter((person) => {
      const matchesSearch =
        !term ||
        [
          person.name,
          person.email ?? "",
          ...person.assignments.map((assignment) => assignment.clubName),
          ...person.assignments.map((assignment) => formatRoleLabel(assignment.role)),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesFilter =
        personFilter === "all" ||
        (personFilter === "needs_chat" && person.assignments.some((assignment) => !assignment.inAdminChat)) ||
        (personFilter === "multi_club" && person.assignments.length > 1);

      return matchesSearch && matchesFilter;
    });
  }, [groupedPeople, personFilter, search]);

  const handleRemove = async (officer: OfficerRow) => {
    const confirmed = window.confirm(`Remove ${officer.name} from ${officer.clubName}?`);
    if (!confirmed) return;

    setRemovingId(officer.id);
    try {
      const { error: deleteError } = await supabase.from("officers").delete().eq("id", officer.id);
      if (deleteError) throw deleteError;

      setOfficers((prev) => prev.filter((row) => row.id !== officer.id));
      toast({
        title: "Officer removed",
        description: `${officer.name} is no longer listed as an officer for ${officer.clubName}.`,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to remove officer.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (officer: OfficerRow, nextRole: OfficerRole) => {
    if (officer.role === nextRole) return;

    setSavingRoleId(officer.id);
    try {
      const { error: updateError } = await supabase.from("officers").update({ role: nextRole }).eq("id", officer.id);
      if (updateError) throw updateError;

      setOfficers((prev) => prev.map((row) => (row.id === officer.id ? { ...row, role: nextRole } : row)));
      toast({
        title: "Officer updated",
        description: `${officer.name} is now ${formatRoleLabel(nextRole)} for ${officer.clubName}.`,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update officer role.");
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleLinkOfficerToChat = async (officer: OfficerRow) => {
    if (!officer.clubId || !officer.userId) return;

    setLinkingChatId(officer.id);
    try {
      const conversationResult = await supabase.rpc("ensure_admin_club_conversation", {
        target_club_id: officer.clubId,
      });
      if (conversationResult.error) throw conversationResult.error;

      const addMemberResult = await supabase.rpc("add_admin_conversation_member", {
        target_conversation_id: conversationResult.data,
        target_user_id: officer.userId,
      });
      if (addMemberResult.error) throw addMemberResult.error;

      setOfficers((prev) => prev.map((row) => (row.id === officer.id ? { ...row, inAdminChat: true } : row)));
      toast({
        title: "Officer connected to chat",
        description: `${officer.name} can now access the club admin thread for ${officer.clubName}.`,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to connect officer to messaging.");
    } finally {
      setLinkingChatId(null);
    }
  };

  const handleSyncAllOfficerChats = async () => {
    const pending = officers.filter((officer) => !officer.inAdminChat && officer.clubId && officer.userId);
    if (pending.length === 0) {
      toast({ title: "Messaging already aligned", description: "Every officer with a linked account already has chat access." });
      return;
    }

    setSyncingAllChats(true);
    let connected = 0;

    try {
      for (const officer of pending) {
        const conversationResult = await supabase.rpc("ensure_admin_club_conversation", {
          target_club_id: officer.clubId,
        });
        if (conversationResult.error) throw conversationResult.error;

        const addMemberResult = await supabase.rpc("add_admin_conversation_member", {
          target_conversation_id: conversationResult.data,
          target_user_id: officer.userId,
        });
        if (addMemberResult.error) throw addMemberResult.error;
        connected += 1;
      }

      setOfficers((prev) => prev.map((row) => (pending.some((officer) => officer.id === row.id) ? { ...row, inAdminChat: true } : row)));
      toast({
        title: "Officer chat access synced",
        description: `${connected} officer ${connected === 1 ? "account was" : "accounts were"} added to their club admin threads.`,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to sync officer messaging.");
    } finally {
      setSyncingAllChats(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_45%,#eff6ff_100%)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Officer Operations</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Leadership coverage, messaging access, and staffing quality in one view.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The old roster only listed names. This view surfaces staffing gaps, duplicate assignments, and whether each club leader is actually connected to the admin messaging path.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
              <Link to="/users">
                Open User Management
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link to="/members/add">
                <UserPlus className="h-4 w-4" />
                Add Officer
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Officer records", value: stats.officerRecords, helper: `${stats.distinctPeople} distinct people`, icon: Users },
            { label: "Clubs covered", value: stats.clubsWithOfficers, helper: `${stats.clubsMissingOfficers} clubs still unstaffed`, icon: Building2 },
            { label: "Messaging ready", value: stats.officersInChat, helper: `${stats.officerRecords - stats.officersInChat} officer records still missing chat access`, icon: MessageSquare },
            { label: "Clubs in chat", value: stats.clubsWithMessagingCoverage, helper: `${clubs.length - stats.clubsWithMessagingCoverage} clubs still not reachable`, icon: ShieldCheck },
            { label: "Shared officers", value: multiClubPeople.length, helper: multiClubPeople.length > 0 ? "People assigned to more than one club" : "No multi-club load issues", icon: AlertTriangle },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-slate-500">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">{stat.label}</p>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
                <p className="mt-2 text-sm text-slate-500">{stat.helper}</p>
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_380px]">
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="space-y-4 border-b border-slate-200 pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-2xl tracking-tight">Officer roster</CardTitle>
                <CardDescription className="mt-1">
                  Search by officer, club, or role. Update leadership assignments directly and connect officers to admin chat when they are not yet reachable.
                </CardDescription>
              </div>
              <Button variant="outline" className="rounded-full" onClick={handleSyncAllOfficerChats} disabled={syncingAllChats || loading}>
                {syncingAllChats ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Sync officer chat access
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search officers, clubs, or roles..."
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-10"
                />
              </div>
              <Select value={personFilter} onValueChange={(value) => setPersonFilter(value as PersonFilter)}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                  <SelectValue placeholder="Filter roster" />
                </SelectTrigger>
                <SelectContent>
                  {PERSON_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-[24px]" />)
            ) : filteredPeople.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
                <p className="text-base font-semibold text-slate-900">No officers match the current filters.</p>
                <p className="mt-2 text-sm text-slate-500">Adjust the search, clear the filter, or add new officers from the onboarding flow.</p>
              </div>
            ) : (
              filteredPeople.map((person) => {
                const missingChatAssignments = person.assignments.filter((assignment) => !assignment.inAdminChat).length;
                return (
                  <article key={person.key} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14 rounded-2xl border border-slate-200">
                          <AvatarImage src={person.avatarUrl ?? undefined} />
                          <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                            {(person.name || person.email || "OF").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold tracking-tight text-slate-950">{person.name}</h3>
                            {person.assignments.length > 1 && (
                              <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">
                                {person.assignments.length} club assignments
                              </Badge>
                            )}
                            {missingChatAssignments > 0 ? (
                              <Badge className="rounded-full border-0 bg-red-100 text-red-700">
                                {missingChatAssignments} chat gap{missingChatAssignments > 1 ? "s" : ""}
                              </Badge>
                            ) : (
                              <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">
                                Messaging ready
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {person.email || "No email on file"}
                            </span>
                            <span>{person.assignments.length} active leadership role{person.assignments.length > 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {person.assignments.map((assignment) => (
                        <div key={assignment.id} className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 xl:grid-cols-[minmax(0,1fr)_170px_180px_auto_auto] xl:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{assignment.clubName}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Added {assignment.createdAt ? new Date(assignment.createdAt).toLocaleDateString() : "recently"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Messaging</p>
                            <div className="mt-2">
                              {assignment.inAdminChat ? (
                                <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">Connected</Badge>
                              ) : (
                                <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Needs access</Badge>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Role</p>
                            <div className="mt-2">
                              <Select
                                value={assignment.role ?? undefined}
                                onValueChange={(value) => handleRoleChange(assignment, value as OfficerRole)}
                                disabled={savingRoleId === assignment.id}
                              >
                                <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            className="rounded-full border-slate-200 bg-white"
                            onClick={() => handleLinkOfficerToChat(assignment)}
                            disabled={assignment.inAdminChat || !assignment.userId || !assignment.clubId || linkingChatId === assignment.id}
                          >
                            {linkingChatId === assignment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                            {assignment.inAdminChat ? "In chat" : "Add to chat"}
                          </Button>

                          <Button
                            variant="ghost"
                            className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleRemove(assignment)}
                            disabled={removingId === assignment.id}
                          >
                            {removingId === assignment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">Coverage watchlist</CardTitle>
              <CardDescription>
                Clubs that still need staffing or messaging work before leadership operations are reliable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)
              ) : coverageRisks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                  No immediate officer coverage risks detected.
                </div>
              ) : (
                coverageRisks.slice(0, 8).map((club) => (
                  <div key={club.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{club.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {club.officerCount === 0 && <Badge className="rounded-full border-0 bg-red-100 text-red-700">No officers</Badge>}
                          {club.officerCount > 0 && !club.hasPresident && <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">No president</Badge>}
                          {club.officerCount > 0 && !club.hasMessagingAccess && <Badge className="rounded-full border-0 bg-sky-100 text-sky-700">Chat not linked</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/members/add">Add Officer</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/messaging">Open Messaging</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">Assignment risks</CardTitle>
              <CardDescription>
                People carrying more than one club leadership assignment should be reviewed for workload and backup coverage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
              ) : multiClubPeople.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                  No multi-club officer assignments right now.
                </div>
              ) : (
                multiClubPeople.map((person) => (
                  <div key={person.key} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-950">{person.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{person.email || "No email on file"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {person.assignments.map((assignment) => (
                        <Badge key={assignment.id} variant="outline" className="rounded-full">
                          {assignment.clubName} · {formatRoleLabel(assignment.role)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Officers;
