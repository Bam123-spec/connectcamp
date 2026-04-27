import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  QrCode,
  FileText,
  Copy,
  Loader2,
  CheckCircle2,
  Ban,
  Search,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Layers3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { QrCodeDialog } from "@/components/forms/QrCodeDialog";
import type { Form } from "@/types/forms";
import { useAuth } from "@/context/AuthContext";
import { logAuditEventSafe } from "@/lib/auditApi";
import {
  deleteForm,
  duplicateForm,
  listForms,
  resolveFormsOrgId,
  updateFormActiveState,
} from "@/lib/formsDataApi";

type FilterKey = "all" | "live" | "public" | "internal" | "limited" | "inactive";

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "public", label: "Public" },
  { key: "internal", label: "Signed-in" },
  { key: "limited", label: "Rules" },
  { key: "inactive", label: "Closed" },
];

function getRuleSummary(form: Form) {
  const details: string[] = [];

  if (form.limit_one_response) {
    details.push("One response per email");
  }

  if (form.max_responses) {
    details.push(`Cap ${form.max_responses}`);
  }

  return details.length > 0 ? details.join(" • ") : "No submission limits";
}

function getFilterMatch(form: Form, filter: FilterKey) {
  switch (filter) {
    case "live":
      return form.is_active;
    case "public":
      return form.access_type === "public";
    case "internal":
      return form.access_type === "internal";
    case "limited":
      return form.limit_one_response || Boolean(form.max_responses);
    case "inactive":
      return !form.is_active;
    case "all":
    default:
      return true;
  }
}

export default function FormsListPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyFormId, setBusyFormId] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    void fetchForms();
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

  const metrics = useMemo(() => {
    const liveCount = forms.filter((form) => form.is_active).length;
    const internalCount = forms.filter((form) => form.access_type === "internal").length;
    const limitedCount = forms.filter((form) => form.limit_one_response || Boolean(form.max_responses)).length;

    return [
      {
        label: "Total forms",
        value: forms.length,
        helper: "All forms, surveys, and applications in this workspace",
        icon: Layers3,
        tone: "bg-slate-950 text-white",
      },
      {
        label: "Live now",
        value: liveCount,
        helper: "Forms currently accepting submissions",
        icon: CheckCircle2,
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Signed-in only",
        value: internalCount,
        helper: "Forms restricted to authenticated Connect Camp users",
        icon: LockKeyhole,
        tone: "bg-amber-50 text-amber-700",
      },
      {
        label: "Rules enabled",
        value: limitedCount,
        helper: "Forms using caps or one-response limits",
        icon: ShieldCheck,
        tone: "bg-blue-50 text-blue-700",
      },
    ];
  }, [forms]);

  const filteredForms = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return forms.filter((form) => {
      if (!getFilterMatch(form, activeFilter)) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        form.title,
        form.description ?? "",
        form.access_type === "internal" ? "signed-in internal" : "public",
        getRuleSummary(form),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [activeFilter, forms, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this form? This action cannot be undone.")) {
      return;
    }

    try {
      setBusyFormId(id);
      const existingForm = forms.find((form) => form.id === id);
      await deleteForm(id);
      setForms((prev) => prev.filter((form) => form.id !== id));
      void logAuditEventSafe({
        orgId: resolveFormsOrgId(profile?.org_id),
        category: "forms",
        action: "form_deleted",
        entityType: "form",
        entityId: id,
        title: "Form deleted",
        summary: `${existingForm?.title ?? "A form"} was deleted from the forms workspace.`,
        metadata: {
          access_type: existingForm?.access_type ?? null,
          was_active: existingForm?.is_active ?? null,
        },
      });
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
      setForms((prev) => prev.map((entry) => (entry.id === form.id ? { ...entry, is_active: nextActive } : entry)));
      void logAuditEventSafe({
        orgId: resolveFormsOrgId(profile?.org_id),
        category: "forms",
        action: "form_status_updated",
        entityType: "form",
        entityId: form.id,
        title: nextActive ? "Form activated" : "Form deactivated",
        summary: `${form.title} is now ${nextActive ? "accepting responses" : "closed to new responses"}.`,
        metadata: {
          previous_is_active: form.is_active,
          next_is_active: nextActive,
        },
      });
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

  const handleShareClick = (form: Form) => {
    setSelectedForm(form);
    setQrDialogOpen(true);
  };

  const handleDuplicate = async (form: Form) => {
    try {
      setBusyFormId(form.id);
      const duplicated = await duplicateForm(form.id, profile?.id ?? null, resolveFormsOrgId(profile?.org_id));
      setForms((prev) => [duplicated, ...prev]);
      void logAuditEventSafe({
        orgId: resolveFormsOrgId(profile?.org_id),
        category: "forms",
        action: "form_duplicated",
        entityType: "form",
        entityId: duplicated.id,
        title: "Form duplicated",
        summary: `${form.title} was duplicated into a new draft form.`,
        metadata: {
          source_form_id: form.id,
          source_form_title: form.title,
          duplicated_form_title: duplicated.title,
        },
      });
      toast({
        title: "Form duplicated",
        description: "A draft copy of this form has been created.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to duplicate form",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBusyFormId(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-6 pb-8">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(135deg,_#0f172a_0%,_#172554_52%,_#1e3a8a_100%)] px-6 py-7 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100">
                Form Operations
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">Build, govern, and share forms cleanly</h1>
                <p className="max-w-xl text-sm leading-6 text-slate-200">
                  This is the control surface for every application, registration form, and internal intake flow.
                  Keep public forms easy to share, keep internal forms protected, and make rule-heavy forms obvious at a glance.
                </p>
              </div>
            </div>

            <Button
              onClick={() => navigate("/forms/create")}
              className="h-11 rounded-xl bg-white text-slate-950 hover:bg-slate-100"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Form
            </Button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-200">{metric.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{metric.value}</p>
                    </div>
                    <div className={`rounded-2xl p-2 ${metric.tone}`}>
                      <MetricIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-200/90">{metric.helper}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, description, access type, or submission rule"
              className="h-11 rounded-xl border-slate-200 pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilter(option.key)}
                className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                  activeFilter === option.key
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Forms Directory</CardTitle>
          <CardDescription>
            {loading
              ? "Loading form inventory..."
              : `${filteredForms.length} of ${forms.length} form${forms.length === 1 ? "" : "s"} shown`}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading forms...
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
                <Search className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-slate-950">No forms match this view</p>
                <p className="text-sm text-slate-500">
                  Adjust the filters or search terms, or create a new form if you are starting fresh.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredForms.map((form) => (
                <div
                  key={form.id}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50/80 xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-950">{form.title}</h2>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            form.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {form.is_active ? "Accepting responses" : "Closed"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            form.access_type === "internal"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {form.access_type === "internal" ? "Signed-in only" : "Public link"}
                        </span>
                      </div>

                      <p className="line-clamp-2 max-w-3xl text-sm leading-6 text-slate-500">
                        {form.description?.trim() || "No description added yet."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        {form.access_type === "internal" ? (
                          <LockKeyhole className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Globe2 className="h-4 w-4 text-blue-600" />
                        )}
                        {form.access_type === "internal"
                          ? "Restricted to authenticated Connect Camp users"
                          : "Open to anyone with the shared link"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                        {getRuleSummary(form)}
                      </span>
                      <span className="text-slate-400">
                        Created {format(new Date(form.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:min-w-[260px] xl:items-end">
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Button variant="outline" onClick={() => navigate(`/forms/${form.id}/responses`)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Responses
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleShareClick(form)}
                        disabled={busyFormId === form.id}
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        Share
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-10 w-10 rounded-xl p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(form)} disabled={busyFormId === form.id}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShareClick(form)}>
                            <QrCode className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(form)}
                            disabled={busyFormId === form.id}
                          >
                            {form.is_active ? (
                              <>
                                <Ban className="mr-2 h-4 w-4" />
                                Close form
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Reopen form
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
                    </div>

                    {(form.success_message || form.redirect_url) && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        {form.redirect_url
                          ? "Uses custom thank-you redirect"
                          : "Uses custom thank-you message"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <QrCodeDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        formId={selectedForm?.id || null}
        formTitle={selectedForm?.title || ""}
        existingQrUrl={selectedForm?.qr_code_url || null}
      />

      <div className="mt-auto rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">End of forms directory</p>
            <p className="text-sm text-slate-500">
              {loading
                ? "Loading forms workspace..."
                : `${filteredForms.length} visible form${filteredForms.length === 1 ? "" : "s"} across this workspace.`}
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-full border-slate-200 bg-white"
            onClick={() => navigate("/forms/create")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create another form
          </Button>
        </div>
      </div>
    </div>
  );
}
