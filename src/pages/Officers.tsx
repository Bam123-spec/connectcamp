import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabaseClient";
import RoleDropdown from "@/components/user-management/RoleDropdown";
import { Button } from "@/components/ui/button";

type InlineOfficer = {
  id: string;
  userId: string | null;
  clubId: string | null;
  role: string | null;
  name: string;
  email: string;
  clubName: string;
};

function Officers() {
  const [officers, setOfficers] = useState<InlineOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchOfficers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("officers")
        .select("id,role,user_id,club_id,profiles(full_name,email),clubs(name)")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        const rows = (data ?? []) as any[];
        const mapped =
          rows.map((row) => ({
            id: row.id as string,
            userId: (row as any).user_id as string | null,
            clubId: (row as any).club_id as string | null,
            role: (row as any).role as string | null,
            name: row.profiles?.full_name ?? row.profiles?.email ?? "Unknown",
            email: row.profiles?.email ?? "Unknown",
            clubName: row.clubs?.name ?? "Unassigned",
          })) ?? [];
        setOfficers(mapped);
        setError(null);
      }

      setLoading(false);
    };

    fetchOfficers();

    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; email: string; roles: InlineOfficer[] }>();

    officers.forEach((officer) => {
      const key = officer.email;
      if (!map.has(key)) {
        map.set(key, {
          name: officer.name,
          email: officer.email,
          roles: [],
        });
      }
      map.get(key)!.roles.push(officer);
    });

    return Array.from(map.values());
  }, [officers]);

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("officers").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setOfficers((prev) => prev.filter((row) => row.id !== id));
  };

  const handleChangeRole = async (id: string, role: string) => {
    const { error } = await supabase.from("officers").update({ role }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setOfficers((prev) => prev.map((row) => (row.id === id ? { ...row, role } : row)));
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Officer roster</CardTitle>
          <p className="text-sm text-muted-foreground">Live data from Supabase `officers`, `profiles`, and `clubs`.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))
          ) : error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Unable to load officers: {error}
            </div>
          ) : grouped.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
              No officers have been recorded in Supabase yet.
            </div>
          ) : (
            grouped.map((userGroup) => (
              <article key={userGroup.email} className="flex flex-col gap-4 rounded-xl border bg-background/70 p-4 sm:flex-row sm:items-start">
                <div className="flex items-center gap-4 sm:w-1/3">
                  <Avatar>
                    <AvatarFallback>{(userGroup.name || userGroup.email || "CC").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{userGroup.name}</p>
                    <p className="text-xs text-muted-foreground">{userGroup.email}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  {userGroup.roles.map((officer) => (
                    <div key={officer.id} className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-2 text-sm">
                      <div className="font-medium text-gray-700">
                        {officer.clubName}
                      </div>
                      <div className="flex items-center gap-2">
                        {editingId === officer.id ? (
                          <div className="flex items-center gap-2">
                            <RoleDropdown
                              value={officer.role}
                              onChange={(value) => {
                                if (value) handleChangeRole(officer.id, value);
                              }}
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                              <span className="sr-only">Cancel</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {officer.role ?? "student"}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditingId(officer.id)}>
                              <span className="sr-only">Edit</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </Button>
                          </div>
                        )}
                        <div className="h-4 w-px bg-border mx-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => handleRemove(officer.id)}>
                          <span className="sr-only">Remove</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Officers;
