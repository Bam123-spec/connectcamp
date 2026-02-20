import { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabaseClient";
import type { Form, FormField } from "@/types/forms";

export default function PublicFormPage() {
    const { formId } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<Form | null>(null);
    const [fields, setFields] = useState<FormField[]>([]);
    const [answers, setAnswers] = useState<Record<string, any>>({});

    useEffect(() => {
        if (formId) {
            fetchForm(formId);
        }
    }, [formId]);

    const fetchForm = async (id: string) => {
        setLoading(true);
        setError(null);

        const { data: formData, error: formError } = await supabase
            .from("forms")
            .select("*")
            .eq("id", id)
            .single();

        if (formError || !formData) {
            setError("Form not found or unavailable.");
            setLoading(false);
            return;
        }

        if (!formData.is_active) {
            setError("This form is currently not accepting responses.");
            setLoading(false);
            return;
        }

        setForm(formData);

        const { data: fieldsData, error: fieldsError } = await supabase
            .from("form_fields")
            .select("*")
            .eq("form_id", id)
            .order("order", { ascending: true });

        if (fieldsError) {
            setError("Error loading form questions.");
        } else {
            setFields(fieldsData || []);
        }

        setLoading(false);
    };

    const handleInputChange = (fieldId: string, value: any) => {
        setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    };

    const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
        setAnswers((prev) => {
            const current = (prev[fieldId] as string[]) || [];
            if (checked) {
                return { ...prev, [fieldId]: [...current, option] };
            } else {
                return { ...prev, [fieldId]: current.filter((opt) => opt !== option) };
            }
        });
    };

    const handleFileUpload = async (fieldId: string, file: File) => {
        // Simple upload implementation
        const fileName = `${formId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
            .from("form_uploads") // Ensure this bucket exists or use a generic one
            .upload(fileName, file);

        if (error) {
            console.error("Upload error:", error);
            alert("File upload failed. Please try again.");
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from("form_uploads")
            .getPublicUrl(fileName);

        handleInputChange(fieldId, publicUrlData.publicUrl);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formId) return;

        setSubmitting(true);

        try {
            // 1. Create Response
            const { data: responseData, error: responseError } = await supabase
                .from("form_responses")
                .insert({
                    form_id: formId,
                    // user_id: we could grab this if we had auth on public page, but usually it's anon
                })
                .select()
                .single();

            if (responseError) throw responseError;

            // 2. Create Answers
            const answersToInsert = Object.entries(answers).map(([fieldId, answer]) => ({
                response_id: responseData.id,
                field_id: fieldId,
                answer,
            }));

            if (answersToInsert.length > 0) {
                const { error: answersError } = await supabase
                    .from("form_response_answers")
                    .insert(answersToInsert);

                if (answersError) throw answersError;
            }

            setSubmitted(true);
        } catch (err: any) {
            console.error("Submission error:", err);
            alert("Failed to submit form. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md text-center">
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
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <CardTitle>Thank You!</CardTitle>
                        <CardDescription>
                            Your response has been recorded successfully.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-6">
                <Card>
                    <CardHeader className="border-b bg-white">
                        <CardTitle className="text-2xl">{form?.title}</CardTitle>
                        {form?.description && (
                            <CardDescription className="mt-2 text-base">
                                {form.description}
                            </CardDescription>
                        )}
                    </CardHeader>
                </Card>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {fields.map((field) => {
                        if (field.type === "section") {
                            return (
                                <div key={field.id} className="pt-4">
                                    <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
                                    {field.description && (
                                        <p className="text-sm text-gray-500">{field.description}</p>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <Card key={field.id}>
                                <CardContent className="pt-6">
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium">
                                            {field.label}
                                        </Label>
                                        {field.description && (
                                            <p className="text-sm text-muted-foreground">
                                                {field.description}
                                            </p>
                                        )}

                                        {/* Field Inputs */}
                                        {field.type === "short_text" && (
                                            <Input
                                                required
                                                value={answers[field.id] || ""}
                                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                            />
                                        )}

                                        {field.type === "long_text" && (
                                            <Textarea
                                                required
                                                value={answers[field.id] || ""}
                                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                            />
                                        )}

                                        {field.type === "number" && (
                                            <Input
                                                type="number"
                                                required
                                                value={answers[field.id] || ""}
                                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                            />
                                        )}

                                        {field.type === "dropdown" && (
                                            <Select
                                                value={answers[field.id] || ""}
                                                onValueChange={(val) => handleInputChange(field.id, val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select an option" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {field.options?.map((opt) => (
                                                        <SelectItem key={opt} value={opt}>
                                                            {opt}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {field.type === "radio" && (
                                            <RadioGroup
                                                value={answers[field.id] || ""}
                                                onValueChange={(val) => handleInputChange(field.id, val)}
                                            >
                                                {field.options?.map((opt) => (
                                                    <div key={opt} className="flex items-center space-x-2">
                                                        <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                                                        <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        )}

                                        {field.type === "checkboxes" && (
                                            <div className="space-y-2">
                                                {field.options?.map((opt) => (
                                                    <div key={opt} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`${field.id}-${opt}`}
                                                            checked={(answers[field.id] || []).includes(opt)}
                                                            onCheckedChange={(checked) =>
                                                                handleCheckboxChange(field.id, opt, checked as boolean)
                                                            }
                                                        />
                                                        <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {field.type === "date" && (
                                            <Input
                                                type="date"
                                                required
                                                value={answers[field.id] || ""}
                                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                            />
                                        )}

                                        {field.type === "time" && (
                                            <Input
                                                type="time"
                                                required
                                                value={answers[field.id] || ""}
                                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                            />
                                        )}

                                        {field.type === "file" && (
                                            <Input
                                                type="file"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleFileUpload(field.id, file);
                                                }}
                                            />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    <div className="flex justify-end pt-4">
                        <Button size="lg" type="submit" disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Response
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
