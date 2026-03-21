export type FormFieldType =
    | "short_text"
    | "long_text"
    | "number"
    | "dropdown"
    | "checkbox"
    | "checkboxes"
    | "radio"
    | "file"
    | "date"
    | "time"
    | "section";

export type FormEmailPolicy = "any" | "school_only";

export interface Form {
    id: string;
    title: string;
    description: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    qr_code_url: string | null;
    email_policy: FormEmailPolicy;
}

export interface FormField {
    id: string;
    form_id: string;
    type: FormFieldType;
    label: string;
    description: string | null;
    options: string[] | null;
    order: number;
    required?: boolean;
}

export interface FormWithFields extends Form {
    fields: FormField[];
}

export interface FormResponse {
    id: string;
    form_id: string;
    user_id: string | null;
    created_at: string;
    respondent_name: string | null;
    respondent_email: string | null;
}

export interface FormResponseAnswer {
    id: string;
    response_id: string;
    field_id: string;
    answer: string | number | boolean | string[] | null;
}

export interface FormResponseWithAnswers extends FormResponse {
    answers: FormResponseAnswer[];
}
