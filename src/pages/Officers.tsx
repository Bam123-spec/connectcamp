import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  officer_title: string | null;
  club_id: string | null;
  created_at: string | null;
};

function Officers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchProfiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!active) {
        return;
      }

      if (error) {
        setError(error.message);
      } else {
        setProfiles(data ?? []);
        setError(null);
      }

      setLoading(false);
    };

    fetchProfiles();

    return () => {
      active = false;
    };
  }, []);

  const officers = useMemo(() => {
    return profiles.filter((profile) => {
      if (profile.officer_title) return true;
      if (!profile.role) return false;
      return ["admin", "officer", "advisor"].includes(profile.role);
    });
  }, [profiles]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Officer roster changes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pulling directly from the Supabase `profiles` table to keep leadership
            records in sync.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))
          ) : error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Unable to load profiles: {error}
            </div>
          ) : officers.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
              No officers have been recorded in Supabase yet. Once profiles gain
              an `officer_title` or elevated role they will appear here.
            </div>
          ) : (
            officers.map((officer) => (
              <article
                key={officer.id}
                className="flex items-center justify-between gap-4 rounded-xl border bg-background/70 p-4"
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>
                      {(officer.full_name ??
                        officer.email ??
                        "CC")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">
                      {officer.full_name || officer.email || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {officer.officer_title ?? "Member"} ·{" "}
                      {officer.role ?? "student"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {officer.role ?? "student"}
                </Badge>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Officers;
