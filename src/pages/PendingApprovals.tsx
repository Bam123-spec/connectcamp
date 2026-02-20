import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";

type Club = {
  id: string;
  name: string;
  description: string | null;
  approved: boolean | null;
};

type Event = {
  id: string;
  name: string;
  description: string | null;
  approved: boolean | null;
};

function PendingApprovals() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [clubResult, eventResult] = await Promise.all([
        supabase.from("clubs").select("id,name,description,approved"),
        supabase.from("events").select("id,name,description,approved"),
      ]);
      if (!active) return;
      const firstError = clubResult.error ?? eventResult.error ?? null;
      if (firstError) {
        setError(firstError.message);
      } else {
        setClubs(clubResult.data ?? []);
        setEvents(eventResult.data ?? []);
        setError(null);
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const pendingClubs = useMemo(() => clubs.filter((club) => club.approved === false || club.approved === null), [clubs]);
  const pendingEvents = useMemo(() => events.filter((event) => event.approved === false || event.approved === null), [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pending Approvals</h1>
        <p className="text-sm text-muted-foreground">Clubs and events that still need an admin decision.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Unable to load approvals: {error}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clubs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : pendingClubs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clubs waiting for review.</p>
            ) : (
              <div className="space-y-3">
                {pendingClubs.map((club) => (
                  <div key={club.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{club.name}</p>
                      <Badge variant="destructive">Pending</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{club.description ?? "No description."}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : pendingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events waiting for review.</p>
            ) : (
              <div className="space-y-3">
                {pendingEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{event.name}</p>
                      <Badge variant="destructive">Pending</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.description ?? "No description."}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PendingApprovals;
