import { supabase } from "@/lib/supabaseClient";
import type {
  FormRecord,
  FormFieldRecord,
  FormSubmissionRecord,
} from "./types";

const FORM_QR_BUCKET = "form-qr";
const FORM_UPLOAD_BUCKET = "form-uploads";

export async function listForms() {
  const { data, error } = await supabase
    .from("forms")
    .select("id,title,description,created_at,is_active,qr_url")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FormRecord[];
}

export async function fetchForm(formId: string) {
  const { data, error } = await supabase.from("forms").select("*").eq("id", formId).single();
  if (error) throw new Error(error.message);
  return data as FormRecord;
}

export async function fetchFormFields(formId: string) {
  const { data, error } = await supabase
    .from("form_fields")
    .select("*")
    .eq("form_id", formId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FormFieldRecord[];
}

export async function fetchSubmissions(formId: string) {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FormSubmissionRecord[];
}

export async function deleteForm(formId: string) {
  const { error } = await supabase.from("forms").delete().eq("id", formId);
  if (error) throw new Error(error.message);
}

export async function createFormRecord(params: {
  title: string;
  description: string;
  createdBy: string | null;
}) {
  const { data, error } = await supabase
    .from("forms")
    .insert([
      {
        title: params.title,
        description: params.description,
        created_by: params.createdBy,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as FormRecord;
}

export async function insertFormFields(formId: string, fields: Omit<FormFieldRecord, "id">[]) {
  if (!fields.length) return;
  const payload = fields.map((field) => ({
    form_id: formId,
    type: field.type,
    label: field.label,
    description: field.description,
    required: field.required,
    options: field.options ?? null,
    order_index: field.order_index,
  }));
  const { error } = await supabase.from("form_fields").insert(payload);
  if (error) throw new Error(error.message);
}

export async function saveQrCode(formId: string, qrUrl: string) {
  const { error } = await supabase.from("forms").update({ qr_url: qrUrl }).eq("id", formId);
  if (error) throw new Error(error.message);
}

export async function uploadQrImage(formId: string, file: Blob) {
  const filePath = `qr-${formId}.png`;
  const { error } = await supabase.storage.from(FORM_QR_BUCKET).upload(filePath, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: "image/png",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(FORM_QR_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl ?? null;
}

export async function uploadFormFile(file: File, formId: string, fieldId: string) {
  const ext = file.name.split(".").pop() || "dat";
  const path = `${formId}/${fieldId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(FORM_UPLOAD_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(FORM_UPLOAD_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? "";
}

export async function submitForm(formId: string, values: Record<string, { label: string; value: string | string[] }>, submittedBy?: string) {
  const { error } = await supabase.from("form_submissions").insert([
    {
      form_id: formId,
      values,
      submitted_by: submittedBy ?? null,
    },
  ]);
  if (error) throw new Error(error.message);
}
