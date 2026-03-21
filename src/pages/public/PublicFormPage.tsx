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
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, LockKeyhole, Ban } from "lucide-react";
import type { Form, FormField } from "@/types/forms";
import {
  SCHOOL_EMAIL_DOMAIN,
  fetchFormFields,
  getFormSubmissionState,
  getFormById,
  submitFormResponse,
  uploadFormFile,
} from "@/lib/formsDataApi";
import { useAuth } from "@/context/AuthContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PublicFormPage() {
  const { formId } = useParams();
  const { session, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [fullName, setFullName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");

  const uploadingCount = useMemo(
    () => Object.values(uploadingFields).filter(Boolean).length,
    [uploadingFields],
  );
  const normalizedEmail = useMemo(() => emailAddress.trim().toLowerCase(), [emailAddress]);

  useEffect(() => {
    if (profile?.full_name && !fullName) {
      setFullName(profile.full_name);
    }
    if ((profile?.email || session?.user?.email) && !emailAddress) {
      setEmailAddress(profile?.email ?? session?.user?.email ?? "");
    }
  }, [profile?.email, profile?.full_name, session?.user?.email, fullName, emailAddress]);

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

      setForm(loadedForm);

      const loadedFields = await fetchFormFields(id);
      setFields(loadedFields);
    } catch (loadError: any) {
      setError(loadError.message || "Error loading this form.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!formId || !form) return;

    let cancelled = false;
    const checkAvailability = async () => {
      try {
        const state = await getFormSubmissionState(formId, normalizedEmail || null);
        if (!cancelled && state) {
          if (state.reason === "already_submitted") {
            setAvailabilityError("A response has already been submitted with this email address.");
          } else {
            setAvailabilityError(null);
          }
        }
      } catch {
        if (!cancelled) {
          setAvailabilityError(null);
        }
      }
    };

    void checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [form, formId, normalizedEmail]);

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
    if (!fullName.trim()) {
      return "\"Full Name\" is required.";
    }

    if (!normalizedEmail) {
      return "\"Email Address\" is required.";
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return "Enter a valid email address.";
    }

    if (form?.email_policy === "school_only" && !normalizedEmail.endsWith(SCHOOL_EMAIL_DOMAIN)) {
      return `This form only accepts Montgomery College email addresses (${SCHOOL_EMAIL_DOMAIN}).`;
    }

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
      setAvailabilityError(null);

      await submitFormResponse({
        formId,
        answers,
        fields,
        respondentName: fullName.trim(),
        respondentEmail: normalizedEmail,
        userId: session?.user?.id ?? null,
      });

      setSubmitted(true);
    } catch (submitError: any) {
      setSubmitError(submitError.message || "Failed to submit form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!submitted || !form?.redirect_url) return;

    const redirectTimer = window.setTimeout(() => {
      window.location.assign(form.redirect_url as string);
    }, 2500);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [submitted, form?.redirect_url]);

  const closedState = useMemo(() => {
    if (!form) return null;
    if (!form.is_active) {
      return {
        title: "Form Closed",
        description: "This form is no longer accepting responses.",
        icon: Ban,
      };
    }
    if (form.access_type === "internal" && !session?.user) {
      return {
        title: "Sign-In Required",
        description: "This form is limited to signed-in Connect Camp users. Open it from an authenticated Connect Camp session to continue.",
        icon: LockKeyhole,
      };
    }
    return null;
  }, [form, session?.user]);

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
            <CardDescription>
              {form?.success_message?.trim() || "Your response has been recorded successfully."}
            </CardDescription>
            {form?.redirect_url && (
              <div className="pt-4">
                <Button asChild className="bg-slate-950 hover:bg-slate-800">
                  <a href={form.redirect_url} target="_self" rel="noreferrer">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <p className="mt-3 text-xs text-slate-500">
                  Redirecting automatically in a moment.
                </p>
              </div>
            )}
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (closedState) {
    const ClosedIcon = closedState.icon;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <Card className="w-full max-w-xl border-slate-200 text-center shadow-sm">
          <div className="h-3 bg-slate-950" />
          <CardHeader className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <ClosedIcon className="h-7 w-7 text-slate-700" />
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Connect Camp Form
              </span>
              <CardTitle className="text-2xl text-slate-950">{closedState.title}</CardTitle>
              <CardDescription className="mx-auto max-w-md text-base leading-7 text-slate-600">
                {closedState.description}
              </CardDescription>
            </div>
            {form && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-left">
                <p className="text-sm font-semibold text-slate-950">{form.title}</p>
                {form.description && <p className="mt-2 text-sm text-slate-500">{form.description}</p>}
              </div>
            )}
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
              <div className="text-sm text-slate-500">
                {form?.email_policy === "school_only"
                  ? `Email restriction: only Montgomery College email addresses (${SCHOOL_EMAIL_DOMAIN}) are accepted.`
                  : "Email restriction: any valid email address is accepted."}
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

          {availabilityError && !submitError && (
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="pt-4 text-sm text-amber-800">{availabilityError}</CardContent>
            </Card>
          )}

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-950">Your information</h2>
                <p className="text-sm text-slate-500">
                  These details are required with every submission.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="respondent-full-name" className="text-base font-medium text-slate-950">
                  Full Name <span className="ml-1 text-red-600">*</span>
                </Label>
                <Input
                  id="respondent-full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="respondent-email" className="text-base font-medium text-slate-950">
                  Email Address <span className="ml-1 text-red-600">*</span>
                </Label>
                <Input
                  id="respondent-email"
                  type="email"
                  value={emailAddress}
                  onChange={(event) => setEmailAddress(event.target.value)}
                  placeholder={
                    form?.email_policy === "school_only"
                      ? `name${SCHOOL_EMAIL_DOMAIN}`
                      : "Enter your email address"
                  }
                  autoComplete="email"
                />
                <p className="text-xs text-slate-500">
                  {form?.email_policy === "school_only"
                    ? `Only ${SCHOOL_EMAIL_DOMAIN} email addresses can submit this form.`
                    : "Any valid email address is accepted for this form."}
                </p>
              </div>
            </CardContent>
          </Card>

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
                        <p className="text-xs text-slate-500">
                          Uploads may take a moment. Keep this page open until the file finishes processing.
                        </p>
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
              disabled={submitting || uploadingCount > 0 || availabilityError !== null}
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
