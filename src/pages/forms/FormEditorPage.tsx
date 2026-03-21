import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FormBuilder } from "@/components/forms/FormBuilder";
import type { FormEmailPolicy, FormField } from "@/types/forms";
import { useAuth } from "@/context/AuthContext";
import {
  fetchFormFields,
  getFormById,
  resolveFormsOrgId,
  saveForm,
  syncFormFields,
} from "@/lib/formsDataApi";

const OPTION_FIELD_TYPES = new Set(["dropdown", "checkboxes", "checkbox", "radio"]);

export default function FormEditorPage() {
  const { formId } = useParams();
  const isEditMode = Boolean(formId);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, profile } = useAuth();

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [emailPolicy, setEmailPolicy] = useState<FormEmailPolicy>("school_only");

  const [fields, setFields] = useState<FormField[]>([]);
  const [originalFieldIds, setOriginalFieldIds] = useState<Set<string>>(new Set());

  const orgId = useMemo(() => resolveFormsOrgId(profile?.org_id), [profile?.org_id]);

  useEffect(() => {
    if (isEditMode && formId) {
      fetchForm(formId);
    }
  }, [isEditMode, formId, orgId]);

  const fetchForm = async (id: string) => {
    try {
      setLoading(true);

      const [formData, fieldsData] = await Promise.all([
        getFormById(id, orgId),
        fetchFormFields(id),
      ]);

      if (!formData) {
        toast({
          title: "Form not found",
          description: "The requested form could not be loaded.",
          variant: "destructive",
        });
        navigate("/forms");
        return;
      }

      setTitle(formData.title);
      setDescription(formData.description || "");
      setIsActive(formData.is_active);
      setEmailPolicy(formData.email_policy);
      setFields(fieldsData);
      setOriginalFieldIds(new Set(fieldsData.map((field) => field.id)));
    } catch (error: any) {
      toast({
        title: "Error loading form",
        description: error.message || "Unable to load this form right now.",
        variant: "destructive",
      });
      navigate("/forms");
    } finally {
      setLoading(false);
    }
  };

  const validateFieldConfig = () => {
    if (!title.trim()) {
      return "Form title is required.";
    }

    if (fields.length === 0) {
      return "Add at least one field before saving.";
    }

    for (const field of fields) {
      if (!field.label.trim()) {
        return "Every field needs a label.";
      }

      if (OPTION_FIELD_TYPES.has(field.type)) {
        const options = (field.options ?? []).map((option) => option.trim()).filter(Boolean);
        if (options.length < 2) {
          return `Field \"${field.label}\" needs at least two options.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateFieldConfig();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const savedForm = await saveForm({
        id: isEditMode ? formId : undefined,
        title,
        description,
        isActive,
        emailPolicy,
        createdBy: session?.user?.id ?? null,
        orgId,
      });

      await syncFormFields({
        formId: savedForm.id,
        fields,
        originalFieldIds,
      });

      toast({
        title: "Success",
        description: "Form saved successfully.",
      });

      navigate(`/forms/${savedForm.id}/edit`, { replace: true });
      setOriginalFieldIds(new Set(fields.map((field) => field.id)));
    } catch (error: any) {
      toast({
        title: "Error saving form",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/forms")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isEditMode ? "Edit Form" : "Create New Form"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure form details and build your questions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/forms")}>Cancel</Button>
          {isEditMode && (
            <Button
              variant="outline"
              onClick={() => window.open(`/form-fill/${formId}`, "_blank")}
            >
              View Live Form
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Form
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">Form Settings</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Event Registration"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Briefly describe this form..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label>Active Status</Label>
                  <p className="text-xs text-muted-foreground">Enable to accept responses</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="space-y-2 rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label>Email Requirement</Label>
                  <p className="text-xs text-muted-foreground">
                    Public forms always require Full Name and Email Address. Choose which emails are allowed.
                  </p>
                </div>
                <Select
                  value={emailPolicy}
                  onValueChange={(value) => setEmailPolicy(value as FormEmailPolicy)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose email policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school_only">Montgomery College email only</SelectItem>
                    <SelectItem value="any">Allow any email address</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-6 font-semibold">Form Builder</h3>
            <FormBuilder fields={fields} onChange={setFields} />
          </div>
        </div>
      </div>
    </div>
  );
}
