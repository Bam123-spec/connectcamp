import { supabase } from "@/lib/supabaseClient";
import type { Form, FormField, FormResponseAnswer, FormResponseWithAnswers } from "@/types/forms";

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type FormRow = {
  id: string;
  title: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  is_active?: boolean | null;
  qr_code_url?: string | null;
  qr_url?: string | null;
};

type FormFieldRow = {
  id: string;
  form_id: string;
  type: string;
  label: string;
  description?: string | null;
  options?: unknown;
  required?: boolean | null;
  order?: number | null;
  order_index?: number | null;
};

type FormResponseRow = {
  id: string;
  form_id: string;
  user_id?: string | null;
  created_at: string;
};

type FormAnswerRow = {
  id: string;
  response_id: string;
  field_id: string;
  answer: unknown;
};

type LegacySubmissionRow = {
  id: string;
  form_id: string;
  submitted_at: string;
  submitted_by?: string | null;
  values?: Record<string, { label?: string; value?: unknown } | unknown> | null;
};

let orderColumnCache: "order" | "order_index" | null = null;
let requiredColumnCache: boolean | null = null;
let qrColumnCache: "qr_code_url" | "qr_url" | null = null;
let hasOrgIdColumnCache: boolean | null = null;

const SCHEMA_ERROR_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const OPTION_FIELD_TYPES = new Set(["dropdown", "checkboxes", "checkbox", "radio"]);

function isSchemaError(error: SupabaseErrorLike | null | undefined) {
  if (!error) return false;
  if (error.code && SCHEMA_ERROR_CODES.has(error.code)) return true;

  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the")
  );
}

function normalizeOptions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((entry) => String(entry));
}

function normalizeForm(row: FormRow): Form {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    is_active: row.is_active ?? true,
    qr_code_url: row.qr_code_url ?? row.qr_url ?? null,
  };
}

function normalizeField(row: FormFieldRow, orderColumn: "order" | "order_index", hasRequired: boolean): FormField {
  const type = row.type === "checkbox" ? "checkboxes" : row.type;

  return {
    id: row.id,
    form_id: row.form_id,
    type: type as FormField["type"],
    label: row.label,
    description: row.description ?? null,
    options: normalizeOptions(row.options),
    order: Number(row[orderColumn] ?? 0),
    required: hasRequired ? Boolean(row.required) : false,
  };
}

function toSerializableAnswer(answer: unknown) {
  if (Array.isArray(answer)) return answer.map((item) => String(item));
  if (typeof answer === "string") return answer;
  if (typeof answer === "number") return answer;
  if (typeof answer === "boolean") return answer ? "true" : "false";
  if (answer === null || answer === undefined) return null;
  return String(answer);
}

export function resolveFormsOrgId(profileOrgId?: string | null) {
  if (profileOrgId) return profileOrgId;
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("cc.workspace.org_id") ||
    window.localStorage.getItem("cc.settings.org_id") ||
    null
  );
}

async function detectHasOrgIdColumn() {
  if (hasOrgIdColumnCache !== null) return hasOrgIdColumnCache;
  const { error } = await supabase.from("forms").select("id, org_id").limit(1);
  if (!error) {
    hasOrgIdColumnCache = true;
    return true;
  }
  if (isSchemaError(error)) {
    hasOrgIdColumnCache = false;
    return false;
  }
  throw error;
}

async function detectQrColumn() {
  if (qrColumnCache) return qrColumnCache;

  const firstTry = await supabase.from("forms").select("id, qr_code_url").limit(1);
  if (!firstTry.error) {
    qrColumnCache = "qr_code_url";
    return qrColumnCache;
  }
  if (!isSchemaError(firstTry.error)) throw firstTry.error;

  const secondTry = await supabase.from("forms").select("id, qr_url").limit(1);
  if (!secondTry.error) {
    qrColumnCache = "qr_url";
    return qrColumnCache;
  }
  throw secondTry.error;
}

async function detectOrderColumn() {
  if (orderColumnCache) return orderColumnCache;

  const firstTry = await supabase.from("form_fields").select("id, order").limit(1);
  if (!firstTry.error) {
    orderColumnCache = "order";
    return orderColumnCache;
  }
  if (!isSchemaError(firstTry.error)) throw firstTry.error;

  const secondTry = await supabase.from("form_fields").select("id, order_index").limit(1);
  if (!secondTry.error) {
    orderColumnCache = "order_index";
    return orderColumnCache;
  }
  throw secondTry.error;
}

async function detectRequiredColumn() {
  if (requiredColumnCache !== null) return requiredColumnCache;
  const { error } = await supabase.from("form_fields").select("id, required").limit(1);
  if (!error) {
    requiredColumnCache = true;
    return true;
  }
  if (isSchemaError(error)) {
    requiredColumnCache = false;
    return false;
  }
  throw error;
}

export async function listForms(orgId?: string | null): Promise<Form[]> {
  const qrColumn = await detectQrColumn();
  const hasOrgColumn = orgId ? await detectHasOrgIdColumn() : false;

  let query = supabase
    .from("forms")
    .select(`id, title, description, created_by, created_at, is_active, ${qrColumn}`)
    .order("created_at", { ascending: false });

  if (hasOrgColumn && orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => normalizeForm(row as FormRow));
}

export async function getFormById(formId: string, orgId?: string | null): Promise<Form | null> {
  const qrColumn = await detectQrColumn();
  const hasOrgColumn = orgId ? await detectHasOrgIdColumn() : false;

  let query = supabase
    .from("forms")
    .select(`id, title, description, created_by, created_at, is_active, ${qrColumn}`)
    .eq("id", formId);

  if (hasOrgColumn && orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return normalizeForm(data as FormRow);
}

export async function saveForm(params: {
  id?: string;
  title: string;
  description: string;
  isActive: boolean;
  createdBy?: string | null;
  orgId?: string | null;
}) {
  const qrColumn = await detectQrColumn();
  const hasOrgColumn = params.orgId ? await detectHasOrgIdColumn() : false;

  const basePayload: Record<string, unknown> = {
    title: params.title.trim(),
    description: params.description.trim() || null,
    is_active: params.isActive,
  };

  const payloadWithUpdated = {
    ...basePayload,
    updated_at: new Date().toISOString(),
  };

  const payload: Record<string, unknown> = params.id ? payloadWithUpdated : basePayload;

  if (!params.id) {
    payload.created_by = params.createdBy ?? null;
  }

  if (hasOrgColumn && params.orgId) {
    payload.org_id = params.orgId;
  }

  const selectColumns = `id, title, description, created_by, created_at, is_active, ${qrColumn}`;

  let result;
  if (params.id) {
    result = await supabase.from("forms").update(payload).eq("id", params.id).select(selectColumns).single();

    if (result.error && isSchemaError(result.error) && "updated_at" in payload) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.updated_at;
      result = await supabase
        .from("forms")
        .update(fallbackPayload)
        .eq("id", params.id)
        .select(selectColumns)
        .single();
    }
  } else {
    result = await supabase.from("forms").insert(payload).select(selectColumns).single();
  }

  if (result.error) throw result.error;

  return normalizeForm(result.data as unknown as FormRow);
}

export async function fetchFormFields(formId: string): Promise<FormField[]> {
  const orderColumn = await detectOrderColumn();
  const hasRequired = await detectRequiredColumn();

  const selectColumns = hasRequired
    ? `id, form_id, type, label, description, options, ${orderColumn}, required`
    : `id, form_id, type, label, description, options, ${orderColumn}`;

  const { data, error } = await supabase
    .from("form_fields")
    .select(selectColumns)
    .eq("form_id", formId)
    .order(orderColumn, { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => normalizeField(row as unknown as FormFieldRow, orderColumn, hasRequired));
}

export async function syncFormFields(params: {
  formId: string;
  fields: FormField[];
  originalFieldIds: Set<string>;
}) {
  const orderColumn = await detectOrderColumn();
  const hasRequired = await detectRequiredColumn();

  const currentIds = new Set(params.fields.map((field) => field.id));
  const fieldsToDelete = Array.from(params.originalFieldIds).filter((id) => !currentIds.has(id));

  if (fieldsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("form_fields")
      .delete()
      .eq("form_id", params.formId)
      .in("id", fieldsToDelete);

    if (deleteError) throw deleteError;
  }

  if (params.fields.length === 0) {
    return;
  }

  const payload = params.fields.map((field, index) => {
    const supportsOptions = OPTION_FIELD_TYPES.has(field.type);
    const fieldPayload: Record<string, unknown> = {
      id: field.id,
      form_id: params.formId,
      type: field.type === "checkbox" ? "checkboxes" : field.type,
      label: field.label.trim(),
      description: field.description?.trim() || null,
      options: supportsOptions ? field.options ?? [] : null,
      [orderColumn]: index,
    };

    if (hasRequired) {
      fieldPayload.required = Boolean(field.required);
    }

    return fieldPayload;
  });

  const { error: upsertError } = await supabase
    .from("form_fields")
    .upsert(payload, { onConflict: "id" });

  if (upsertError) throw upsertError;
}

export async function deleteForm(formId: string) {
  const { error } = await supabase.from("forms").delete().eq("id", formId);
  if (error) throw error;
}

export async function updateFormActiveState(formId: string, isActive: boolean) {
  const payload: Record<string, unknown> = {
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  let result = await supabase.from("forms").update(payload).eq("id", formId);
  if (result.error && isSchemaError(result.error)) {
    result = await supabase.from("forms").update({ is_active: isActive }).eq("id", formId);
  }

  if (result.error) throw result.error;
}

export async function saveQrCodeUrl(formId: string, qrUrl: string) {
  const qrColumn = await detectQrColumn();
  const payload = qrColumn === "qr_code_url" ? { qr_code_url: qrUrl } : { qr_url: qrUrl };

  const { error } = await supabase.from("forms").update(payload).eq("id", formId);
  if (error) throw error;
}

export async function uploadFormFile(params: {
  formId: string;
  fieldId: string;
  file: File;
}) {
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${params.formId}/${params.fieldId}-${Date.now()}-${safeName}`;
  const buckets = ["form_uploads", "form-uploads"];

  let lastError: SupabaseErrorLike | null = null;
  for (const bucket of buckets) {
    const uploadResult = await supabase.storage.from(bucket).upload(filePath, params.file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadResult.error) {
      lastError = uploadResult.error;
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  throw lastError ?? new Error("Unable to upload file.");
}

function mapLegacySubmissionToAnswers(
  submission: LegacySubmissionRow,
  fields: FormField[],
): FormResponseAnswer[] {
  const values = submission.values ?? {};

  return fields.map((field) => {
    const byFieldId = values[field.id];

    let byLabel: unknown;
    if (!byFieldId) {
      const labelMatch = Object.values(values).find((entry) => {
        if (!entry || typeof entry !== "object") return false;
        return (entry as { label?: string }).label === field.label;
      });
      byLabel = labelMatch;
    }

    const valueCandidate = byFieldId ?? byLabel;
    const value =
      valueCandidate && typeof valueCandidate === "object" && "value" in (valueCandidate as object)
        ? (valueCandidate as { value?: unknown }).value
        : valueCandidate;

    return {
      id: `${submission.id}-${field.id}`,
      response_id: submission.id,
      field_id: field.id,
      answer: (value ?? null) as FormResponseAnswer["answer"],
    };
  });
}

export async function fetchFormResponses(formId: string, fields: FormField[]): Promise<FormResponseWithAnswers[]> {
  const responsesResult = await supabase
    .from("form_responses")
    .select("id, form_id, user_id, created_at")
    .eq("form_id", formId)
    .order("created_at", { ascending: false });

  if (!responsesResult.error) {
    const responses = (responsesResult.data ?? []) as FormResponseRow[];
    const responseIds = responses.map((response) => response.id);

    let answersByResponseId = new Map<string, FormResponseAnswer[]>();

    if (responseIds.length > 0) {
      const answersResult = await supabase
        .from("form_response_answers")
        .select("id, response_id, field_id, answer")
        .in("response_id", responseIds);

      if (answersResult.error) {
        throw answersResult.error;
      }

      const grouped = new Map<string, FormResponseAnswer[]>();
      ((answersResult.data ?? []) as FormAnswerRow[]).forEach((answerRow) => {
        const existing = grouped.get(answerRow.response_id) ?? [];
        existing.push({
          id: answerRow.id,
          response_id: answerRow.response_id,
          field_id: answerRow.field_id,
          answer: answerRow.answer as FormResponseAnswer["answer"],
        });
        grouped.set(answerRow.response_id, existing);
      });

      answersByResponseId = grouped;
    }

    return responses.map((response) => ({
      id: response.id,
      form_id: response.form_id,
      user_id: response.user_id ?? null,
      created_at: response.created_at,
      answers: answersByResponseId.get(response.id) ?? [],
    }));
  }

  if (!isSchemaError(responsesResult.error)) {
    throw responsesResult.error;
  }

  const legacyResult = await supabase
    .from("form_submissions")
    .select("id, form_id, submitted_at, submitted_by, values")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });

  if (legacyResult.error) throw legacyResult.error;

  return ((legacyResult.data ?? []) as LegacySubmissionRow[]).map((submission) => ({
    id: submission.id,
    form_id: submission.form_id,
    user_id: submission.submitted_by ?? null,
    created_at: submission.submitted_at,
    answers: mapLegacySubmissionToAnswers(submission, fields),
  }));
}

export async function submitFormResponse(params: {
  formId: string;
  answers: Record<string, unknown>;
  fields: FormField[];
  userId?: string | null;
}) {
  const responsePayload: Record<string, unknown> = { form_id: params.formId };
  if (params.userId) {
    responsePayload.user_id = params.userId;
  }

  const responseInsert = await supabase
    .from("form_responses")
    .insert(responsePayload)
    .select("id")
    .single();

  if (!responseInsert.error) {
    const responseId = responseInsert.data.id as string;

    const answersPayload = Object.entries(params.answers).map(([fieldId, answer]) => ({
      response_id: responseId,
      field_id: fieldId,
      answer: toSerializableAnswer(answer),
    }));

    if (answersPayload.length > 0) {
      const answersInsert = await supabase.from("form_response_answers").insert(answersPayload);
      if (answersInsert.error) throw answersInsert.error;
    }

    return;
  }

  if (!isSchemaError(responseInsert.error)) {
    throw responseInsert.error;
  }

  const fieldMap = new Map(params.fields.map((field) => [field.id, field]));
  const values = Object.entries(params.answers).reduce<Record<string, { label: string; value: unknown }>>(
    (acc, [fieldId, answer]) => {
      const field = fieldMap.get(fieldId);
      if (!field) return acc;
      acc[fieldId] = {
        label: field.label,
        value: toSerializableAnswer(answer),
      };
      return acc;
    },
    {},
  );

  const legacyPayload: Record<string, unknown> = {
    form_id: params.formId,
    values,
  };
  if (params.userId) {
    legacyPayload.submitted_by = params.userId;
  }

  const legacyInsert = await supabase.from("form_submissions").insert(legacyPayload);
  if (legacyInsert.error) throw legacyInsert.error;
}
