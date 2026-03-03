import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MoreHorizontal,
    Plus,
    Pencil,
    Trash2,
    QrCode,
    FileText,
    Loader2,
    CheckCircle2,
    Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QrCodeDialog } from "@/components/forms/QrCodeDialog";
import type { Form } from "@/types/forms";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import {
    deleteForm,
    listForms,
    resolveFormsOrgId,
    updateFormActiveState,
} from "@/lib/formsDataApi";

export default function FormsListPage() {
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyFormId, setBusyFormId] = useState<string | null>(null);
    const [qrDialogOpen, setQrDialogOpen] = useState(false);
    const [selectedForm, setSelectedForm] = useState<Form | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { profile } = useAuth();

    useEffect(() => {
        fetchForms();
    }, [profile?.org_id]);

    const fetchForms = async () => {
        try {
            setLoading(true);
            const data = await listForms(resolveFormsOrgId(profile?.org_id));
            setForms(data);
        } catch (error: any) {
            toast({
                title: "Error fetching forms",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this form? This action cannot be undone.")) {
            return;
        }

        try {
            setBusyFormId(id);
            await deleteForm(id);
            setForms((prev) => prev.filter((f) => f.id !== id));
            toast({
                title: "Form deleted",
                description: "The form has been successfully deleted.",
            });
        } catch (error: any) {
            toast({
                title: "Error deleting form",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setBusyFormId(null);
        }
    };

    const handleToggleStatus = async (form: Form) => {
        const nextActive = !form.is_active;
        try {
            setBusyFormId(form.id);
            await updateFormActiveState(form.id, nextActive);
            setForms((prev) =>
                prev.map((entry) =>
                    entry.id === form.id ? { ...entry, is_active: nextActive } : entry
                )
            );
            toast({
                title: nextActive ? "Form activated" : "Form deactivated",
                description: nextActive
                    ? "This form is now accepting responses."
                    : "This form is no longer accepting responses.",
            });
        } catch (error: any) {
            toast({
                title: "Unable to update form status",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setBusyFormId(null);
        }
    };

    const handleQrClick = (form: Form) => {
        setSelectedForm(form);
        setQrDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage forms, surveys, and applications.
                    </p>
                </div>
                <Button onClick={() => navigate("/forms/create")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Form
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading forms...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : forms.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No forms found. Create one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            forms.map((form) => (
                                <TableRow key={form.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{form.title}</span>
                                            {form.description && (
                                                <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                    {form.description}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${form.is_active
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-gray-100 text-gray-800"
                                                }`}
                                        >
                                            {form.is_active ? "Active" : "Disabled"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(form.created_at), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => navigate(`/forms/${form.id}/edit`)}
                                                >
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => navigate(`/forms/${form.id}/responses`)}
                                                >
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    View Responses
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleQrClick(form)}>
                                                    <QrCode className="mr-2 h-4 w-4" />
                                                    QR Code
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleToggleStatus(form)}
                                                    disabled={busyFormId === form.id}
                                                >
                                                    {form.is_active ? (
                                                        <>
                                                            <Ban className="mr-2 h-4 w-4" />
                                                            Disable
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                                            Activate
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => handleDelete(form.id)}
                                                    disabled={busyFormId === form.id}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <QrCodeDialog
                open={qrDialogOpen}
                onOpenChange={setQrDialogOpen}
                formId={selectedForm?.id || null}
                formTitle={selectedForm?.title || ""}
                existingQrUrl={selectedForm?.qr_code_url || null}
            />
        </div>
    );
}
