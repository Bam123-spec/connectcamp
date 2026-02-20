import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskCompletion,
  type Task,
  type CreateTaskPayload,
} from "@/lib/tasksApi";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Tasks() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await getAllTasks();
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (payload: CreateTaskPayload) => {
    try {
      const newTask = await createTask(payload);
      setTasks((prev) => [...prev, newTask]);
      toast({
        title: "Task created",
        description: "New task has been added successfully.",
      });
    } catch (error) {
      console.error("Failed to create task:", error);
      toast({
        title: "Error",
        description: "Failed to create task.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateTask = async (payload: CreateTaskPayload) => {
    if (!editingTask) return;
    try {
      const updated = await updateTask(editingTask.id, payload);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast({
        title: "Task updated",
        description: "Task details have been updated.",
      });
    } catch (error) {
      console.error("Failed to update task:", error);
      toast({
        title: "Error",
        description: "Failed to update task.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast({
        title: "Task deleted",
        description: "Task has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task.",
        variant: "destructive",
      });
    }
  };

  const handleToggleCompletion = async (task: Task) => {
    try {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_completed: !t.is_completed } : t))
      );

      await toggleTaskCompletion(task.id, !task.is_completed);
    } catch (error) {
      console.error("Failed to toggle completion:", error);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_completed: task.is_completed } : t))
      );
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      });
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

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">
            Manage and track responsibilities for your team.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-gray-50/50 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Plus className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No tasks yet</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Get started by creating a new task to track your team's progress.
          </p>
          <Button onClick={openCreateDialog} variant="outline" className="mt-6">
            Create your first task
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={openEditDialog}
              onDelete={handleDeleteTask}
              onToggleCompletion={handleToggleCompletion}
            />
          ))}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        initialData={editingTask}
        mode={editingTask ? "edit" : "create"}
      />
    </div>
  );
}
