import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import UserTable, { type DisplayUser } from "@/components/user-management/UserTable";
import UserDetailPanel from "@/components/user-management/UserDetailPanel";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  role: string | null;
};

type ClubMembership = {
  id: string;
  club_id: string;
  user_id: string | null;
};

type Club = {
  id: string;
  name: string;
};

type Officer = {
  id: string;
  user_id: string | null;
  role: string | null;
  club_id: string | null;
};

type ActivityCounts = {
  events: Record<string, number>;
  forms: Record<string, number>;
};

function UserManagement() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<ClubMembership[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [activity, setActivity] = useState<ActivityCounts>({ events: {}, forms: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileResult, membershipResult, clubResult, submissionsResult] = await Promise.all([
          supabase.from("profiles").select("id,full_name,email,created_at,role"),
          supabase.from("club_members").select("id,club_id,user_id"),
          supabase.from("clubs").select("id,name"),
          supabase.from("form_submissions").select("id,submitted_by"),
        ]);
        const officerData = await fetchOfficersSafe();

        if (!active) return;

        const firstError =
          profileResult.error ??
          membershipResult.error ??
          clubResult.error ??
          submissionsResult.error ??
          null;

        if (firstError) {
          setError(firstError.message);
        } else {
          setProfiles(profileResult.data ?? []);
          setMemberships(membershipResult.data ?? []);
          setClubs(clubResult.data ?? []);
          setOfficers(officerData);
          setActivity({
            events: {},
            forms: buildCountMap(submissionsResult.data ?? [], "submitted_by"),
          });
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load users.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const displayUsers: DisplayUser[] = useMemo(() => {
    const membershipMap = new Map<string, number>();
    memberships.forEach((membership) => {
      if (!membership.user_id) return;
      membershipMap.set(membership.user_id, (membershipMap.get(membership.user_id) ?? 0) + 1);
    });

    return profiles.map((profile) => {
      const officerRole = officers.find((officer) => officer.user_id === profile.id)?.role ?? null;
      const clubsCount = membershipMap.get(profile.id) ?? 0;
      return {
        id: profile.id,
        name: profile.full_name ?? "",
        email: profile.email ?? "",
        createdAt: profile.created_at,
        role: profile.role,
        status: "active",
        clubsCount,
        officerRole,
      };
    });
  }, [profiles, memberships, officers]);

  const filteredUsers = useMemo(() => {
    return displayUsers.filter((user) => {
      const matchesSearch =
        !search ||
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || (user.role ?? "student") === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [displayUsers, search, roleFilter, statusFilter]);

  const selectedUser = profiles.find((profile) => profile.id === selectedUserId) ?? null;

  const selectedUserDisplay = selectedUser
    ? displayUsers.find((user) => user.id === selectedUser.id)
    : undefined;

  const selectedMemberships = useMemo(() => {
    if (!selectedUser) return [];
    const identifier = selectedUser.id;
    const userMemberships = memberships.filter((membership) => {
      return membership.user_id === identifier;
    });
    return userMemberships
      .map((membership) => {
        const club = clubs.find((club) => club.id === membership.club_id);
        if (!club) return null;
        return {
          membershipId: membership.id,
          clubId: club.id,
          name: club.name,
        };
      })
      .filter(Boolean) as { membershipId: string; clubId: string; name: string }[];
  }, [selectedUser, memberships, clubs]);

  const officerRecord = useMemo(() => {
    if (!selectedUser) return null;
    return officers.find((officer) => officer.user_id === selectedUser.id) ?? null;
  }, [selectedUser, officers]);

  const handleStatusToggle = async (_userId: string, _isActive: boolean) => {
    // Status field not available; surface a friendly notice instead of failing.
    toast({
      title: "Status not configured",
      description: "profiles.is_active column is missing; please add it or omit status toggles.",
      variant: "destructive",
    });
  };

  const handleSoftDelete = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", userId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User flagged", description: "User has been soft deleted." });
  };

  const handleRemoveFromClub = async (membershipId: string) => {
    const { error } = await supabase.from("club_members").delete().eq("id", membershipId);
    if (error) {
      toast({ title: "Unable to remove", description: error.message, variant: "destructive" });
      return;
    }
    setMemberships((prev) => prev.filter((entry) => entry.id !== membershipId));
    toast({ title: "Club updated", description: "User removed from club." });
  };

  const handlePromote = async (role: string) => {
    if (!selectedUser || !role) return;
    const payload = {
      user_id: selectedUser.id,
      role,
      club_id: null,
    };
    const { error } = await supabase.from("officers").upsert(payload, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Unable to promote", description: error.message, variant: "destructive" });
      return;
    }
    setOfficers((prev) => {
      const existing = prev.find((entry) => entry.user_id === selectedUser.id);
      if (existing) {
        return prev.map((entry) => (entry.user_id === selectedUser.id ? { ...entry, role } : entry));
      }
      return [...prev, { ...payload, id: crypto.randomUUID() }];
    });
    toast({ title: "Officer updated", description: `${selectedUser.full_name ?? "User"} is now ${role}.` });
  };

  const handleRevokeOfficer = async () => {
    if (!selectedUser) return;
    const target = officerRecord;
    if (!target) return;
    const { error } = await supabase.from("officers").delete().eq("user_id", selectedUser.id);
    if (error) {
      toast({ title: "Unable to revoke", description: error.message, variant: "destructive" });
      return;
    }
    setOfficers((prev) => prev.filter((officer) => officer.id !== target.id));
    toast({ title: "Officer revoked", description: "Officer role removed." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User management</h1>
          <p className="text-sm text-muted-foreground">Search, filter, and manage student accounts.</p>
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <UserTable
        users={filteredUsers}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        roleFilter={roleFilter}
        onRoleFilter={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        onSelectUser={(userId) => setSelectedUserId(userId)}
      />
      <UserDetailPanel
        open={Boolean(selectedUserId)}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
        user={
          selectedUser && selectedUserDisplay
            ? {
                id: selectedUser.id,
                name: selectedUser.full_name ?? "Unnamed",
                email: selectedUser.email ?? "",
                createdAt: selectedUser.created_at,
                role: selectedUser.role,
                status: selectedUserDisplay.status,
                officerRole: selectedUserDisplay.officerRole,
              }
            : undefined
        }
        clubs={selectedMemberships}
        officerRole={officerRecord?.role ?? null}
        activity={{
          events: getActivityValue(activity.events, selectedUser),
          forms: getActivityValue(activity.forms, selectedUser),
        }}
        onRemoveClub={handleRemoveFromClub}
        onPromote={handlePromote}
        onRevoke={handleRevokeOfficer}
        onActivate={() => selectedUser && handleStatusToggle(selectedUser.id, true)}
        onDeactivate={() => selectedUser && handleStatusToggle(selectedUser.id, false)}
        onSoftDelete={() => selectedUser && handleSoftDelete(selectedUser.id)}
      />
    </div>
  );
}

export default UserManagement;

function buildCountMap(
  rows: Array<Record<string, any>>,
  primaryField: string,
  fallbackField?: string,
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const rawKey = row[primaryField] ?? (fallbackField ? row[fallbackField] : null);
    if (!rawKey) return acc;
    const key = typeof rawKey === "string" ? rawKey.toLowerCase() : rawKey;
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function getActivityValue(map: Record<string, number>, user: Profile | null) {
  if (!user) return 0;
  const byId = map[user.id];
  if (typeof byId === "number") return byId;
  const emailKey = user.email?.toLowerCase();
  return emailKey ? map[emailKey] ?? 0 : 0;
}

async function fetchOfficersSafe(): Promise<Officer[]> {
  const { data, error } = await supabase.from("officers").select("id,user_id,club_id,role");
  if (error) {
    console.warn("[UserManagement] officers table unavailable:", error.message);
    return [];
  }
  return data ?? [];
}
