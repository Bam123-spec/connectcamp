import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const statusOptions = [
  {
    value: "pending",
    label: "Upcoming",
    badgeClass: "bg-purple-100 text-purple-700 border-transparent",
  },
  {
    value: "approved",
    label: "Approved",
    badgeClass: "bg-green-600 text-white border-transparent",
  },
];

function CreateEvent() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const { error: supabaseError } = await supabase.from("events").insert({
      name,
      description,
      day,
      time,
      location,
      cover_image_url: coverImage,
      approved: status === "approved",
    });

    setSaving(false);

    if (supabaseError) {
      setError(supabaseError.message);
      return;
    }

    navigate("/events");
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="rounded-full" onClick={() => navigate(-1)}>
        ← Back to events
      </Button>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Create event</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add a new program to the Connect Camp calendar.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Event name</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Glow & Grow Workshop"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Event description</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the purpose, key activities, and audience for this event."
                required
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Day</label>
                <Input value={day} onChange={(event) => setDay(event.target.value)} placeholder="Friday, March 21" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Time</label>
                <Input value={time} onChange={(event) => setTime(event.target.value)} placeholder="3:00 – 4:30 PM" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Community Commons, Room 204"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cover image URL</label>
              <Input value={coverImage} onChange={(event) => setCoverImage(event.target.value)} placeholder="https://" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <div className="flex gap-3">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatus(option.value)}
                    className={`rounded-full border px-3 py-1 text-sm shadow-sm transition ${
                      status === option.value ? "border-foreground" : "border-muted"
                    }`}
                  >
                    <Badge className={option.badgeClass}>{option.label}</Badge>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
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
