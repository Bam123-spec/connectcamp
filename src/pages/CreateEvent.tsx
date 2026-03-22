import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ChevronLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { logAuditEventSafe } from "@/lib/auditApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ImageUpload";
import { TimePicker } from "@/components/ui/time-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ClubOption = {
  id: string;
  name: string;
};

function CreateEvent() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;

  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [clubId, setClubId] = useState("workspace");
  const [status, setStatus] = useState<"approved" | "pending">("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;

    let active = true;
    const loadClubs = async () => {
      const { data, error: clubsError } = await supabase
        .from("clubs")
        .select("id, name")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (!active || clubsError) return;
      setClubs((data ?? []) as ClubOption[]);
    };

    loadClubs();
    return () => {
      active = false;
    };
  }, [orgId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!orgId) {
      setError("This admin account is missing an organization context.");
      return;
    }

    if (!name.trim()) {
      setError("Event name is required.");
      return;
    }

    setSaving(true);

    const { data, error: supabaseError } = await supabase.from("events").insert({
      name: name.trim(),
      description: description.trim() || null,
      date: date ? format(date, "yyyy-MM-dd") : null,
      time: time.trim() || null,
      location: location.trim() || null,
      cover_image_url: coverImage || null,
      club_id: clubId === "workspace" ? null : clubId,
      approved: status === "approved" ? true : null,
      created_at: new Date().toISOString(),
    }).select("id").single();

    setSaving(false);

    if (supabaseError) {
      setError(supabaseError.message);
      return;
    }

    void logAuditEventSafe({
      orgId,
      category: "events",
      action: "event_created",
      entityType: "event",
      entityId: (data as { id: string } | null)?.id ?? null,
      title: "Event created",
      summary: `${name.trim()} was created from the dedicated event setup page.`,
      metadata: {
        status,
        club_id: clubId === "workspace" ? null : clubId,
        location: location.trim() || null,
        date: date ? format(date, "yyyy-MM-dd") : null,
        time: time.trim() || null,
      },
    });
    navigate("/events");
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="rounded-full" onClick={() => navigate("/events")}>
        <ChevronLeft className="h-4 w-4" />
        Back to events
      </Button>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_42%,#eff6ff_100%)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Create Event</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Set up the event clearly the first time.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Give Student Life and club officers the basics they need: owner, approval state, timing, location, and a clean event description.
          </p>
        </div>
      </section>

      <Card className="max-w-4xl rounded-[28px] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">Event details</CardTitle>
          <CardDescription>Everything here feeds the event operations workspace and the student-facing event experience.</CardDescription>
        </CardHeader>
        <CardContent className="border-t border-slate-200 pt-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Event name *</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Glow & Grow Workshop"
                required
                className="h-11 rounded-2xl border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Event description</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the purpose, audience, and what students should expect."
                rows={5}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Owning club</label>
                <Select value={clubId} onValueChange={setClubId}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="Choose a club owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">Student Life / unassigned</SelectItem>
                    {clubs.map((club) => (
                      <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Approval state</label>
                <Select value={status} onValueChange={(value) => setStatus(value as "approved" | "pending")}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="Choose approval state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 flex flex-col">
                <label className="text-sm font-medium">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarClock className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Time</label>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Community Commons, Room 204"
                className="h-11 rounded-2xl border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cover image</label>
              <ImageUpload value={coverImage} onChange={setCoverImage} bucket="events" />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate("/events")}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Create event"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default CreateEvent;
