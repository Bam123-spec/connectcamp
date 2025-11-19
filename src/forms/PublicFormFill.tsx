import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchForm, fetchFormFields, submitForm, uploadFormFile } from "./api";
import type { FormFieldRecord, FormRecord } from "./types";
import { useAuth } from "@/context/AuthContext";

const PublicFormFill = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const [form, setForm] = useState<FormRecord | null>(null);
  const [fields, setFields] = useState<FormFieldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!formId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [formData, fieldData] = await Promise.all([fetchForm(formId), fetchFormFields(formId)]);
        if (!active) return;
        setForm(formData);
        setFields(fieldData);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [formId]);

  const updateValue = (fieldId: string, nextValue: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: nextValue }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formId) return;
    setSubmitting(true);
    try {
      const payload: Record<string, { label: string; value: string | string[] }> = {};
      for (const field of fields) {
        const rawValue = values[field.id];
        if (field.required && (rawValue === undefined || rawValue === "" || (Array.isArray(rawValue) && !rawValue.length))) {
          setSubmitting(false);
          toast({ title: "Missing value", description: `Field "${field.label}" is required.` });
          return;
        }

        if (field.type === "file" && rawValue instanceof File) {
          const url = await uploadFormFile(rawValue, formId, field.id);
          payload[field.id] = { label: field.label, value: url };
        } else if (rawValue !== undefined) {
          payload[field.id] = {
            label: field.label,
            value: Array.isArray(rawValue) ? rawValue.map((value) => String(value)) : String(rawValue),
          };
        }
      }

      await submitForm(formId, payload, session?.user?.id);
      toast({ title: "Submitted", description: "Thanks for sharing your response!" });
      navigate("/");
    } catch (error) {
      toast({ title: "Submission failed", description: error instanceof Error ? error.message : "Unknown error." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!form) {
    return <p className="text-sm text-muted-foreground">Form not found.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{form.title}</CardTitle>
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {fields.map((field) => (
              <FieldRenderer key={field.id} field={field} value={values[field.id]} onChange={(value) => updateValue(field.id, value)} />
            ))}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const FieldRenderer = ({
  field,
  value,
  onChange,
}: {
  field: FormFieldRecord;
  value: any;
  onChange: (value: any) => void;
}) => {
  if (field.type === "section") {
    return (
      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-sm font-semibold">{field.label}</p>
        {field.description && <p className="text-sm text-muted-foreground">{field.description}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      {renderInput(field, value, onChange)}
    </div>
  );
};

const renderInput = (field: FormFieldRecord, value: any, onChange: (next: any) => void) => {
  switch (field.type) {
    case "short_text":
      return <Input value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
    case "long_text":
      return <Textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
    case "number":
      return <Input type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
    case "dropdown":
      return (
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select option</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          {(field.options ?? []).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Array.isArray(value) ? value.includes(option) : false}
                onChange={(event) => {
                  const current = Array.isArray(value) ? value : [];
                  if (event.target.checked) {
                    onChange([...current, option]);
                  } else {
                    onChange(current.filter((item) => item !== option));
                  }
                }}
              />
              {option}
            </label>
          ))}
        </div>
      );
    case "radio":
      return (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          {(field.options ?? []).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input type="radio" name={field.id} checked={value === option} onChange={() => onChange(option)} />
              {option}
            </label>
          ))}
        </div>
      );
    case "date":
      return <Input type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
    case "time":
      return <Input type="time" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
    case "file":
      return (
        <Input
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onChange(file);
          }}
        />
      );
    default:
      return null;
  }
};

export default PublicFormFill;
