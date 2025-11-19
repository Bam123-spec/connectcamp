import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { useRealtimeMembers } from "@/hooks/useRealtimeMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

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

type CreateClubForm = {
  name: string;
  description: string;
  day: string;
  time: string;
  location: string;
};

const CLUB_LOGO_BUCKET = "club-logos";
const initialCreateClubState: CreateClubForm = {
  name: "",
  description: "",
  day: "",
  time: "",
  location: "",
};

function Clubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateClubForm>(initialCreateClubState);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clubs").select("*").order("name");

    if (error) {
      setError(error.message);
    } else {
      setClubs(data ?? []);
      setError(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const resetCreateClubForm = () => {
    setCreateForm(initialCreateClubState);
    setLogoFile(null);
    setCreateError(null);
  };

  const uploadClubLogo = async () => {
    if (!logoFile) return null;

    const extension = logoFile.name.split(".").pop() ?? "png";
    const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString();
    const baseName = logoFile.name.replace(/\.[^/.]+$/, "");
    const sanitized = baseName.replace(/\s+/g, "-").toLowerCase();
    const path = `logos/${uniqueId}-${sanitized}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(CLUB_LOGO_BUCKET).upload(path, logoFile, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message ?? "Unable to upload club logo.");
    }

    const { data } = supabase.storage.from(CLUB_LOGO_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  };

  const handleCreateClub = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    if (!createForm.name.trim()) {
      setCreateError("Club name is required.");
      return;
    }

    setCreateSubmitting(true);
    try {
      const logoUrl = await uploadClubLogo();
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        day: createForm.day.trim() || null,
        time: createForm.time.trim() || null,
        location: createForm.location.trim() || null,
        cover_image_url: logoUrl,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from("clubs").insert([payload]);

      if (insertError) {
        throw new Error(insertError.message ?? "Unable to create club.");
      }

      toast({
        title: "Club created",
        description: `${payload.name} has been added.`,
      });
      resetCreateClubForm();
      setCreateSheetOpen(false);
      await fetchClubs();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to create club.";
      setCreateError(message);
      toast({
        title: "Unable to create club",
        description: message,
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

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
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Club roster</CardTitle>
            <p className="text-sm text-muted-foreground">
              Live data pulled directly from the Connect Camp Supabase project.
            </p>
          </div>
          <Sheet open={createSheetOpen} onOpenChange={(open) => {
            setCreateSheetOpen(open);
            if (!open) {
              resetCreateClubForm();
            }
          }}>
            <SheetTrigger asChild>
              <Button className="rounded-full">Add New Club</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Create a new club</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Fill out the form to publish a new organization to the roster.
                </p>
              </SheetHeader>
              <form className="mt-6 space-y-4" onSubmit={handleCreateClub}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Club name *</label>
                  <Input
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Outdoor Adventure Society"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Textarea
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Share a short summary"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Meeting day</label>
                    <Input
                      value={createForm.day}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, day: event.target.value }))
                      }
                      placeholder="Thursdays"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Meeting time</label>
                    <Input
                      value={createForm.time}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, time: event.target.value }))
                      }
                      placeholder="6:00 PM"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Room / Location</label>
                  <Input
                    value={createForm.location}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, location: event.target.value }))
                    }
                    placeholder="Student Center, Room 203"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Upload club logo</label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                  />
                  {logoFile && (
                    <p className="text-xs text-muted-foreground">Selected file: {logoFile.name}</p>
                  )}
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <SheetFooter className="gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateSheetOpen(false);
                      resetCreateClubForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSubmitting}>
                    {createSubmitting ? "Creating..." : "Create Club"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </CardHeader>
        <CardContent>{content()}</CardContent>
      </Card>
    </div>
  );
}

export default Clubs;

const ClubCard = ({ club }: { club: Club }) => {
  const memberCount = useRealtimeMembers(club.id);
  const logoUrl = club.cover_image_url;
  const meetingDay = club.day ?? "TBD";
  const meetingTime = club.time ?? "TBD";
  const clubLocation = club.location ?? "TBD";

  return (
    <article className="overflow-hidden rounded-xl border bg-background/80 shadow-sm">
      {logoUrl ? (
        <img src={logoUrl} alt={club.name} className="h-32 w-full object-cover" />
      ) : (
        <div className="h-32 w-full bg-muted" />
      )}
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{club.name}</p>
            <p className="text-sm text-muted-foreground">{club.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {!club.approved && (
              <Badge variant="destructive" className="shrink-0">
                Pending
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-border/60 text-foreground hover:bg-muted/50"
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-transparent bg-violet-100 text-violet-600 hover:bg-violet-200"
            >
              Manage
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Members</p>
            <p className="text-lg font-semibold">{memberCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Meeting time</p>
            <p className="font-medium">
              {meetingDay} • {meetingTime}
            </p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">Location: {clubLocation}</div>
      </div>
    </article>
  );
};
