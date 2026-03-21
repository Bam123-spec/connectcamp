import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Task, TaskClub, TaskPriority, TaskStatus, TaskUser } from "@/lib/tasksApi";

type TaskDialogPayload = {
  title: string;
  description?: string;
  due_date?: string | null;
  club_id?: string | null;
  assigned_to?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  collaborating_club_ids: string[];
};

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: TaskDialogPayload) => Promise<void>;
  initialData?: Task | null;
  mode: "create" | "edit";
  clubs: TaskClub[];
  users: TaskUser[];
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_club", label: "Waiting on club" },
  { value: "waiting_on_admin", label: "Waiting on admin" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TaskDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode,
  clubs,
  users,
}: TaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [clubId, setClubId] = useState<string>("workspace");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [status, setStatus] = useState<TaskStatus>("not_started");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [collaboratingClubIds, setCollaboratingClubIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && initialData && mode === "edit") {
      setTitle(initialData.title);
      setDescription(initialData.description ?? "");
      setDate(initialData.due_date ? new Date(initialData.due_date) : undefined);
      setClubId(initialData.club_id ?? "workspace");
      setAssignedTo(initialData.assigned_to ?? "unassigned");
      setStatus(initialData.status);
      setPriority(initialData.priority);
      setCollaboratingClubIds(initialData.collaborating_club_ids ?? []);
      return;
    }

    if (open) {
      setTitle("");
      setDescription("");
      setDate(undefined);
      setClubId("workspace");
      setAssignedTo("unassigned");
      setStatus("not_started");
      setPriority("medium");
      setCollaboratingClubIds([]);
    }
  }, [open, initialData, mode]);

  const availableCollaboratorClubs = useMemo(
    () => clubs.filter((club) => club.id !== clubId),
    [clubs, clubId],
  );

  const handleToggleCollaboratingClub = (targetClubId: string, checked: boolean) => {
    setCollaboratingClubIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, targetClubId]));
      }
      return prev.filter((club) => club !== targetClubId);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onSubmit({
        title,
        description: description || undefined,
        due_date: date ? date.toISOString() : null,
        club_id: clubId === "workspace" ? null : clubId,
        assigned_to: assignedTo === "unassigned" ? null : assignedTo,
        status,
        priority,
        collaborating_club_ids: collaboratingClubIds,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create coordination task" : "Edit task"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Capture ownership, assignee, and handoff status so clubs and Student Life can work from the same source of truth."
                : "Update the task details, owners, and handoff state."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-5">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Prepare spring budget packet"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add context, dependencies, or instructions for the receiving club or admin."
                className="min-h-[120px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Owning club</Label>
                <Select value={clubId} onValueChange={setClubId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a club owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">Workspace-wide / Student Life</SelectItem>
                    {clubs.map((club) => (
                      <SelectItem key={club.id} value={club.id}>
                        {club.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Assigned to</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email || "Unnamed user"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-1">
                <Label>Collaborating clubs</Label>
                <p className="text-sm text-slate-500">
                  Include other clubs if this task needs joint delivery, review, or handoff coordination.
                </p>
              </div>

              {availableCollaboratorClubs.length === 0 ? (
                <p className="text-sm text-slate-500">No additional clubs available.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {availableCollaboratorClubs.map((club) => {
                    const checked = collaboratingClubIds.includes(club.id);
                    return (
                      <label
                        key={club.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => handleToggleCollaboratingClub(club.id, Boolean(value))}
                        />
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium text-slate-900">{club.name}</span>
                          <p className="text-xs text-slate-500">Let this club see and work this task.</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : mode === "create" ? "Create Task" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
