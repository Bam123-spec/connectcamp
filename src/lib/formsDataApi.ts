import { supabase } from "@/lib/supabaseClient";
import type {
  Form,
  FormAccessType,
  FormEmailPolicy,
  FormField,
  FormResponseAnswer,
  FormResponseWithAnswers,
} from "@/types/forms";

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
  email_policy?: string | null;
  access_type?: string | null;
  max_responses?: number | null;
  limit_one_response?: boolean | null;
  success_message?: string | null;
  redirect_url?: string | null;
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
  respondent_name?: string | null;
  respondent_email?: string | null;
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
  respondent_name?: string | null;
  respondent_email?: string | null;
};

let orderColumnCache: "order" | "order_index" | null = null;
let requiredColumnCache: boolean | null = null;
let qrColumnCache: "qr_code_url" | "qr_url" | null = null;
let hasOrgIdColumnCache: boolean | null = null;
let hasFormAccessTypeColumnCache: boolean | null = null;
let hasFormMaxResponsesColumnCache: boolean | null = null;
let hasFormLimitOneResponseColumnCache: boolean | null = null;
let hasFormSuccessMessageColumnCache: boolean | null = null;
let hasFormRedirectUrlColumnCache: boolean | null = null;
const columnPresenceCache = new Map<string, boolean>();

const SCHEMA_ERROR_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const OPTION_FIELD_TYPES = new Set(["dropdown", "checkboxes", "checkbox", "radio"]);
const RESPONDENT_NAME_FIELD_ID = "__respondent_name";
const RESPONDENT_EMAIL_FIELD_ID = "__respondent_email";
export const SCHOOL_EMAIL_DOMAIN = "@montgomerycollege.com";

export type FormSubmissionState = {
  exists: boolean;
  is_active: boolean;
  access_type: FormAccessType;
  is_accepting: boolean;
  reason: "open" | "not_found" | "inactive" | "auth_required" | "max_responses_reached" | "already_submitted";
  max_responses: number | null;
  responses_count: number;
  limit_one_response: boolean;
  success_message: string | null;
  redirect_url: string | null;
};

function createUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

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
    email_policy: row.email_policy === "any" ? "any" : "school_only",
    access_type: row.access_type === "internal" ? "internal" : "public",
    max_responses:
      typeof row.max_responses === "number" && Number.isFinite(row.max_responses)
        ? row.max_responses
        : null,
    limit_one_response: Boolean(row.limit_one_response),
    success_message: row.success_message?.trim() || null,
    redirect_url: row.redirect_url?.trim() || null,
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

async function detectColumn(table: string, column: string) {
  const cacheKey = `${table}.${column}`;
  if (columnPresenceCache.has(cacheKey)) {
    return columnPresenceCache.get(cacheKey) ?? false;
  }

  const { error } = await supabase.from(table).select(`id, ${column}`).limit(1);
  if (!error) {
    columnPresenceCache.set(cacheKey, true);
    return true;
  }
  if (isSchemaError(error)) {
    columnPresenceCache.set(cacheKey, false);
    return false;
  }
  throw error;
}

async function detectHasOrgIdColumn() {
  if (hasOrgIdColumnCache !== null) return hasOrgIdColumnCache;
  hasOrgIdColumnCache = await detectColumn("forms", "org_id");
  return hasOrgIdColumnCache;
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

async function detectFormEmailPolicyColumn() {
  return detectColumn("forms", "email_policy");
}

async function detectFormAccessTypeColumn() {
  if (hasFormAccessTypeColumnCache !== null) return hasFormAccessTypeColumnCache;
  hasFormAccessTypeColumnCache = await detectColumn("forms", "access_type");
  return hasFormAccessTypeColumnCache;
}

async function detectFormMaxResponsesColumn() {
  if (hasFormMaxResponsesColumnCache !== null) return hasFormMaxResponsesColumnCache;
  hasFormMaxResponsesColumnCache = await detectColumn("forms", "max_responses");
  return hasFormMaxResponsesColumnCache;
}

async function detectFormLimitOneResponseColumn() {
  if (hasFormLimitOneResponseColumnCache !== null) return hasFormLimitOneResponseColumnCache;
  hasFormLimitOneResponseColumnCache = await detectColumn("forms", "limit_one_response");
  return hasFormLimitOneResponseColumnCache;
}

async function detectFormSuccessMessageColumn() {
  if (hasFormSuccessMessageColumnCache !== null) return hasFormSuccessMessageColumnCache;
  hasFormSuccessMessageColumnCache = await detectColumn("forms", "success_message");
  return hasFormSuccessMessageColumnCache;
}

async function detectFormRedirectUrlColumn() {
  if (hasFormRedirectUrlColumnCache !== null) return hasFormRedirectUrlColumnCache;
  hasFormRedirectUrlColumnCache = await detectColumn("forms", "redirect_url");
  return hasFormRedirectUrlColumnCache;
}

async function detectResponseRespondentNameColumn() {
  return detectColumn("form_responses", "respondent_name");
}

async function detectResponseRespondentEmailColumn() {
  return detectColumn("form_responses", "respondent_email");
}

async function detectLegacySubmissionRespondentNameColumn() {
  return detectColumn("form_submissions", "respondent_name");
}

async function detectLegacySubmissionRespondentEmailColumn() {
  return detectColumn("form_submissions", "respondent_email");
}

function buildFormSelectColumns(
  qrColumn: "qr_code_url" | "qr_url",
  options: {
    hasEmailPolicyColumn: boolean;
    hasAccessTypeColumn: boolean;
    hasMaxResponsesColumn: boolean;
    hasLimitOneResponseColumn: boolean;
    hasSuccessMessageColumn: boolean;
    hasRedirectUrlColumn: boolean;
  },
) {
  const columns = ["id", "title", "description", "created_by", "created_at", "is_active", qrColumn];
  if (options.hasEmailPolicyColumn) {
    columns.push("email_policy");
  }
  if (options.hasAccessTypeColumn) {
    columns.push("access_type");
  }
  if (options.hasMaxResponsesColumn) {
    columns.push("max_responses");
  }
  if (options.hasLimitOneResponseColumn) {
    columns.push("limit_one_response");
  }
  if (options.hasSuccessMessageColumn) {
    columns.push("success_message");
  }
  if (options.hasRedirectUrlColumn) {
    columns.push("redirect_url");
  }
  return columns.join(", ");
}

export async function listForms(orgId?: string | null): Promise<Form[]> {
  const qrColumn = await detectQrColumn();
  const [
    hasEmailPolicyColumn,
    hasAccessTypeColumn,
    hasMaxResponsesColumn,
    hasLimitOneResponseColumn,
    hasSuccessMessageColumn,
    hasRedirectUrlColumn,
  ] = await Promise.all([
    detectFormEmailPolicyColumn(),
    detectFormAccessTypeColumn(),
    detectFormMaxResponsesColumn(),
    detectFormLimitOneResponseColumn(),
    detectFormSuccessMessageColumn(),
    detectFormRedirectUrlColumn(),
  ]);
  const hasOrgColumn = orgId ? await detectHasOrgIdColumn() : false;

  let query = supabase
    .from("forms")
    .select(
      buildFormSelectColumns(qrColumn, {
        hasEmailPolicyColumn,
        hasAccessTypeColumn,
        hasMaxResponsesColumn,
        hasLimitOneResponseColumn,
        hasSuccessMessageColumn,
        hasRedirectUrlColumn,
      }),
    )
    .order("created_at", { ascending: false });

  if (hasOrgColumn && orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => normalizeForm(row as unknown as FormRow));
}

export async function getFormById(formId: string, orgId?: string | null): Promise<Form | null> {
  const qrColumn = await detectQrColumn();
  const [
    hasEmailPolicyColumn,
    hasAccessTypeColumn,
    hasMaxResponsesColumn,
    hasLimitOneResponseColumn,
    hasSuccessMessageColumn,
    hasRedirectUrlColumn,
  ] = await Promise.all([
    detectFormEmailPolicyColumn(),
    detectFormAccessTypeColumn(),
    detectFormMaxResponsesColumn(),
    detectFormLimitOneResponseColumn(),
    detectFormSuccessMessageColumn(),
    detectFormRedirectUrlColumn(),
  ]);
  const hasOrgColumn = orgId ? await detectHasOrgIdColumn() : false;

  let query = supabase
    .from("forms")
    .select(
      buildFormSelectColumns(qrColumn, {
        hasEmailPolicyColumn,
        hasAccessTypeColumn,
        hasMaxResponsesColumn,
        hasLimitOneResponseColumn,
        hasSuccessMessageColumn,
        hasRedirectUrlColumn,
      }),
    )
    .eq("id", formId);

  if (hasOrgColumn && orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return normalizeForm(data as unknown as FormRow);
}

export async function saveForm(params: {
  id?: string;
  title: string;
  description: string;
  isActive: boolean;
  emailPolicy: FormEmailPolicy;
  accessType: FormAccessType;
  maxResponses?: number | null;
  limitOneResponse: boolean;
  successMessage?: string | null;
  redirectUrl?: string | null;
  createdBy?: string | null;
  orgId?: string | null;
}) {
  const qrColumn = await detectQrColumn();
  const [
    hasEmailPolicyColumn,
    hasAccessTypeColumn,
    hasMaxResponsesColumn,
    hasLimitOneResponseColumn,
    hasSuccessMessageColumn,
    hasRedirectUrlColumn,
  ] = await Promise.all([
    detectFormEmailPolicyColumn(),
    detectFormAccessTypeColumn(),
    detectFormMaxResponsesColumn(),
    detectFormLimitOneResponseColumn(),
    detectFormSuccessMessageColumn(),
    detectFormRedirectUrlColumn(),
  ]);
  const hasOrgColumn = params.orgId ? await detectHasOrgIdColumn() : false;

  const basePayload: Record<string, unknown> = {
    title: params.title.trim(),
    description: params.description.trim() || null,
    is_active: params.isActive,
  };

  if (hasEmailPolicyColumn) {
    basePayload.email_policy = params.emailPolicy;
  }
  if (hasAccessTypeColumn) {
    basePayload.access_type = params.accessType;
  }
  if (hasMaxResponsesColumn) {
    basePayload.max_responses =
      typeof params.maxResponses === "number" && Number.isFinite(params.maxResponses)
        ? params.maxResponses
        : null;
  }
  if (hasLimitOneResponseColumn) {
    basePayload.limit_one_response = params.limitOneResponse;
  }
  if (hasSuccessMessageColumn) {
    basePayload.success_message = params.successMessage?.trim() || null;
  }
  if (hasRedirectUrlColumn) {
    basePayload.redirect_url = params.redirectUrl?.trim() || null;
  }

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

  const selectColumns = buildFormSelectColumns(qrColumn, {
    hasEmailPolicyColumn,
    hasAccessTypeColumn,
    hasMaxResponsesColumn,
    hasLimitOneResponseColumn,
    hasSuccessMessageColumn,
    hasRedirectUrlColumn,
  });

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

export async function duplicateForm(formId: string, createdBy?: string | null, orgId?: string | null) {
  const [sourceForm, sourceFields] = await Promise.all([
    getFormById(formId, orgId),
    fetchFormFields(formId),
  ]);

  if (!sourceForm) {
    throw new Error("The source form could not be loaded.");
  }

  const duplicatedForm = await saveForm({
    title: `${sourceForm.title} (Copy)`,
    description: sourceForm.description ?? "",
    isActive: false,
    emailPolicy: sourceForm.email_policy,
    accessType: sourceForm.access_type,
    maxResponses: sourceForm.max_responses,
    limitOneResponse: sourceForm.limit_one_response,
    successMessage: sourceForm.success_message,
    redirectUrl: sourceForm.redirect_url,
    createdBy: createdBy ?? sourceForm.created_by,
    orgId,
  });

  await syncFormFields({
    formId: duplicatedForm.id,
    fields: sourceFields.map((field, index) => ({
      ...field,
      id: createUuid(),
      form_id: duplicatedForm.id,
      order: index,
    })),
    originalFieldIds: new Set(),
  });

  return duplicatedForm;
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

function getLegacyRespondentValue(
  submission: LegacySubmissionRow,
  fieldId: typeof RESPONDENT_NAME_FIELD_ID | typeof RESPONDENT_EMAIL_FIELD_ID,
) {
  const entry = submission.values?.[fieldId];
  if (!entry) return null;
  if (typeof entry === "object" && entry !== null && "value" in entry) {
    const value = (entry as { value?: unknown }).value;
    return value === undefined || value === null ? null : String(value);
  }
  return String(entry);
}

function normalizeSubmissionState(value: unknown): FormSubmissionState | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  return {
    exists: Boolean(record.form_exists ?? record.exists),
    is_active: Boolean(record.is_active),
    access_type: record.access_type === "internal" ? "internal" : "public",
    is_accepting: Boolean(record.is_accepting),
    reason:
      record.reason === "inactive" ||
      record.reason === "auth_required" ||
      record.reason === "max_responses_reached" ||
      record.reason === "already_submitted" ||
      record.reason === "not_found"
        ? record.reason
        : "open",
    max_responses:
      typeof record.max_responses === "number" && Number.isFinite(record.max_responses)
        ? record.max_responses
        : null,
    responses_count:
      typeof record.responses_count === "number" && Number.isFinite(record.responses_count)
        ? record.responses_count
        : 0,
    limit_one_response: Boolean(record.limit_one_response),
    success_message: typeof record.success_message === "string" ? record.success_message : null,
    redirect_url: typeof record.redirect_url === "string" ? record.redirect_url : null,
  };
}

export async function getFormSubmissionState(
  formId: string,
  respondentEmail?: string | null,
): Promise<FormSubmissionState | null> {
  const rpcResult = await supabase.rpc("get_form_submission_state", {
    target_form_id: formId,
    target_respondent_email: respondentEmail?.trim().toLowerCase() || null,
  });

  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    return normalizeSubmissionState(row);
  }

  if (!isSchemaError(rpcResult.error)) {
    throw rpcResult.error;
  }

  return null;
}

export async function fetchFormResponses(formId: string, fields: FormField[]): Promise<FormResponseWithAnswers[]> {
  const hasRespondentNameColumn = await detectResponseRespondentNameColumn();
  const hasRespondentEmailColumn = await detectResponseRespondentEmailColumn();
  const responseSelectColumns = ["id", "form_id", "user_id", "created_at"];
  if (hasRespondentNameColumn) {
    responseSelectColumns.push("respondent_name");
  }
  if (hasRespondentEmailColumn) {
    responseSelectColumns.push("respondent_email");
  }

  const responsesResult = await supabase
    .from("form_responses")
    .select(responseSelectColumns.join(", "))
    .eq("form_id", formId)
    .order("created_at", { ascending: false });

  if (!responsesResult.error) {
    const responses = (responsesResult.data ?? []) as unknown as FormResponseRow[];
    const responseIds = responses.map((response) => response.id);

    let answersByResponseId = new Map<string, FormResponseAnswer[]>();
    let respondentNameByResponseId = new Map<string, string | null>();
    let respondentEmailByResponseId = new Map<string, string | null>();

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
        if (answerRow.field_id === RESPONDENT_NAME_FIELD_ID) {
          respondentNameByResponseId.set(
            answerRow.response_id,
            answerRow.answer === null || answerRow.answer === undefined ? null : String(answerRow.answer),
          );
          return;
        }

        if (answerRow.field_id === RESPONDENT_EMAIL_FIELD_ID) {
          respondentEmailByResponseId.set(
            answerRow.response_id,
            answerRow.answer === null || answerRow.answer === undefined ? null : String(answerRow.answer),
          );
          return;
        }

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
      respondent_name: hasRespondentNameColumn
        ? response.respondent_name ?? null
        : respondentNameByResponseId.get(response.id) ?? null,
      respondent_email: hasRespondentEmailColumn
        ? response.respondent_email ?? null
        : respondentEmailByResponseId.get(response.id) ?? null,
      answers: answersByResponseId.get(response.id) ?? [],
    }));
  }

  if (!isSchemaError(responsesResult.error)) {
    throw responsesResult.error;
  }

  const hasLegacyRespondentNameColumn = await detectLegacySubmissionRespondentNameColumn();
  const hasLegacyRespondentEmailColumn = await detectLegacySubmissionRespondentEmailColumn();
  const legacySelectColumns = ["id", "form_id", "submitted_at", "submitted_by", "values"];
  if (hasLegacyRespondentNameColumn) {
    legacySelectColumns.push("respondent_name");
  }
  if (hasLegacyRespondentEmailColumn) {
    legacySelectColumns.push("respondent_email");
  }

  const legacyResult = await supabase
    .from("form_submissions")
    .select(legacySelectColumns.join(", "))
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });

  if (legacyResult.error) throw legacyResult.error;

  return ((legacyResult.data ?? []) as unknown as LegacySubmissionRow[]).map((submission) => ({
    id: submission.id,
    form_id: submission.form_id,
    user_id: submission.submitted_by ?? null,
    created_at: submission.submitted_at,
    respondent_name: hasLegacyRespondentNameColumn
      ? submission.respondent_name ?? null
      : getLegacyRespondentValue(submission, RESPONDENT_NAME_FIELD_ID),
    respondent_email: hasLegacyRespondentEmailColumn
      ? submission.respondent_email ?? null
      : getLegacyRespondentValue(submission, RESPONDENT_EMAIL_FIELD_ID),
    answers: mapLegacySubmissionToAnswers(submission, fields),
  }));
}

export async function submitFormResponse(params: {
  formId: string;
  answers: Record<string, unknown>;
  fields: FormField[];
  respondentName: string;
  respondentEmail: string;
  userId?: string | null;
}) {
  const submissionState = await getFormSubmissionState(params.formId, params.respondentEmail);
  if (submissionState && !submissionState.is_accepting) {
    if (submissionState.reason === "inactive") {
      throw new Error("This form is currently closed and no longer accepting responses.");
    }
    if (submissionState.reason === "auth_required") {
      throw new Error("This form is restricted to signed-in Connect Camp users.");
    }
    if (submissionState.reason === "max_responses_reached") {
      throw new Error("This form has reached its response limit.");
    }
    if (submissionState.reason === "already_submitted") {
      throw new Error("A response has already been submitted with this email address.");
    }
    throw new Error("This form is not accepting responses right now.");
  }

  const responseId = createUuid();

  const responsePayload: Record<string, unknown> = {
    id: responseId,
    form_id: params.formId,
  };
  if (params.userId) {
    responsePayload.user_id = params.userId;
  }
  const [hasRespondentNameColumn, hasRespondentEmailColumn] = await Promise.all([
    detectResponseRespondentNameColumn(),
    detectResponseRespondentEmailColumn(),
  ]);
  if (hasRespondentNameColumn) {
    responsePayload.respondent_name = params.respondentName;
  }
  if (hasRespondentEmailColumn) {
    responsePayload.respondent_email = params.respondentEmail;
  }

  const responseInsert = await supabase.from("form_responses").insert(responsePayload);

  if (!responseInsert.error) {
    const answersPayload = Object.entries(params.answers).map(([fieldId, answer]) => ({
      response_id: responseId,
      field_id: fieldId,
      answer: toSerializableAnswer(answer),
    }));

    if (!hasRespondentNameColumn) {
      answersPayload.push({
        response_id: responseId,
        field_id: RESPONDENT_NAME_FIELD_ID,
        answer: params.respondentName,
      });
    }

    if (!hasRespondentEmailColumn) {
      answersPayload.push({
        response_id: responseId,
        field_id: RESPONDENT_EMAIL_FIELD_ID,
        answer: params.respondentEmail,
      });
    }

    if (answersPayload.length > 0) {
      const answersInsert = await supabase.from("form_response_answers").insert(answersPayload);
      if (answersInsert.error) throw answersInsert.error;
    }

    return;
  }

  if (!isSchemaError(responseInsert.error)) {
    if (
      responseInsert.error.code === "42501" ||
      /row-level security/i.test(`${responseInsert.error.message ?? ""} ${responseInsert.error.details ?? ""}`)
    ) {
      throw new Error("This form could not accept your response with the current access rules.");
    }
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
  const [hasLegacyRespondentNameColumn, hasLegacyRespondentEmailColumn] = await Promise.all([
    detectLegacySubmissionRespondentNameColumn(),
    detectLegacySubmissionRespondentEmailColumn(),
  ]);
  if (hasLegacyRespondentNameColumn) {
    legacyPayload.respondent_name = params.respondentName;
  } else {
    values[RESPONDENT_NAME_FIELD_ID] = {
      label: "Full Name",
      value: params.respondentName,
    };
  }

  if (hasLegacyRespondentEmailColumn) {
    legacyPayload.respondent_email = params.respondentEmail;
  } else {
    values[RESPONDENT_EMAIL_FIELD_ID] = {
      label: "Email Address",
      value: params.respondentEmail,
    };
  }

  const legacyInsert = await supabase.from("form_submissions").insert(legacyPayload);
  if (legacyInsert.error) {
    if (
      legacyInsert.error.code === "42501" ||
      /row-level security/i.test(`${legacyInsert.error.message ?? ""} ${legacyInsert.error.details ?? ""}`)
    ) {
      throw new Error("This form could not accept your response with the current access rules.");
    }
    throw legacyInsert.error;
  }
}
