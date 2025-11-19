export type FieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "date"
  | "time"
  | "file"
  | "section";

export type FormRecord = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  is_active: boolean | null;
  qr_url: string | null;
};

export type FormFieldRecord = {
  id: string;
  form_id: string;
  type: FieldType;
  label: string;
  description: string | null;
  required: boolean;
  options: string[] | null;
  order_index: number;
};

export type FormSubmissionRecord = {
  id: string;
  form_id: string;
  submitted_at: string;
  submitted_by: string | null;
  values: Record<string, { label: string; value: string | string[] }>;
};

export type EditableField = FormFieldRecord & {
  localId: string;
};
