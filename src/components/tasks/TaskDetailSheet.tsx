import { useState } from "react";
import { format } from "date-fns";
import { AlertCircle, CalendarDays, Clock3, MessageSquareText, Send, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Task, TaskComment, TaskStatus } from "@/lib/tasksApi";
import { cn } from "@/lib/utils";

interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  comments: TaskComment[];
  commentsLoading: boolean;
  onAddComment: (body: string) => Promise<void>;
  onStatusChange: (status: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => Promise<void>;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_club", label: "Waiting on club" },
  { value: "waiting_on_admin", label: "Waiting on admin" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];

function priorityTone(priority: Task["priority"]) {
  if (priority === "urgent") return "bg-red-100 text-red-700";
  if (priority === "high") return "bg-orange-100 text-orange-700";
  if (priority === "low") return "bg-slate-100 text-slate-700";
  return "bg-blue-100 text-blue-700";
}

function statusTone(status: Task["status"]) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "blocked") return "bg-red-100 text-red-700";
  if (status === "waiting_on_club") return "bg-amber-100 text-amber-700";
  if (status === "waiting_on_admin") return "bg-indigo-100 text-indigo-700";
  if (status === "in_progress") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function formatStatus(status: Task["status"]) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  comments,
  commentsLoading,
  onAddComment,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskDetailSheetProps) {
  const [commentBody, setCommentBody] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (!task) return null;

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      await onAddComment(commentBody);
      setCommentBody("");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setUpdatingStatus(true);
    try {
      await onStatusChange(status as TaskStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const isOverdue = task.due_date && task.status !== "completed" && new Date(task.due_date).getTime() < Date.now();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-slate-200 bg-white p-0 sm:max-w-[620px]">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
          <SheetHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-0", statusTone(task.status))}>{formatStatus(task.status)}</Badge>
              <Badge className={cn("border-0", priorityTone(task.priority))}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority
              </Badge>
              {task.club && <Badge variant="outline">{task.club.name}</Badge>}
              {task.collaborating_clubs.length > 0 && (
                <Badge variant="outline">+{task.collaborating_clubs.length} collaborator clubs</Badge>
              )}
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-2xl">{task.title}</SheetTitle>
              <SheetDescription>
                {task.description?.trim() || "No description added yet."}
              </SheetDescription>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Assignee</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-950">
                    {task.assigned_to_profile?.full_name || task.assigned_to_profile?.email || "Unassigned"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {task.assigned_to_profile?.role === "admin" ? "Student Life admin" : "Club officer"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Timeline</p>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <span>
                    {task.due_date ? `Due ${format(new Date(task.due_date), "MMM d, yyyy")}` : "No due date set"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  <span>Updated {format(new Date(task.updated_at), "MMM d, yyyy h:mm a")}</span>
                </div>
                {isOverdue && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>This task is overdue.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_220px]">
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Collaboration</p>
                <div className="flex flex-wrap gap-2">
                  {task.club && <Badge variant="outline">{task.club.name}</Badge>}
                  {task.collaborating_clubs.map((club) => (
                    <Badge key={club.id} variant="outline">
                      {club.name}
                    </Badge>
                  ))}
                  {!task.club && task.collaborating_clubs.length === 0 && (
                    <span className="text-sm text-slate-500">No clubs linked to this task yet.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Task brief</p>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {task.description?.trim() || "No description provided yet."}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick actions</p>
              <div className="space-y-2">
                <Select value={task.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Update status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="w-full" onClick={() => onEdit(task)}>
                  Edit task
                </Button>
                <Button variant="outline" className="w-full text-red-600 hover:text-red-700" onClick={() => onDelete(task)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete task
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Comments</h3>
            </div>

            <div className="space-y-3">
              {commentsLoading ? (
                <p className="text-sm text-slate-500">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-slate-500">No comments yet. Use this thread for admin-officer handoff notes.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">
                          {comment.author?.full_name || comment.author?.email || "Unknown author"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(comment.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <Badge variant="outline">{comment.author?.role || "member"}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{comment.body}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <Textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Add a progress note, blocker, or handoff update..."
                className="min-h-[110px]"
              />
              <div className="flex justify-end">
                <Button onClick={handleAddComment} disabled={submittingComment || !commentBody.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  {submittingComment ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
