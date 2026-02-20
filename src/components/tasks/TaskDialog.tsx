import { useEffect, useState } from "react";
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
import type { CreateTaskPayload, Task } from "@/lib/tasksApi";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface TaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (task: CreateTaskPayload) => Promise<void>;
    initialData?: Task | null;
    mode: "create" | "edit";
}

export function TaskDialog({
    open,
    onOpenChange,
    onSubmit,
    initialData,
    mode,
}: TaskDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && initialData && mode === "edit") {
            setTitle(initialData.title);
            setDescription(initialData.description ?? "");
            if (initialData.due_date) {
                setDate(new Date(initialData.due_date));
            } else {
                setDate(undefined);
            }
        } else if (open && mode === "create") {
            setTitle("");
            setDescription("");
            setDate(undefined);
        }
    }, [open, initialData, mode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await onSubmit({
                title,
                description: description || undefined,
                due_date: date ? date.toISOString() : undefined,
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to submit task:", error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{mode === "create" ? "Add New Task" : "Edit Task"}</DialogTitle>
                        <DialogDescription>
                            {mode === "create"
                                ? "Create a new task for your team."
                                : "Update the details of this task."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Prepare budget report"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add details about this task..."
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Due Date</Label>
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
