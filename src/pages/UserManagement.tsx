import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  ChevronRight,
  IdCard,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { callAdminMemberManagementApi } from "@/lib/adminMemberManagementApi";
import { logAuditEventSafe } from "@/lib/auditApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  role: string | null;
  org_id?: string | null;
  avatar_url?: string | null;
  deleted_at?: string | null;
};

type ClubRow = {
  id: string;
  name: string;
  org_id?: string | null;
};

type MembershipRow = {
  id: string;
  club_id: string;
  user_id: string | null;
};

type OfficerRow = {
  id: string;
  user_id: string | null;
  role: string | null;
  club_id: string | null;
};

type MessagingMemberRow = {
  conversation_id: string;
  user_id: string | null;
};

type FormSubmissionRow = {
  id: string;
  submitted_by?: string | null;
};

type AccessState = "ready" | "needs_org" | "needs_role" | "needs_club" | "needs_messaging" | "inactive";

type UserDirectoryRecord = {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  role: string | null;
  orgId: string | null;
  avatarUrl: string | null;
  isInactive: boolean;
  clubMemberships: Array<{ membershipId: string; clubId: string; name: string }>;
  officerAssignments: Array<{ id: string; clubId: string | null; clubName: string | null; role: string | null }>;
  messagingConversationCount: number;
  formsSubmitted: number;
  accessState: AccessState;
  accessStateLabel: string;
  accessSummary: string;
};

const APP_ROLE_OPTIONS = ["student", "officer", "advisor", "admin", "student_life_admin", "super_admin"] as const;
const OFFICER_ROLE_OPTIONS = ["president", "vice_president", "treasurer", "secretary"] as const;
const ROLE_FILTER_OPTIONS = ["all", "admins", "officers", "members", "unassigned"] as const;
const ACCESS_FILTER_OPTIONS = ["all", "ready", "needs_attention", "needs_org", "needs_role", "needs_club", "needs_messaging", "inactive"] as const;

function UserManagement() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const currentOrgId = profile?.org_id ?? null;

  const [records, setRecords] = useState<UserDirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTER_OPTIONS)[number]>("all");
  const [accessFilter, setAccessFilter] = useState<(typeof ACCESS_FILTER_OPTIONS)[number]>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchDirectory = async () => {
      setLoading(true);
      setError(null);
      try {
        const clubRows = await fetchScopedClubs(currentOrgId);
        const clubIds = clubRows.map((club) => club.id);

        const [membershipResult, officerResult, messagingResult, formResult] = await Promise.all([
          clubIds.length
            ? fetchOptionalTable<MembershipRow>("club_members", "id,club_id,user_id", (query) => query.in("club_id", clubIds))
            : Promise.resolve({ data: [] as MembershipRow[], missing: true }),
          fetchOptionalTable<OfficerRow>("officers", "id,user_id,club_id,role"),
          fetchOptionalTable<MessagingMemberRow>("admin_conversation_members", "conversation_id,user_id"),
          fetchOptionalTable<FormSubmissionRow>("form_submissions", "id,submitted_by"),
        ]);

        const linkedUserIds = new Set<string>();
        membershipResult.data.forEach((row) => {
          if (row.user_id) linkedUserIds.add(row.user_id);
        });
        officerResult.data.forEach((row) => {
          if (!row.user_id) return;
          if (!row.club_id || clubIds.includes(row.club_id)) {
            linkedUserIds.add(row.user_id);
          }
        });
        if (profile?.id) linkedUserIds.add(profile.id);

        const profileRows = await fetchScopedProfiles(currentOrgId, Array.from(linkedUserIds));

        if (!active) return;

        const directory = buildDirectoryRecords({
          profiles: profileRows,
          clubs: clubRows,
          memberships: membershipResult.data.filter((row) => row.user_id),
          officers: officerResult.data.filter((row) => !row.club_id || clubIds.includes(row.club_id)),
          messagingMembers: messagingResult.data.filter((row) => row.user_id),
          formSubmissions: formResult.data,
          currentOrgId,
        });

        setRecords(directory);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load user access directory.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDirectory();
    return () => {
      active = false;
    };
  }, [currentOrgId, profile?.id]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        !search ||
        record.name.toLowerCase().includes(search.toLowerCase()) ||
        record.email.toLowerCase().includes(search.toLowerCase()) ||
        record.clubMemberships.some((club) => club.name.toLowerCase().includes(search.toLowerCase()));

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admins" && isAdminRole(record.role)) ||
        (roleFilter === "officers" && (record.officerAssignments.length > 0 || record.role === "officer")) ||
        (roleFilter === "members" && !isAdminRole(record.role) && record.officerAssignments.length === 0) ||
        (roleFilter === "unassigned" && !record.role);

      const matchesAccess =
        accessFilter === "all" ||
        (accessFilter === "needs_attention" && record.accessState !== "ready") ||
        record.accessState === accessFilter;

      return matchesSearch && matchesRole && matchesAccess;
    });
  }, [records, search, roleFilter, accessFilter]);

  const selectedRecord = records.find((record) => record.id === selectedUserId) ?? null;

  const summary = useMemo(() => {
    const admins = records.filter((record) => isAdminRole(record.role)).length;
    const officerLinked = records.filter((record) => record.officerAssignments.length > 0).length;
    const messagingReady = records.filter((record) => record.messagingConversationCount > 0).length;
    const needsAttention = records.filter((record) => record.accessState !== "ready").length;
    const orgAligned = records.filter((record) => record.orgId && (!currentOrgId || record.orgId === currentOrgId)).length;

    return {
      total: records.length,
      admins,
      officerLinked,
      messagingReady,
      needsAttention,
      orgAligned,
    };
  }, [currentOrgId, records]);

  const handleWorkspaceRoleChange = async (user: UserDirectoryRecord, nextRole: string) => {
    if ((user.role ?? "") === nextRole) return;
    setSavingAction(`role:${user.id}`);
    try {
      await callAdminMemberManagementApi({
        action: "update-user-role",
        userId: user.id,
        role: nextRole,
      });

      setRecords((current) =>
        current.map((record) =>
          record.id === user.id ? deriveAccessRecord({ ...record, role: nextRole }, currentOrgId) : record,
        ),
      );

      void logAuditEventSafe({
        orgId: currentOrgId,
        category: "members",
        action: "user_role_updated",
        entityType: "profile",
        entityId: user.id,
        title: "Workspace role updated",
        summary: `${user.email} is now assigned the ${nextRole} role.`,
        metadata: {
          user_email: user.email,
          role: nextRole,
        },
      });

      toast({
        title: "Role updated",
        description: `${user.name} now has the ${nextRole} workspace role.`,
      });
    } catch (caughtError) {
      toast({
        title: "Unable to update role",
        description: caughtError instanceof Error ? caughtError.message : "Unable to update workspace role.",
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleAssignWorkspace = async (user: UserDirectoryRecord) => {
    if (!currentOrgId) {
      toast({
        title: "Workspace not configured",
        description: "Current admin profile has no org_id, so workspace assignment is unavailable.",
        variant: "destructive",
      });
      return;
    }

    setSavingAction(`org:${user.id}`);
    try {
      await callAdminMemberManagementApi({
        action: "assign-org",
        userId: user.id,
        orgId: currentOrgId,
      });

      setRecords((current) =>
        current.map((record) =>
          record.id === user.id ? deriveAccessRecord({ ...record, orgId: currentOrgId }, currentOrgId) : record,
        ),
      );

      void logAuditEventSafe({
        orgId: currentOrgId,
        category: "members",
        action: "user_org_assigned",
        entityType: "profile",
        entityId: user.id,
        title: "Workspace assigned",
        summary: `${user.email} was assigned into the current workspace.`,
        metadata: {
          user_email: user.email,
          assigned_org_id: currentOrgId,
        },
      });

      toast({
        title: "Workspace assigned",
        description: `${user.name} now belongs to the current workspace.`,
      });
    } catch (caughtError) {
      toast({
        title: "Unable to assign workspace",
        description: caughtError instanceof Error ? caughtError.message : "Unable to assign workspace.",
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleRemoveMembership = async (user: UserDirectoryRecord, membershipId: string, clubName: string) => {
    setSavingAction(`membership:${membershipId}`);
    try {
      await callAdminMemberManagementApi({
        action: "remove-membership",
        membershipId,
      });

      setRecords((current) =>
        current.map((record) => {
          if (record.id !== user.id) return record;
          return deriveAccessRecord(
            {
              ...record,
              clubMemberships: record.clubMemberships.filter((club) => club.membershipId !== membershipId),
            },
            currentOrgId,
          );
        }),
      );

      void logAuditEventSafe({
        orgId: currentOrgId,
        category: "members",
        action: "club_member_removed",
        entityType: "club",
        title: "Club membership removed",
        summary: `${user.email} was removed from ${clubName}.`,
        metadata: {
          user_email: user.email,
          club_name: clubName,
        },
      });

      toast({
        title: "Membership removed",
        description: `${user.name} was removed from ${clubName}.`,
      });
    } catch (caughtError) {
      toast({
        title: "Unable to remove membership",
        description: caughtError instanceof Error ? caughtError.message : "Unable to remove membership.",
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleOfficerRoleChange = async (user: UserDirectoryRecord, nextRole: string) => {
    setSavingAction(`officer:${user.id}`);
    try {
      await callAdminMemberManagementApi({
        action: "upsert-officer",
        userId: user.id,
        role: nextRole,
        clubId: user.officerAssignments[0]?.clubId ?? user.clubMemberships[0]?.clubId ?? null,
      });

      setRecords((current) =>
        current.map((record) => {
          if (record.id !== user.id) return record;

          const existing = record.officerAssignments[0];
          const nextAssignments = existing
            ? record.officerAssignments.map((assignment, index) =>
                index === 0 ? { ...assignment, role: nextRole } : assignment,
              )
            : [
                {
                  id: crypto.randomUUID(),
                  clubId: record.clubMemberships[0]?.clubId ?? null,
                  clubName: record.clubMemberships[0]?.name ?? null,
                  role: nextRole,
                },
              ];

          return deriveAccessRecord({ ...record, role: record.role ?? "officer", officerAssignments: nextAssignments }, currentOrgId);
        }),
      );

      void logAuditEventSafe({
        orgId: currentOrgId,
        category: "officers",
        action: "officer_role_updated",
        entityType: "profile",
        entityId: user.id,
        title: "Officer role updated",
        summary: `${user.email} is now ${displayRole(nextRole)}.`,
        metadata: {
          user_email: user.email,
          officer_role: nextRole,
        },
      });

      toast({
        title: "Officer role updated",
        description: `${user.name} is now ${displayRole(nextRole)}.`,
      });
    } catch (caughtError) {
      toast({
        title: "Unable to update officer role",
        description: caughtError instanceof Error ? caughtError.message : "Unable to update officer role.",
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleRevokeOfficer = async (user: UserDirectoryRecord) => {
    setSavingAction(`revoke:${user.id}`);
    try {
      await callAdminMemberManagementApi({
        action: "remove-officer",
        userId: user.id,
      });

      setRecords((current) =>
        current.map((record) =>
          record.id === user.id ? deriveAccessRecord({ ...record, officerAssignments: [] }, currentOrgId) : record,
        ),
      );

      void logAuditEventSafe({
        orgId: currentOrgId,
        category: "officers",
        action: "officer_revoked",
        entityType: "profile",
        entityId: user.id,
        title: "Officer role revoked",
        summary: `${user.email} no longer has an officer assignment.`,
        metadata: {
          user_email: user.email,
        },
      });

      toast({
        title: "Officer access removed",
        description: `${user.name} no longer has an officer assignment.`,
      });
    } catch (caughtError) {
      toast({
        title: "Unable to revoke officer role",
        description: caughtError instanceof Error ? caughtError.message : "Unable to revoke officer role.",
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  const handleSoftDelete = async (user: UserDirectoryRecord) => {
    setSavingAction(`delete:${user.id}`);
    try {
      await callAdminMemberManagementApi({
        action: "soft-delete-user",
        userId: user.id,
      });

      setRecords((current) =>
        current.map((record) =>
          record.id === user.id ? deriveAccessRecord({ ...record, isInactive: true }, currentOrgId) : record,
        ),
      );

      void logAuditEventSafe({
        orgId: currentOrgId,
        category: "members",
        action: "user_soft_deleted",
        entityType: "profile",
        entityId: user.id,
        title: "User soft deleted",
        summary: `${user.email} was soft deleted from the admin workspace.`,
        metadata: {
          user_email: user.email,
        },
      });

      toast({
        title: "User flagged",
        description: `${user.name} has been soft deleted.`,
      });
    } catch (caughtError) {
      toast({
        title: "Unable to soft delete user",
        description: caughtError instanceof Error ? caughtError.message : "Unable to soft delete user.",
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#f4f8fd_100%)] shadow-sm">
        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.35fr,0.65fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Access Management</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
                Manage identity, access posture, and workspace readiness from one place.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                This page is now structured around provisioning states instead of just raw profiles. It shows who is assigned to the workspace,
                who is linked to clubs, who has officer access, and who is actually ready to work inside the admin system.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-full">
                <Link to="/members/add">Open onboarding</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-slate-200">
                <Link to="/messaging">Open messaging readiness</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-slate-200">
                <Link to="/audit-log">Open audit log</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white/85 p-5">
            <p className="text-sm font-semibold text-slate-950">What this page is responsible for</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>Workspace role assignment, org alignment, club linkage, and officer coverage.</p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>Messaging readiness for club-side and admin-side communication.</p>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <p>Credential lifecycle and MFA belong to your IdP later. This page manages app access, not identity ownership.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-0 border-t border-slate-200 lg:grid-cols-6">
          <AccessKpiCard label="Accounts" value={summary.total} helper="Profiles currently visible in this workspace" icon={Users} />
          <AccessKpiCard label="Admins" value={summary.admins} helper="Student Life and admin operators" icon={ShieldCheck} />
          <AccessKpiCard label="Officer-linked" value={summary.officerLinked} helper="Users with officer assignments" icon={IdCard} />
          <AccessKpiCard label="Messaging-ready" value={summary.messagingReady} helper="Users already reachable in admin chat" icon={MessageSquare} />
          <AccessKpiCard label="Org-aligned" value={summary.orgAligned} helper="Users assigned to the current workspace" icon={Building2} />
          <AccessKpiCard label="Needs attention" value={summary.needsAttention} helper="Users missing setup or access requirements" icon={AlertTriangle} />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.45fr,0.55fr]">
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl tracking-tight">Access directory</CardTitle>
                <CardDescription>
                  Search and filter by role, provisioning posture, club linkage, and messaging readiness.
                </CardDescription>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),200px,220px]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, or club..."
                className="h-11 rounded-2xl border-slate-200"
              />
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as (typeof ROLE_FILTER_OPTIONS)[number])}
              >
                <option value="all">All role types</option>
                <option value="admins">Admins</option>
                <option value="officers">Officers</option>
                <option value="members">Members</option>
                <option value="unassigned">No role assigned</option>
              </select>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                value={accessFilter}
                onChange={(event) => setAccessFilter(event.target.value as (typeof ACCESS_FILTER_OPTIONS)[number])}
              >
                <option value="all">All access states</option>
                <option value="ready">Ready</option>
                <option value="needs_attention">Needs attention</option>
                <option value="needs_org">Needs workspace</option>
                <option value="needs_role">Needs role</option>
                <option value="needs_club">Needs club link</option>
                <option value="needs_messaging">Needs messaging</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-[560px] w-full rounded-[24px]" />
            ) : filteredRecords.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center">
                <p className="text-base font-semibold text-slate-900">No users match the current filters.</p>
                <p className="mt-2 text-sm text-slate-500">Adjust the filters, or onboard new users through the member management flow.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="w-[320px]">User</TableHead>
                      <TableHead>Workspace role</TableHead>
                      <TableHead>Org</TableHead>
                      <TableHead>Club / officer linkage</TableHead>
                      <TableHead>Messaging</TableHead>
                      <TableHead>Access state</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-slate-50/80"
                        onClick={() => setSelectedUserId(record.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 rounded-2xl">
                              <AvatarImage src={record.avatarUrl ?? undefined} alt={record.name} />
                              <AvatarFallback>{avatarFallback(record.name || record.email)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">{record.name}</p>
                              <p className="truncate text-sm text-slate-500">{record.email}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                Joined {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "unknown"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 capitalize text-slate-700">
                            {record.role ?? "Unassigned"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.orgId ? (
                            <Badge className="rounded-full border-0 bg-blue-100 text-blue-700">
                              {currentOrgId && record.orgId === currentOrgId ? "Current workspace" : "Assigned"}
                            </Badge>
                          ) : (
                            <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Unassigned</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-slate-900">
                              {record.clubMemberships.length} club{record.clubMemberships.length === 1 ? "" : "s"}
                            </p>
                            <p className="text-slate-500">
                              {record.officerAssignments.length > 0
                                ? `${record.officerAssignments.length} officer assignment${record.officerAssignments.length === 1 ? "" : "s"}`
                                : "No officer assignment"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.messagingConversationCount > 0 ? (
                            <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">
                              Ready ({record.messagingConversationCount})
                            </Badge>
                          ) : (
                            <Badge className="rounded-full border-0 bg-amber-100 text-amber-800">Not connected</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <AccessStateBadge state={record.accessState} />
                            <p className="max-w-[220px] text-xs text-slate-500">{record.accessSummary}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">Provisioning watchlist</CardTitle>
              <CardDescription>These are the accounts that still need Student Life intervention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-64 w-full rounded-[20px]" />
              ) : records.filter((record) => record.accessState !== "ready").slice(0, 6).length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-sm text-slate-500">
                  No provisioning issues detected right now.
                </div>
              ) : (
                records
                  .filter((record) => record.accessState !== "ready")
                  .slice(0, 6)
                  .map((record) => (
                    <button
                      type="button"
                      key={record.id}
                      onClick={() => setSelectedUserId(record.id)}
                      className="w-full rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-left transition hover:bg-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{record.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{record.accessSummary}</p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">IdP transition posture</CardTitle>
              <CardDescription>What this page should own after SSO or institutional identity is integrated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                <p className="font-semibold text-slate-900">Keep here</p>
                <p className="mt-1">Org assignment, app role mapping, club linkage, officer linkage, messaging readiness, and audit history.</p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                <p className="font-semibold text-slate-900">Move to IdP later</p>
                <p className="mt-1">Passwords, account recovery, MFA, suspension, and lifecycle actions that belong to central identity.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <UserAccessSheet
        open={Boolean(selectedRecord)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedUserId(null);
        }}
        user={selectedRecord}
        currentOrgId={currentOrgId}
        savingAction={savingAction}
        onWorkspaceRoleChange={handleWorkspaceRoleChange}
        onAssignWorkspace={handleAssignWorkspace}
        onRemoveMembership={handleRemoveMembership}
        onOfficerRoleChange={handleOfficerRoleChange}
        onRevokeOfficer={handleRevokeOfficer}
        onSoftDelete={handleSoftDelete}
      />
    </div>
  );
}

function UserAccessSheet({
  open,
  onOpenChange,
  user,
  currentOrgId,
  savingAction,
  onWorkspaceRoleChange,
  onAssignWorkspace,
  onRemoveMembership,
  onOfficerRoleChange,
  onRevokeOfficer,
  onSoftDelete,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  user: UserDirectoryRecord | null;
  currentOrgId: string | null;
  savingAction: string | null;
  onWorkspaceRoleChange: (user: UserDirectoryRecord, nextRole: string) => Promise<void>;
  onAssignWorkspace: (user: UserDirectoryRecord) => Promise<void>;
  onRemoveMembership: (user: UserDirectoryRecord, membershipId: string, clubName: string) => Promise<void>;
  onOfficerRoleChange: (user: UserDirectoryRecord, nextRole: string) => Promise<void>;
  onRevokeOfficer: (user: UserDirectoryRecord) => Promise<void>;
  onSoftDelete: (user: UserDirectoryRecord) => Promise<void>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {user ? (
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle>Access review</SheetTitle>
              <p className="text-sm text-slate-500">Inspect workspace assignment, clubs, officer access, and messaging readiness for this account.</p>
            </SheetHeader>

            <div className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <Avatar className="h-14 w-14 rounded-2xl">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback>{avatarFallback(user.name || user.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-semibold text-slate-950">{user.name}</p>
                  <AccessStateBadge state={user.accessState} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white capitalize text-slate-700">
                    {user.role ?? "No workspace role"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                    {user.orgId ? "Workspace assigned" : "No workspace assigned"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                    {user.messagingConversationCount > 0 ? "Messaging ready" : "Messaging missing"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-[24px] border-slate-200 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">Identity and org</CardTitle>
                  <CardDescription>Role mapping and workspace assignment that should survive future IdP integration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace role</p>
                    <select
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={user.role ?? ""}
                      onChange={(event) => {
                        if (event.target.value) {
                          void onWorkspaceRoleChange(user, event.target.value);
                        }
                      }}
                      disabled={savingAction === `role:${user.id}`}
                    >
                      <option value="">Choose a role</option>
                      {APP_ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {displayAppRole(role)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace assignment</p>
                    <p className="mt-2 text-sm font-medium text-slate-950">
                      {user.orgId ? (currentOrgId && user.orgId === currentOrgId ? "Assigned to current workspace" : "Assigned to another workspace") : "No workspace assigned"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{user.accessSummary}</p>
                    {!user.orgId && currentOrgId ? (
                      <Button
                        className="mt-3 rounded-full"
                        size="sm"
                        onClick={() => void onAssignWorkspace(user)}
                        disabled={savingAction === `org:${user.id}`}
                      >
                        Assign to current workspace
                      </Button>
                    ) : null}
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                    <p>Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "unknown"}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">{user.id}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[24px] border-slate-200 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">Messaging and activity</CardTitle>
                  <CardDescription>Whether this user can actually collaborate once access is granted.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatBox label="Messaging threads" value={user.messagingConversationCount} />
                    <StatBox label="Forms submitted" value={user.formsSubmitted} />
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-950">Readiness note</p>
                    <p className="mt-1 text-sm text-slate-500">{user.accessSummary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="rounded-full border-slate-200">
                        <Link to="/messaging">Open messaging</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="rounded-full border-slate-200">
                        <Link to="/audit-log">Open audit log</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[24px] border-slate-200 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Club and officer linkage</CardTitle>
                <CardDescription>Membership and leadership links that determine whether the account is operationally useful.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-950">Club memberships</p>
                    <span className="text-xs text-slate-500">{user.clubMemberships.length} linked</span>
                  </div>
                  {user.clubMemberships.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-sm text-slate-500">
                      No club memberships linked to this account.
                    </div>
                  ) : (
                    user.clubMemberships.map((club) => (
                      <div key={club.membershipId} className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{club.name}</p>
                          <p className="text-xs text-slate-500">{club.clubId}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onRemoveMembership(user, club.membershipId, club.name)}
                          disabled={savingAction === `membership:${club.membershipId}`}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Officer assignment</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {user.officerAssignments.length > 0
                        ? `${user.name} currently holds ${displayRole(user.officerAssignments[0].role)}.`
                        : "No officer assignment exists yet for this user."}
                    </p>
                  </div>

                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                    value={user.officerAssignments[0]?.role ?? ""}
                    onChange={(event) => {
                      if (event.target.value) {
                        void onOfficerRoleChange(user, event.target.value);
                      }
                    }}
                    disabled={savingAction === `officer:${user.id}`}
                  >
                    <option value="">Choose an officer role</option>
                    {OFFICER_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {displayRole(role)}
                      </option>
                    ))}
                  </select>

                  {user.officerAssignments.length > 0 ? (
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200"
                      onClick={() => void onRevokeOfficer(user)}
                      disabled={savingAction === `revoke:${user.id}`}
                    >
                      Revoke officer access
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-red-200 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg text-red-700">Lifecycle actions</CardTitle>
                <CardDescription>Use sparingly. Identity suspension and password actions should move to the institution’s IdP later.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={() => void onSoftDelete(user)}
                  disabled={savingAction === `delete:${user.id}`}
                >
                  Soft delete user
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-4 text-sm text-slate-500">Select a user to inspect access and provisioning details.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AccessKpiCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <div className="border-t border-slate-200 px-5 py-4 lg:border-t-0 lg:border-l first:lg:border-l-0">
      <div className="flex items-center justify-between gap-3 text-slate-500">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em]">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function AccessStateBadge({ state }: { state: AccessState }) {
  const classes =
    state === "ready"
      ? "bg-emerald-100 text-emerald-700"
      : state === "inactive"
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-800";

  return <Badge className={cn("rounded-full border-0", classes)}>{accessStateLabel(state)}</Badge>;
}

function buildDirectoryRecords({
  profiles,
  clubs,
  memberships,
  officers,
  messagingMembers,
  formSubmissions,
  currentOrgId,
}: {
  profiles: ProfileRow[];
  clubs: ClubRow[];
  memberships: MembershipRow[];
  officers: OfficerRow[];
  messagingMembers: MessagingMemberRow[];
  formSubmissions: FormSubmissionRow[];
  currentOrgId: string | null;
}) {
  const clubMap = new Map(clubs.map((club) => [club.id, club]));
  const profileMap = new Map<string, ProfileRow>();

  profiles.forEach((profile) => {
    profileMap.set(profile.id, profile);
  });

  memberships.forEach((membership) => {
    if (!membership.user_id || profileMap.has(membership.user_id)) return;
    profileMap.set(membership.user_id, {
      id: membership.user_id,
      full_name: null,
      email: null,
      created_at: null,
      role: null,
      org_id: currentOrgId,
      avatar_url: null,
      deleted_at: null,
    });
  });

  officers.forEach((officer) => {
    if (!officer.user_id || profileMap.has(officer.user_id)) return;
    profileMap.set(officer.user_id, {
      id: officer.user_id,
      full_name: null,
      email: null,
      created_at: null,
      role: null,
      org_id: currentOrgId,
      avatar_url: null,
      deleted_at: null,
    });
  });

  const formCountMap = new Map<string, number>();
  formSubmissions.forEach((submission) => {
    if (!submission.submitted_by) return;
    formCountMap.set(submission.submitted_by.toLowerCase(), (formCountMap.get(submission.submitted_by.toLowerCase()) ?? 0) + 1);
  });

  const messagingCountMap = new Map<string, number>();
  messagingMembers.forEach((member) => {
    if (!member.user_id) return;
    messagingCountMap.set(member.user_id, (messagingCountMap.get(member.user_id) ?? 0) + 1);
  });

  return Array.from(profileMap.values())
    .map((profile) => {
      const clubMemberships = memberships
        .filter((membership) => membership.user_id === profile.id)
        .map((membership) => ({
          membershipId: membership.id,
          clubId: membership.club_id,
          name: clubMap.get(membership.club_id)?.name ?? "Unknown club",
        }));

      const officerAssignments = officers
        .filter((officer) => officer.user_id === profile.id)
        .map((officer) => ({
          id: officer.id,
          clubId: officer.club_id,
          clubName: officer.club_id ? clubMap.get(officer.club_id)?.name ?? "Unknown club" : null,
          role: officer.role,
        }));

      return deriveAccessRecord(
        {
          id: profile.id,
          name: profile.full_name || profile.email || "Unidentified user",
          email: profile.email || "No email on file",
          createdAt: profile.created_at,
          role: profile.role ?? null,
          orgId: profile.org_id ?? null,
          avatarUrl: profile.avatar_url ?? null,
          isInactive: Boolean(profile.deleted_at),
          clubMemberships,
          officerAssignments,
          messagingConversationCount: messagingCountMap.get(profile.id) ?? 0,
          formsSubmitted: formCountMap.get(profile.id) ?? formCountMap.get((profile.email ?? "").toLowerCase()) ?? 0,
          accessState: "ready",
          accessStateLabel: "Ready",
          accessSummary: "",
        },
        currentOrgId,
      );
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function deriveAccessRecord(record: UserDirectoryRecord, currentOrgId: string | null): UserDirectoryRecord {
  let accessState: AccessState = "ready";
  let accessSummary = "Workspace access is aligned and operational.";

  if (record.isInactive) {
    accessState = "inactive";
    accessSummary = "This account has been soft deleted and should not be treated as active.";
  } else if (!record.orgId) {
    accessState = "needs_org";
    accessSummary = "Assign this user to the current workspace before relying on them operationally.";
  } else if (!record.role) {
    accessState = "needs_role";
    accessSummary = "This user has no workspace role yet, so their permissions are ambiguous.";
  } else if ((record.role === "officer" || record.officerAssignments.length > 0) && record.clubMemberships.length === 0) {
    accessState = "needs_club";
    accessSummary = "This user is marked as officer-side but has no club membership linked yet.";
  } else if ((isAdminRole(record.role) || record.officerAssignments.length > 0) && record.messagingConversationCount === 0) {
    accessState = "needs_messaging";
    accessSummary = "This user has operational responsibility but is not yet connected to admin messaging.";
  } else if (currentOrgId && record.orgId !== currentOrgId) {
    accessState = "needs_org";
    accessSummary = "This user is assigned to a different workspace and should not be managed here without review.";
  }

  return {
    ...record,
    accessState,
    accessStateLabel: accessStateLabel(accessState),
    accessSummary,
  };
}

function accessStateLabel(state: AccessState) {
  switch (state) {
    case "ready":
      return "Ready";
    case "needs_org":
      return "Needs workspace";
    case "needs_role":
      return "Needs role";
    case "needs_club":
      return "Needs club link";
    case "needs_messaging":
      return "Needs messaging";
    case "inactive":
      return "Inactive";
  }
}

function avatarFallback(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayRole(role?: string | null) {
  if (!role) return "Officer";
  return role.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayAppRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "student_life_admin" || role === "super_admin";
}

function isSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("does not exist") === true
  );
}

function isAccessError(error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42501" || error.code === "PGRST301") return true;
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return message.includes("permission denied") || message.includes("row-level security") || message.includes("forbidden");
}

async function fetchOptionalTable<T>(table: string, columns: string, apply?: (query: any) => any) {
  let query = supabase.from(table).select(columns);
  if (apply) query = apply(query);
  const { data, error } = await query;
  if (!error) {
    return { data: ((data ?? []) as unknown[]) as T[], missing: false };
  }
  if (isSchemaError(error) || isAccessError(error)) {
    return { data: [] as T[], missing: true };
  }
  throw error;
}

async function fetchScopedClubs(orgId: string | null) {
  const candidates: Array<{ columns: string; scoped: boolean }> = [
    { columns: "id,name,org_id", scoped: true },
    { columns: "id,name", scoped: false },
  ];

  for (const candidate of candidates) {
    let query = supabase.from("clubs").select(candidate.columns).order("name");
    if (orgId && candidate.scoped) {
      query = query.eq("org_id", orgId);
    }
    const { data, error } = await query;
    if (!error) {
      return ((data ?? []) as unknown[]) as ClubRow[];
    }
    if (isSchemaError(error) || isAccessError(error)) {
      continue;
    }
    throw error;
  }

  return [];
}

async function fetchScopedProfiles(orgId: string | null, linkedUserIds: string[]) {
  const candidates = [
    { columns: "id,full_name,email,created_at,role,org_id,avatar_url,deleted_at", scoped: true },
    { columns: "id,full_name,email,created_at,role,org_id,avatar_url", scoped: true },
    { columns: "id,full_name,email,created_at,role,org_id", scoped: true },
    { columns: "id,full_name,email,created_at,role", scoped: false },
  ];

  for (const candidate of candidates) {
    let query = supabase.from("profiles").select(candidate.columns);
    if (orgId && candidate.scoped) {
      query = query.eq("org_id", orgId);
    }
    const { data, error } = await query;
    if (!error) {
      const rows = ((data ?? []) as unknown[]) as ProfileRow[];
      if (candidate.scoped || !orgId) {
        return rows;
      }

      const linkedSet = new Set(linkedUserIds);
      return rows.filter((row) => linkedSet.has(row.id) || isAdminRole(row.role));
    }
    if (isSchemaError(error) || isAccessError(error)) {
      continue;
    }
    throw error;
  }

  return [];
}

export default UserManagement;
