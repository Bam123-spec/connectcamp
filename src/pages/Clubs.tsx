import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { useRealtimeMembers } from "@/hooks/useRealtimeMembers";

type Club = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  day: string | null;
  time: string | null;
  cover_image_url: string | null;
  member_count: number | null;
  approved: boolean | null;
};

function Clubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;

    const fetchClubs = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("clubs").select("*").order("name");

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        setClubs(data ?? []);
        setError(null);
      }

      setLoading(false);
    };

    fetchClubs();

    return () => {
      active = false;
    };
  }, []);

  const content = () => {
    if (loading) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Unable to load clubs: {error}
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Club roster</CardTitle>
          <p className="text-sm text-muted-foreground">
            Live data pulled directly from the Connect Camp Supabase project.
          </p>
        </CardHeader>
        <CardContent>{content()}</CardContent>
      </Card>
    </div>
  );
}

export default Clubs;

const ClubCard = ({ club }: { club: Club }) => {
  const memberCount = useRealtimeMembers(club.id);

  return (
    <article className="overflow-hidden rounded-xl border bg-background/80 shadow-sm">
      {club.cover_image_url ? (
        <img src={club.cover_image_url} alt={club.name} className="h-32 w-full object-cover" />
      ) : (
        <div className="h-32 w-full bg-muted" />
      )}
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">{club.name}</p>
            <p className="text-sm text-muted-foreground">{club.description}</p>
          </div>
          {!club.approved && (
            <Badge variant="destructive" className="shrink-0">
              Pending
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Members</p>
            <p className="text-lg font-semibold">{memberCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Meeting time</p>
            <p className="font-medium">
              {club.day ?? "TBD"} • {club.time ?? "TBD"}
            </p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">Location: {club.location ?? "TBD"}</div>
      </div>
    </article>
  );
};
