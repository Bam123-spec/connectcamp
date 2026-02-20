import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, ArrowLeft, Download, Eye } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Form, FormField, FormResponseWithAnswers } from "@/types/forms";

export default function FormResponsesPage() {
    const { formId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<Form | null>(null);
    const [fields, setFields] = useState<FormField[]>([]);
    const [responses, setResponses] = useState<FormResponseWithAnswers[]>([]);

    const [selectedResponse, setSelectedResponse] = useState<FormResponseWithAnswers | null>(null);

    useEffect(() => {
        if (formId) {
            fetchData(formId);
        }
    }, [formId]);

    const fetchData = async (id: string) => {
        setLoading(true);
        try {
            // 1. Fetch Form
            const { data: formData, error: formError } = await supabase
                .from("forms")
                .select("*")
                .eq("id", id)
                .single();

            if (formError) throw formError;
            setForm(formData);

            // 2. Fetch Fields
            const { data: fieldsData, error: fieldsError } = await supabase
                .from("form_fields")
                .select("*")
                .eq("form_id", id)
                .order("order", { ascending: true });

            if (fieldsError) throw fieldsError;
            setFields(fieldsData || []);

            // 3. Fetch Responses with Answers
            // Note: This might need pagination for large datasets
            const { data: responsesData, error: responsesError } = await supabase
                .from("form_responses")
                .select(`
          *,
          answers:form_response_answers(*)
        `)
                .eq("form_id", id)
                .order("created_at", { ascending: false });

            if (responsesError) throw responsesError;
            setResponses(responsesData || []);

        } catch (error: any) {
            toast({
                title: "Error loading data",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExportCsv = () => {
        if (!fields.length || !responses.length) return;

        // Header row
        const headers = ["Response ID", "Submitted At", "User ID", ...fields.map(f => f.label)];

        // Data rows
        const rows = responses.map(response => {
            const answerMap = new Map(response.answers.map(a => [a.field_id, a.answer]));

            const fieldValues = fields.map(field => {
                const val = answerMap.get(field.id);
                if (Array.isArray(val)) return val.join("; ");
                if (val === null || val === undefined) return "";
                return String(val);
            });

            return [
                response.id,
                format(new Date(response.created_at), "yyyy-MM-dd HH:mm:ss"),
                response.user_id || "Anonymous",
                ...fieldValues
            ];
        });

        // Convert to CSV string
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        // Download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${form?.title || "responses"}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getAnswerDisplay = (response: FormResponseWithAnswers, fieldId: string) => {
        const answer = response.answers.find(a => a.field_id === fieldId)?.answer;
        if (Array.isArray(answer)) return answer.join(", ");
        if (answer === null || answer === undefined) return "-";
        return String(answer);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/forms")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{form?.title}</h1>
                        <p className="text-sm text-muted-foreground">
                            Viewing {responses.length} responses
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleExportCsv} disabled={responses.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Submitted At</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {responses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    No responses yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            responses.map((response) => (
                                <TableRow key={response.id}>
                                    <TableCell>
                                        {format(new Date(response.created_at), "MMM d, yyyy h:mm a")}
                                    </TableCell>
                                    <TableCell>
                                        {response.user_id ? (
                                            <span className="font-mono text-xs">{response.user_id.slice(0, 8)}...</span>
                                        ) : (
                                            <span className="text-muted-foreground italic">Anonymous</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedResponse(response)}
                                        >
                                            <Eye className="mr-2 h-4 w-4" />
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Sheet open={Boolean(selectedResponse)} onOpenChange={(open) => !open && setSelectedResponse(null)}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Response Details</SheetTitle>
                        <SheetDescription>
                            Submitted on {selectedResponse && format(new Date(selectedResponse.created_at), "PPpp")}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-6">
                        {fields.map((field) => {
                            if (field.type === "section") {
                                return (
                                    <div key={field.id} className="pt-4 pb-2 border-b">
                                        <h3 className="font-semibold text-lg">{field.label}</h3>
                                    </div>
                                );
                            }
                            return (
                                <div key={field.id} className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
                                    <div className="rounded-md bg-muted/30 p-3 text-sm">
                                        {selectedResponse ? getAnswerDisplay(selectedResponse, field.id) : "-"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
