import { supabase } from "@/lib/supabaseClient";

export type Task = {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    is_completed: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateTaskPayload = {
    title: string;
    description?: string;
    due_date?: string;
};

export type UpdateTaskPayload = Partial<CreateTaskPayload>;

export async function getAllTasks(): Promise<Task[]> {
    const { data, error } = await supabase
        .from("club_tasks")
        .select("*")
        .order("due_date", { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
    const { data, error } = await supabase
        .from("club_tasks")
        .insert({
            title: payload.title,
            description: payload.description,
            due_date: payload.due_date,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
    const { data, error } = await supabase
        .from("club_tasks")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function toggleTaskCompletion(id: string, is_completed: boolean): Promise<Task> {
    const { data, error } = await supabase
        .from("club_tasks")
        .update({ is_completed })
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from("club_tasks").delete().eq("id", id);
    if (error) throw error;
}
