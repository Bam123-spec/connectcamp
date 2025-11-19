import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

const statusOptions = ["Pending", "In progress", "Completed"];

function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Pending");

  useEffect(() => {
    let active = true;

    const fetchTasks = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        setTasks(data ?? []);
        setError(null);
      }

      setLoading(false);
    };

    fetchTasks();

    return () => {
      active = false;
    };
  }, []);

  const refreshTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks(data ?? []);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("tasks").insert({
      title,
      description,
      status,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    setStatus("Pending");
    setShowForm(false);
    await refreshTasks();
  };

  const badgeClass = (state: string) => {
    if (state === "Completed") return "bg-green-600 text-white border-transparent";
    if (state === "In progress") return "bg-amber-200 text-amber-900 border-transparent";
    return "border border-border text-foreground";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tasks</h2>
          <p className="text-sm text-muted-foreground">
            Upcoming responsibilities for the Connect Camp admins.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((value) => !value)}>
          {showForm ? "Cancel" : "Create task"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Task title</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Review submissions" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain what needs to happen and any context for other admins."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save task"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{task.title}</p>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
                <Badge className={badgeClass(task.status)}>{task.status}</Badge>
              </div>
            </div>
          ))}
          {!tasks.length && (
            <p className="text-sm text-muted-foreground">No tasks yet. Click “Create task” to add one.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Tasks;
