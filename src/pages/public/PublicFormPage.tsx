import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { Form, FormField } from "@/types/forms";
import {
  fetchFormFields,
  getFormById,
  submitFormResponse,
  uploadFormFile,
} from "@/lib/formsDataApi";
import { useAuth } from "@/context/AuthContext";

export default function PublicFormPage() {
  const { formId } = useParams();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  const uploadingCount = useMemo(
    () => Object.values(uploadingFields).filter(Boolean).length,
    [uploadingFields],
  );

  useEffect(() => {
    if (!formId) {
      setError("Missing form ID.");
      setLoading(false);
      return;
    }

    fetchForm(formId);
  }, [formId]);

  const fetchForm = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      setSubmitError(null);

      const loadedForm = await getFormById(id);

      if (!loadedForm) {
        setError("Form not found or unavailable.");
        return;
      }

      if (!loadedForm.is_active) {
        setError("This form is currently not accepting responses.");
        return;
      }

      setForm(loadedForm);

      const loadedFields = await fetchFormFields(id);
      setFields(loadedFields);
    } catch (loadError: any) {
      setError(loadError.message || "Error loading this form.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setSubmitError(null);
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      }
      return { ...prev, [fieldId]: current.filter((opt) => opt !== option) };
    });
    setSubmitError(null);
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    if (!formId) return;

    try {
      setUploadingFields((prev) => ({ ...prev, [fieldId]: true }));
      setSubmitError(null);

      const url = await uploadFormFile({
        formId,
        fieldId,
        file,
      });

      handleInputChange(fieldId, url);
    } catch (uploadError: any) {
      setSubmitError(uploadError.message || "File upload failed. Please try again.");
    } finally {
      setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
    }
  };

  const validateAnswers = () => {
    for (const field of fields) {
      if (!field.required || field.type === "section") continue;

      const value = answers[field.id];
      const isMissingArray = Array.isArray(value) && value.length === 0;
      const isMissingScalar = value === undefined || value === null || value === "";

      if (isMissingArray || isMissingScalar) {
        return `\"${field.label}\" is required.`;
      }
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formId || !form) return;

    const validationError = validateAnswers();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    if (uploadingCount > 0) {
      setSubmitError("Please wait for file uploads to finish before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      await submitFormResponse({
        formId,
        answers,
        fields,
        userId: session?.user?.id ?? null,
      });

      setSubmitted(true);
    } catch (submitError: any) {
      setSubmitError(submitError.message || "Failed to submit form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading form...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <Card className="w-full max-w-md border-slate-200 text-center shadow-sm">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <Card className="w-full max-w-md border-slate-200 text-center shadow-sm">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Thank You!</CardTitle>
            <CardDescription>Your response has been recorded successfully.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-500 shadow-sm">
            Connect Camp Form
          </span>
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="h-3 bg-slate-950" />
            <CardHeader className="bg-white">
              <CardTitle className="text-3xl tracking-tight text-slate-950">{form?.title}</CardTitle>
              {form?.description && (
                <CardDescription className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                  {form.description}
                </CardDescription>
              )}
              <div className="pt-3 text-sm text-slate-500">
                Fields marked with <span className="font-semibold text-red-600">*</span> are required.
              </div>
            </CardHeader>
          </Card>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {submitError && (
            <Card className="border-red-200 bg-red-50 shadow-sm">
              <CardContent className="pt-4 text-sm text-red-700">{submitError}</CardContent>
            </Card>
          )}

          {fields.map((field) => {
            if (field.type === "section") {
              return (
                <div key={field.id} className="px-1 pt-4">
                  <h3 className="text-lg font-semibold text-slate-950">{field.label}</h3>
                  {field.description && <p className="text-sm text-slate-500">{field.description}</p>}
                </div>
              );
            }

            return (
              <Card key={field.id} className="border-slate-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium text-slate-950">
                      {field.label}
                      {field.required && <span className="ml-1 text-red-600">*</span>}
                    </Label>
                    {field.description && (
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    )}

                    {field.type === "short_text" && (
                      <Input
                        required={Boolean(field.required)}
                        value={(answers[field.id] as string) || ""}
                        onChange={(event) => handleInputChange(field.id, event.target.value)}
                      />
                    )}

                    {field.type === "long_text" && (
                      <Textarea
                        required={Boolean(field.required)}
                        value={(answers[field.id] as string) || ""}
                        onChange={(event) => handleInputChange(field.id, event.target.value)}
                      />
                    )}

                    {field.type === "number" && (
                      <Input
                        type="number"
                        required={Boolean(field.required)}
                        value={(answers[field.id] as string) || ""}
                        onChange={(event) => handleInputChange(field.id, event.target.value)}
                      />
                    )}

                    {field.type === "dropdown" && (
                      <Select
                        value={(answers[field.id] as string) || ""}
                        onValueChange={(value) => handleInputChange(field.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {field.type === "radio" && (
                      <RadioGroup
                        value={(answers[field.id] as string) || ""}
                        onValueChange={(value) => handleInputChange(field.id, value)}
                      >
                        {(field.options ?? []).map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                            <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {(field.type === "checkboxes" || field.type === "checkbox") && (
                      <div className="space-y-2">
                        {(field.options ?? []).map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${field.id}-${option}`}
                              checked={((answers[field.id] as string[]) || []).includes(option)}
                              onCheckedChange={(checked) =>
                                handleCheckboxChange(field.id, option, Boolean(checked))
                              }
                            />
                            <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
                          </div>
                        ))}
                      </div>
                    )}

                    {field.type === "date" && (
                      <Input
                        type="date"
                        required={Boolean(field.required)}
                        value={(answers[field.id] as string) || ""}
                        onChange={(event) => handleInputChange(field.id, event.target.value)}
                      />
                    )}

                    {field.type === "time" && (
                      <Input
                        type="time"
                        required={Boolean(field.required)}
                        value={(answers[field.id] as string) || ""}
                        onChange={(event) => handleInputChange(field.id, event.target.value)}
                      />
                    )}

                    {field.type === "file" && (
                      <div className="space-y-2">
                        <Input
                          type="file"
                          className="bg-white"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              handleFileUpload(field.id, file);
                            }
                          }}
                        />
                        {uploadingFields[field.id] && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading file...
                          </div>
                        )}
                        {typeof answers[field.id] === "string" && (
                          <a
                            href={answers[field.id] as string}
                            className="text-sm text-blue-600 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Uploaded file
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              type="submit"
              disabled={submitting || uploadingCount > 0}
              className="min-w-[180px] bg-slate-950 hover:bg-slate-800"
            >
              {(submitting || uploadingCount > 0) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploadingCount > 0 ? "Finishing uploads..." : "Submit Response"}
            </Button>
          </div>
        </form>

        <p className="pb-4 text-center text-sm text-slate-500">
          This form is powered by Connect Camp. Responses are submitted directly to the organization that shared it with you.
        </p>
      </div>
    </div>
  );
}
