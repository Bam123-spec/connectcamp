import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { useRealtimeMembers } from "@/hooks/useRealtimeMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { TimePicker } from "@/components/ui/time-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
  time: string;
  location: string;
};

const initialCreateClubState: CreateClubForm = {
  name: "",
  description: "",
  time: "",
  location: "",
};

function Clubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateClubForm>(initialCreateClubState);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);

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

  const resetForm = () => {
    setCreateForm(initialCreateClubState);
    setDate(undefined);
    setLogoUrl("");
    setCreateError(null);
    setEditingClub(null);
  };

  const handleEditClub = (club: Club) => {
    setEditingClub(club);
    setCreateForm({
      name: club.name,
      description: club.description || "",
      time: club.time || "",
      location: club.location || "",
    });

    if (club.day) {
      // Assuming day is stored as YYYY-MM-DD
      try {
        const parsedDate = parse(club.day, "yyyy-MM-dd", new Date());
        if (isValid(parsedDate)) {
          setDate(parsedDate);
        } else {
          setDate(undefined);
        }
      } catch (e) {
        console.error("Failed to parse date", e);
        setDate(undefined);
      }
    } else {
      setDate(undefined);
    }

    setLogoUrl(club.cover_image_url || "");
    setSheetOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

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
      };

      let error;

      if (editingClub) {
        const { error: updateError } = await supabase
          .from("clubs")
          .update({ ...payload })
          .eq("id", editingClub.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("clubs")
          .insert([{ ...payload, created_at: new Date().toISOString() }]);
        error = insertError;
      }

      if (error) {
        throw new Error(error.message ?? `Unable to ${editingClub ? "update" : "create"} club.`);
      }

      toast({
        title: `Club ${editingClub ? "updated" : "created"}`,
        description: `${payload.name} has been ${editingClub ? "updated" : "added"}.`,
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
          <ClubCard key={club.id} club={club} onEdit={() => handleEditClub(club)} />
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
          <Sheet open={sheetOpen} onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) {
              resetForm();
            }
          }}>
            <SheetTrigger asChild>
              <Button className="rounded-full">Add New Club</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>{editingClub ? "Edit club" : "Create a new club"}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {editingClub
                    ? "Update the details for this organization."
                    : "Fill out the form to publish a new organization to the roster."}
                </p>
              </SheetHeader>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
                  <div className="space-y-2 flex flex-col">
                    <label className="text-sm font-medium text-foreground">Meeting day</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={setDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Meeting time</label>
                    <TimePicker
                      value={createForm.time}
                      onChange={(value) =>
                        setCreateForm((prev) => ({ ...prev, time: value }))
                      }
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
                  <ImageUpload
                    value={logoUrl}
                    onChange={setLogoUrl}
                    bucket="club-logos"
                  />
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <SheetFooter className="gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSheetOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : (editingClub ? "Save Changes" : "Create Club")}
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

const ClubCard = ({ club, onEdit }: { club: Club; onEdit: () => void }) => {
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
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-transparent bg-violet-100 text-violet-600 hover:bg-violet-200"
              onClick={() => window.location.href = `/clubs/manage?id=${club.id}`}
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
