import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  day: string | null;
  time: string | null;
  location: string | null;
  approved: boolean | null;
  created_at: string | null;
};

function Events() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        setEvents(data ?? []);
        setError(null);
      }

      setLoading(false);
    };

    fetchEvents();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upcoming programming</CardTitle>
          <p className="text-sm text-muted-foreground">
            Powered by the live data in the Supabase `events` table.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Unable to load events: {error}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Day / Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{event.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {event.day ?? "TBD"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.time ?? "To be scheduled"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.location ?? "TBD"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={event.approved ? "default" : "destructive"}
                      >
                        {event.approved ? "Approved" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Events;
