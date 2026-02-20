import type { Task } from "@/lib/tasksApi";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/formatDate";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TaskCardProps {
    task: Task;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
    onToggleCompletion: (task: Task) => void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleCompletion }: TaskCardProps) {
    return (
        <div
            className={cn(
                "group flex items-start gap-4 rounded-xl border bg-white p-4 transition-all hover:shadow-md",
                task.is_completed ? "border-gray-100 bg-gray-50/50" : "border-gray-200"
            )}
        >
            <button
                onClick={() => onToggleCompletion(task)}
                className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    task.is_completed
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 text-transparent hover:border-primary"
                )}
            >
                <CheckCircle2 className="h-3.5 w-3.5" />
            </button>

            <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <h3
                        className={cn(
                            "font-medium leading-none transition-colors",
                            task.is_completed ? "text-gray-500 line-through" : "text-gray-900"
                        )}
                    >
                        {task.title}
                    </h3>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 -mr-2 -mt-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(task)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => onDelete(task)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {task.description && (
                    <p
                        className={cn(
                            "text-sm line-clamp-2",
                            task.is_completed ? "text-gray-400" : "text-gray-500"
                        )}
                    >
                        {task.description}
                    </p>
                )}

                {task.due_date && (
                    <div
                        className={cn(
                            "flex items-center gap-1.5 text-xs pt-1",
                            task.is_completed ? "text-gray-400" : "text-gray-500"
                        )}
                    >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Due {formatDate(task.due_date)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
