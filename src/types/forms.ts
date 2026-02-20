export type FormFieldType =
    | "short_text"
    | "long_text"
    | "number"
    | "dropdown"
    | "checkboxes"
    | "radio"
    | "file"
    | "date"
    | "time"
    | "section";

export interface Form {
    id: string;
    title: string;
    description: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    qr_code_url: string | null;
}

export interface FormField {
    id: string;
    form_id: string;
    type: FormFieldType;
    label: string;
    description: string | null;
    options: string[] | null;
    order: number;
}

export interface FormWithFields extends Form {
    fields: FormField[];
}

export interface FormResponse {
    id: string;
    form_id: string;
    user_id: string | null;
    created_at: string;
}

export interface FormResponseAnswer {
    id: string;
    response_id: string;
    field_id: string;
    answer: string | number | string[] | null;
}

export interface FormResponseWithAnswers extends FormResponse {
    answers: FormResponseAnswer[];
}
