import { useEffect, useMemo, useState } from "react";
import { format, isBefore, startOfToday } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  Layers3,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { logAuditEventSafe } from "@/lib/auditApi";
import {
  addTaskComment,
  createTask,
  deleteTask,
  getAllTasks,
  getTaskComments,
  getTaskWorkspaceDirectory,
  setTaskStatus,
  updateTask,
  type Task,
  type TaskComment,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasksApi";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";

type FocusFilter = "all" | "needs_attention" | "mine" | "overdue" | "completed";

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting_on_club: "Waiting on club",
  waiting_on_admin: "Waiting on admin",
  blocked: "Blocked",
  completed: "Completed",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function statusTone(status: TaskStatus) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "blocked") return "bg-red-100 text-red-700 border-transparent";
  if (status === "waiting_on_club") return "bg-amber-100 text-amber-700 border-transparent";
  if (status === "waiting_on_admin") return "bg-indigo-100 text-indigo-700 border-transparent";
  if (status === "in_progress") return "bg-sky-100 text-sky-700 border-transparent";
  return "bg-slate-100 text-slate-700 border-transparent";
}

function priorityTone(priority: TaskPriority) {
  if (priority === "urgent") return "bg-red-100 text-red-700 border-transparent";
  if (priority === "high") return "bg-orange-100 text-orange-700 border-transparent";
  if (priority === "low") return "bg-slate-100 text-slate-700 border-transparent";
  return "bg-blue-100 text-blue-700 border-transparent";
}

function taskIsOverdue(task: Task) {
  if (!task.due_date || task.status === "completed") return false;
  return isBefore(new Date(task.due_date), startOfToday());
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    const leftDue = left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftDue !== rightDue) return leftDue - rightDue;
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

export default function Tasks() {
  const { toast } = useToast();
  const { profile } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<
    Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null; role: string | null; club_id: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailComments, setDetailComments] = useState<TaskComment[]>([]);
  const [detailCommentsLoading, setDetailCommentsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      const [taskRows, directory] = await Promise.all([getAllTasks(), getTaskWorkspaceDirectory()]);
      setTasks(taskRows);
      setClubs(directory.clubs);
      setUsers(directory.users);
    } catch (error: any) {
      toast({
        title: "Error loading tasks",
        description: error.message || "Failed to load tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      setDetailCommentsLoading(true);
      const comments = await getTaskComments(taskId);
      setDetailComments(comments);
    } catch (error: any) {
      toast({
        title: "Error loading comments",
        description: error.message || "Task comments could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setDetailCommentsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const openTaskDetail = (task: Task) => {
    setDetailTask(task);
    setDetailOpen(true);
    setDetailComments([]);
    void loadTaskComments(task.id);
  };

  const syncTaskInState = (updatedTask: Task) => {
    setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
    setDetailTask((prev) => (prev?.id === updatedTask.id ? updatedTask : prev));
  };

  const handleCreateTask = async (payload: {
    title: string;
    description?: string;
    due_date?: string | null;
    club_id?: string | null;
    assigned_to?: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    collaborating_club_ids: string[];
  }) => {
    if (!profile?.id) {
      throw new Error("You must be signed in to create tasks.");
    }

    const newTask = await createTask({
      ...payload,
      created_by: profile.id,
    });

    setTasks((prev) => sortTasks([newTask, ...prev]));
    void logAuditEventSafe({
      orgId: profile?.org_id,
      category: "tasks",
      action: "task_created",
      entityType: "task",
      entityId: newTask.id,
      title: "Task created",
      summary: `${newTask.title} was added to the task workspace.`,
      metadata: {
        status: newTask.status,
        priority: newTask.priority,
        club_name: newTask.club?.name ?? null,
        assigned_to: newTask.assigned_to_profile?.email ?? null,
      },
    });
    toast({
      title: "Task created",
      description: "The coordination task has been added to the workspace.",
    });
  };

  const handleUpdateTask = async (payload: {
    title: string;
    description?: string;
    due_date?: string | null;
    club_id?: string | null;
    assigned_to?: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    collaborating_club_ids: string[];
  }) => {
    if (!editingTask) return;
    const updated = await updateTask(editingTask.id, payload);
    syncTaskInState(updated);
    void logAuditEventSafe({
      orgId: profile?.org_id,
      category: "tasks",
      action: "task_updated",
      entityType: "task",
      entityId: updated.id,
      title: "Task updated",
      summary: `${updated.title} was updated in the task workspace.`,
      metadata: {
        status: updated.status,
        priority: updated.priority,
        club_name: updated.club?.name ?? null,
        assigned_to: updated.assigned_to_profile?.email ?? null,
      },
    });
    toast({
      title: "Task updated",
      description: "The task details and ownership were updated.",
    });
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm("Delete this task? This will also remove its comment thread.")) return;

    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((entry) => entry.id !== task.id));
      if (detailTask?.id === task.id) {
        setDetailOpen(false);
        setDetailTask(null);
        setDetailComments([]);
      }
      void logAuditEventSafe({
        orgId: profile?.org_id,
        category: "tasks",
        action: "task_deleted",
        entityType: "task",
        entityId: task.id,
        title: "Task deleted",
        summary: `${task.title} was removed from the task workspace.`,
        metadata: {
          status: task.status,
          priority: task.priority,
          club_name: task.club?.name ?? null,
        },
      });
      toast({
        title: "Task deleted",
        description: "The task and its collaboration thread were removed.",
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Unable to delete this task.",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const updated = await setTaskStatus(task.id, status);
      syncTaskInState(updated);
      void logAuditEventSafe({
        orgId: profile?.org_id,
        category: "tasks",
        action: "task_status_updated",
        entityType: "task",
        entityId: updated.id,
        title: "Task status changed",
        summary: `${updated.title} moved to ${STATUS_LABELS[status].toLowerCase()}.`,
        metadata: {
          previous_status: task.status,
          next_status: status,
        },
      });
      toast({
        title: "Status updated",
        description: `Task moved to ${STATUS_LABELS[status].toLowerCase()}.`,
      });
    } catch (error: any) {
      toast({
        title: "Status update failed",
        description: error.message || "Unable to update the task status.",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = async (body: string) => {
    if (!detailTask || !profile?.id) {
      throw new Error("You must be signed in to comment.");
    }

    const comment = await addTaskComment(detailTask.id, profile.id, body);
    setDetailComments((prev) => [...prev, comment]);
    void logAuditEventSafe({
      orgId: profile?.org_id,
      category: "tasks",
      action: "task_comment_added",
      entityType: "task",
      entityId: detailTask.id,
      title: "Task comment added",
      summary: `A comment was added to ${detailTask.title}.`,
      metadata: {
        comment_length: body.trim().length,
      },
    });
    toast({
      title: "Comment posted",
      description: "The task thread has been updated.",
    });
  };

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (clubFilter !== "all") {
        const clubIds = [task.club_id, ...task.collaborating_club_ids].filter(Boolean);
        if (!clubIds.includes(clubFilter)) return false;
      }

      if (focusFilter === "needs_attention" && !["not_started", "blocked", "waiting_on_club", "waiting_on_admin"].includes(task.status)) {
        return false;
      }
      if (focusFilter === "mine" && task.assigned_to !== profile?.id && task.created_by !== profile?.id) {
        return false;
      }
      if (focusFilter === "overdue" && !taskIsOverdue(task)) {
        return false;
      }
      if (focusFilter === "completed" && task.status !== "completed") {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        task.title,
        task.description ?? "",
        task.club?.name ?? "",
        task.assigned_to_profile?.full_name ?? "",
        task.assigned_to_profile?.email ?? "",
        STATUS_LABELS[task.status],
        PRIORITY_LABELS[task.priority],
        ...task.collaborating_clubs.map((club) => club.name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [clubFilter, focusFilter, profile?.id, searchQuery, statusFilter, tasks]);

  const taskMetrics = useMemo(() => {
    const overdueCount = tasks.filter(taskIsOverdue).length;
    const waitingOnClubsCount = tasks.filter((task) => task.status === "waiting_on_club").length;
    const waitingOnAdminsCount = tasks.filter((task) => task.status === "waiting_on_admin").length;
    const completedCount = tasks.filter((task) => task.status === "completed").length;

    return [
      {
        label: "Overdue",
        value: overdueCount,
        helper: "Tasks past due and still unresolved",
        icon: AlertTriangle,
        tone: "bg-red-50 text-red-700",
      },
      {
        label: "Waiting on clubs",
        value: waitingOnClubsCount,
        helper: "Handoffs currently blocked on club action",
        icon: LockKeyhole,
        tone: "bg-amber-50 text-amber-700",
      },
      {
        label: "Waiting on admin",
        value: waitingOnAdminsCount,
        helper: "Officer requests currently sitting with Student Life",
        icon: CalendarClock,
        tone: "bg-indigo-50 text-indigo-700",
      },
      {
        label: "Completed",
        value: completedCount,
        helper: "Tasks that already reached done status",
        icon: CheckCircle2,
        tone: "bg-emerald-50 text-emerald-700",
      },
    ];
  }, [tasks]);

  const lanes = useMemo(() => {
    const grouped = {
      attention: sortTasks(
        filteredTasks.filter((task) =>
          ["not_started", "blocked", "waiting_on_club", "waiting_on_admin"].includes(task.status),
        ),
      ),
      motion: sortTasks(filteredTasks.filter((task) => task.status === "in_progress")),
      done: sortTasks(filteredTasks.filter((task) => task.status === "completed")),
    };

    return [
      {
        key: "attention",
        title: "Needs Attention",
        description: "Fresh work, blockers, and waiting handoffs.",
        tone: "from-amber-50 to-red-50",
        tasks: grouped.attention,
      },
      {
        key: "motion",
        title: "In Motion",
        description: "Tasks actively being worked now.",
        tone: "from-sky-50 to-indigo-50",
        tasks: grouped.motion,
      },
      {
        key: "done",
        title: "Done",
        description: "Completed tasks and recent finishes.",
        tone: "from-emerald-50 to-white",
        tasks: grouped.done,
      },
    ];
  }, [filteredTasks]);

  return (
    <div className="space-y-6 pb-8">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_38%),linear-gradient(135deg,_#0f172a_0%,_#1e293b_46%,_#eff6ff_100%)] px-6 py-7 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100">
                Task Workspace
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">Coordinate work across Student Life and clubs</h1>
                <p className="max-w-xl text-sm leading-6 text-slate-200">
                  Assign ownership, track handoffs, and keep club officers and admins aligned on what is blocked,
                  what is due next, and what still needs attention.
                </p>
              </div>
            </div>

            <Button onClick={openCreateDialog} className="h-11 rounded-xl bg-white text-slate-950 hover:bg-slate-100">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {taskMetrics.map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-200">{metric.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{metric.value}</p>
                    </div>
                    <div className={`rounded-2xl p-2 ${metric.tone}`}>
                      <MetricIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-200/90">{metric.helper}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title, club, assignee, status, or priority"
                className="h-11 rounded-xl border-slate-200 pl-10"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={clubFilter} onValueChange={setClubFilter}>
                <SelectTrigger className="min-w-[180px]">
                  <SelectValue placeholder="Filter by club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clubs</SelectItem>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All work" },
              { key: "needs_attention", label: "Needs attention" },
              { key: "mine", label: "Assigned to me / created by me" },
              { key: "overdue", label: "Overdue" },
              { key: "completed", label: "Completed" },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setFocusFilter(filter.key as FocusFilter)}
                className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                  focusFilter === filter.key
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading task workspace...
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">No tasks match this workspace view</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Adjust the filters, search for a specific club or assignee, or create a new task to start coordinating work.
            </p>
            <Button onClick={openCreateDialog} variant="outline" className="mt-6">
              Create task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {lanes.map((lane) => (
            <Card key={lane.key} className="border-slate-200 shadow-sm">
              <CardHeader className={`rounded-t-3xl bg-gradient-to-br ${lane.tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{lane.title}</CardTitle>
                    <CardDescription>{lane.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{lane.tasks.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {lane.tasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No tasks in this lane.
                  </div>
                ) : (
                  lane.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTaskDetail(task)}
                      className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={statusTone(task.status)}>{STATUS_LABELS[task.status]}</Badge>
                            <Badge className={priorityTone(task.priority)}>{PRIORITY_LABELS[task.priority]}</Badge>
                            {taskIsOverdue(task) && <Badge className="bg-red-100 text-red-700">Overdue</Badge>}
                          </div>
                          <h3 className="text-base font-semibold text-slate-950">{task.title}</h3>
                        </div>
                        <ArrowRight className="mt-0.5 h-4 w-4 text-slate-400" />
                      </div>

                      {task.description && (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{task.description}</p>
                      )}

                      <div className="mt-4 space-y-2 text-sm text-slate-500">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1.5">
                            <Layers3 className="h-4 w-4 text-slate-400" />
                            {task.club?.name || "Workspace-wide"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="h-4 w-4 text-slate-400" />
                            {task.assigned_to_profile?.full_name || task.assigned_to_profile?.email || "Unassigned"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-4 w-4 text-slate-400" />
                            {task.due_date ? `Due ${format(new Date(task.due_date), "MMM d")}` : "No due date"}
                          </span>
                          {task.collaborating_clubs.length > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <CircleDot className="h-4 w-4 text-slate-400" />
                              {task.collaborating_clubs.length} collaborator club{task.collaborating_clubs.length === 1 ? "" : "s"}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <MessageSquareText className="h-4 w-4 text-slate-400" />
                            Open thread
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        initialData={editingTask}
        mode={editingTask ? "edit" : "create"}
        clubs={clubs}
        users={users}
      />

      <TaskDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        task={detailTask}
        comments={detailComments}
        commentsLoading={detailCommentsLoading}
        onAddComment={handleAddComment}
        onStatusChange={(status) => (detailTask ? handleStatusChange(detailTask, status) : Promise.resolve())}
        onEdit={(task) => {
          setDetailOpen(false);
          openEditDialog(task);
        }}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}
