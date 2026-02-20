import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { FormBuilder } from "@/components/forms/FormBuilder";
import type { FormField } from "@/types/forms";

export default function FormEditorPage() {
    const { formId } = useParams();
    const isEditMode = Boolean(formId);
    const navigate = useNavigate();
    const { toast } = useToast();

    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);

    // Form Metadata
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isActive, setIsActive] = useState(true);

    // Fields
    const [fields, setFields] = useState<FormField[]>([]);
    const [originalFieldIds, setOriginalFieldIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isEditMode && formId) {
            fetchForm(formId);
        }
    }, [isEditMode, formId]);

    const fetchForm = async (id: string) => {
        setLoading(true);

        // Fetch Form Metadata
        const { data: formData, error: formError } = await supabase
            .from("forms")
            .select("*")
            .eq("id", id)
            .single();

        if (formError) {
            toast({
                title: "Error loading form",
                description: formError.message,
                variant: "destructive",
            });
            navigate("/forms");
            return;
        }

        setTitle(formData.title);
        setDescription(formData.description || "");
        setIsActive(formData.is_active);

        // Fetch Fields
        const { data: fieldsData, error: fieldsError } = await supabase
            .from("form_fields")
            .select("*")
            .eq("form_id", id)
            .order("order", { ascending: true });

        if (fieldsError) {
            toast({
                title: "Error loading fields",
                description: fieldsError.message,
                variant: "destructive",
            });
        } else {
            setFields(fieldsData || []);
            setOriginalFieldIds(new Set(fieldsData?.map((f) => f.id) || []));
        }

        setLoading(false);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast({
                title: "Validation Error",
                description: "Form title is required.",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);

        try {
            const user = (await supabase.auth.getUser()).data.user;

            // 1. Upsert Form
            const formPayload = {
                title,
                description,
                is_active: isActive,
                updated_at: new Date().toISOString(),
                ...(isEditMode ? { id: formId } : { created_by: user?.id }),
            };

            const { data: savedForm, error: formError } = await supabase
                .from("forms")
                .upsert(formPayload)
                .select()
                .single();

            if (formError) throw formError;

            const currentFormId = savedForm.id;

            // 2. Handle Fields

            // Identify deleted fields
            const currentFieldIds = new Set(fields.map((f) => f.id));
            const fieldsToDelete = Array.from(originalFieldIds).filter(
                (id) => !currentFieldIds.has(id)
            );

            if (fieldsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("form_fields")
                    .delete()
                    .in("id", fieldsToDelete);

                if (deleteError) throw deleteError;
            }

            // Upsert current fields
            if (fields.length > 0) {
                const fieldsToUpsert = fields.map((field, index) => ({
                    ...field,
                    form_id: currentFormId,
                    order: index,
                }));

                const { error: upsertError } = await supabase
                    .from("form_fields")
                    .upsert(fieldsToUpsert);

                if (upsertError) throw upsertError;
            }

            toast({
                title: "Success",
                description: "Form saved successfully.",
            });

            navigate("/forms");
        } catch (error: any) {
            console.error("Save error:", error);
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
                    <Button variant="outline" onClick={() => navigate("/forms")}>
                        Cancel
                    </Button>
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
                                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Event Registration"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Briefly describe this form..."
                                    className="min-h-[100px]"
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <Label>Active Status</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Enable to accept responses
                                    </p>
                                </div>
                                <Switch
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                />
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
