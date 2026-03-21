import { supabase } from "@/lib/supabaseClient";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "waiting_on_club"
  | "waiting_on_admin"
  | "blocked"
  | "completed";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskClub = {
  id: string;
  name: string;
};

export type TaskUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  club_id: string | null;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: TaskUser | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  completed_at: string | null;
  club_id: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  collaborating_club_ids: string[];
  club: TaskClub | null;
  assigned_to_profile: TaskUser | null;
  created_by_profile: TaskUser | null;
  collaborating_clubs: TaskClub[];
};

export type TaskWorkspaceOptions = {
  clubs: TaskClub[];
  users: TaskUser[];
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  due_date?: string | null;
  club_id?: string | null;
  assigned_to?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  collaborating_club_ids?: string[];
  created_by: string;
};

export type UpdateTaskPayload = Partial<Omit<CreateTaskPayload, "created_by">>;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  completed_at: string | null;
  club_id: string | null;
  assigned_to: string | null;
  status: string | null;
  priority: string | null;
  collaborating_club_ids: string[] | null;
};

type TaskCommentRow = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: TaskUser[] | TaskUser | null;
};

function normalizeStatus(status: string | null | undefined, isCompleted: boolean | null | undefined): TaskStatus {
  if (status === "in_progress" || status === "waiting_on_club" || status === "waiting_on_admin" || status === "blocked" || status === "completed") {
    return status;
  }
  if (isCompleted) return "completed";
  return "not_started";
}

function normalizePriority(priority: string | null | undefined): TaskPriority {
  if (priority === "low" || priority === "high" || priority === "urgent") {
    return priority;
  }
  return "medium";
}

async function getTaskWorkspaceOptions(): Promise<TaskWorkspaceOptions> {
  const [clubsResult, usersResult] = await Promise.all([
    supabase.from("clubs").select("id, name").order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, club_id")
      .in("role", ["admin", "officer"])
      .order("full_name", { ascending: true }),
  ]);

  if (clubsResult.error) throw clubsResult.error;
  if (usersResult.error) throw usersResult.error;

  return {
    clubs: (clubsResult.data ?? []) as TaskClub[],
    users: (usersResult.data ?? []) as TaskUser[],
  };
}

function hydrateTasks(rows: TaskRow[], options: TaskWorkspaceOptions): Task[] {
  const clubsById = new Map(options.clubs.map((club) => [club.id, club]));
  const usersById = new Map(options.users.map((user) => [user.id, user]));

  return rows.map((row) => {
    const collaboratorClubIds = Array.isArray(row.collaborating_club_ids) ? row.collaborating_club_ids : [];

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      due_date: row.due_date,
      is_completed: normalizeStatus(row.status, row.is_completed) === "completed",
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      completed_at: row.completed_at,
      club_id: row.club_id,
      assigned_to: row.assigned_to,
      status: normalizeStatus(row.status, row.is_completed),
      priority: normalizePriority(row.priority),
      collaborating_club_ids: collaboratorClubIds,
      club: row.club_id ? clubsById.get(row.club_id) ?? null : null,
      assigned_to_profile: row.assigned_to ? usersById.get(row.assigned_to) ?? null : null,
      created_by_profile: row.created_by ? usersById.get(row.created_by) ?? null : null,
      collaborating_clubs: collaboratorClubIds
        .map((clubId) => clubsById.get(clubId))
        .filter((club): club is TaskClub => Boolean(club)),
    };
  });
}

export async function getAllTasks(): Promise<Task[]> {
  const [tasksResult, options] = await Promise.all([
    supabase
      .from("club_tasks")
      .select(
        "id, title, description, due_date, is_completed, created_at, updated_at, created_by, completed_at, club_id, assigned_to, status, priority, collaborating_club_ids",
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getTaskWorkspaceOptions(),
  ]);

  if (tasksResult.error) throw tasksResult.error;

  return hydrateTasks((tasksResult.data ?? []) as TaskRow[], options);
}

export async function getTaskWorkspaceDirectory(): Promise<TaskWorkspaceOptions> {
  return getTaskWorkspaceOptions();
}

async function getTaskById(id: string): Promise<Task | null> {
  const [taskResult, options] = await Promise.all([
    supabase
      .from("club_tasks")
      .select(
        "id, title, description, due_date, is_completed, created_at, updated_at, created_by, completed_at, club_id, assigned_to, status, priority, collaborating_club_ids",
      )
      .eq("id", id)
      .single(),
    getTaskWorkspaceOptions(),
  ]);

  if (taskResult.error) throw taskResult.error;

  return hydrateTasks([taskResult.data as TaskRow], options)[0] ?? null;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const { data, error } = await supabase
    .from("club_tasks")
    .insert({
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      due_date: payload.due_date ?? null,
      club_id: payload.club_id ?? null,
      assigned_to: payload.assigned_to ?? null,
      status: payload.status,
      priority: payload.priority,
      collaborating_club_ids: payload.collaborating_club_ids ?? [],
      created_by: payload.created_by,
    })
    .select("id")
    .single();

  if (error) throw error;

  const task = await getTaskById(data.id);
  if (!task) {
    throw new Error("Task was created but could not be loaded.");
  }
  return task;
}

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  const updatePayload: Record<string, unknown> = {};

  if (payload.title !== undefined) updatePayload.title = payload.title.trim();
  if (payload.description !== undefined) updatePayload.description = payload.description?.trim() || null;
  if (payload.due_date !== undefined) updatePayload.due_date = payload.due_date ?? null;
  if (payload.club_id !== undefined) updatePayload.club_id = payload.club_id ?? null;
  if (payload.assigned_to !== undefined) updatePayload.assigned_to = payload.assigned_to ?? null;
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (payload.priority !== undefined) updatePayload.priority = payload.priority;
  if (payload.collaborating_club_ids !== undefined) {
    updatePayload.collaborating_club_ids = payload.collaborating_club_ids;
  }

  const { error } = await supabase.from("club_tasks").update(updatePayload).eq("id", id);

  if (error) throw error;

  const task = await getTaskById(id);
  if (!task) {
    throw new Error("Task was updated but could not be loaded.");
  }
  return task;
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return updateTask(id, { status });
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("club_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from("task_comments")
    .select(
      "id, task_id, author_id, body, created_at, author:profiles!task_comments_author_id_fkey(id, full_name, email, avatar_url, role, club_id)",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as TaskCommentRow[]).map((comment) => ({
    id: comment.id,
    task_id: comment.task_id,
    author_id: comment.author_id,
    body: comment.body,
    created_at: comment.created_at,
    author: Array.isArray(comment.author) ? comment.author[0] ?? null : comment.author ?? null,
  }));
}

export async function addTaskComment(taskId: string, authorId: string, body: string): Promise<TaskComment> {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: authorId,
      body: body.trim(),
    })
    .select(
      "id, task_id, author_id, body, created_at, author:profiles!task_comments_author_id_fkey(id, full_name, email, avatar_url, role, club_id)",
    )
    .single();

  if (error) throw error;

  return {
    id: data.id,
    task_id: data.task_id,
    author_id: data.author_id,
    body: data.body,
    created_at: data.created_at,
    author: Array.isArray(data.author) ? data.author[0] ?? null : (data.author as TaskUser | null) ?? null,
  };
}
