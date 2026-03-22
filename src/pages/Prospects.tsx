import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logAuditEventSafe } from "@/lib/auditApi";
import {
  addProspectNote,
  convertProspectToClub,
  createProspectClub,
  createProspectRequirement,
  deleteProspectRequirement,
  ensureProspectConversation,
  fetchProspectWorkspace,
  setProspectStatus,
  updateProspectClub,
  updateProspectRequirement,
  type ProspectActivityRow,
  type ProspectAdminProfile,
  type ProspectClubRow,
  type ProspectFormOption,
  type ProspectNoteRow,
  type ProspectRequirementRow,
  type ProspectRequirementType,
  type ProspectStatus,
} from "@/lib/prospectsApi";
import { cn } from "@/lib/utils";

type OwnerFilter = "all" | "mine" | "unassigned";

type ProspectWithInsights = ProspectClubRow & {
  completedRequirements: number;
  totalRequirements: number;
  noteCount: number;
  latestActivityAt: string | null;
  conversationId: string | null;
};

type CreateProspectForm = {
  name: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  assignedTo: string;
  notesSummary: string;
  coverImageUrl: string;
};

type RequirementForm = {
  label: string;
  requirementType: ProspectRequirementType;
  linkedFormId: string;
  documentUrl: string;
  notes: string;
};

const STAGE_ORDER: ProspectStatus[] = [
  "new",
  "reviewing",
  "needs_documents",
  "meeting_scheduled",
  "approved",
  "rejected",
  "converted",
];

const ACTIVE_STAGES = STAGE_ORDER.filter((stage) => stage !== "converted");

const STAGE_META: Record<ProspectStatus, { label: string; tone: string; description: string }> = {
  new: {
    label: "New",
    tone: "bg-slate-100 text-slate-700",
    description: "Fresh inquiries waiting for initial triage.",
  },
  reviewing: {
    label: "Reviewing",
    tone: "bg-blue-100 text-blue-700",
    description: "Student Life is actively reviewing the intake.",
  },
  needs_documents: {
    label: "Needs documents",
    tone: "bg-amber-100 text-amber-800",
    description: "The prospect is missing required paperwork or evidence.",
  },
  meeting_scheduled: {
    label: "Meeting scheduled",
    tone: "bg-violet-100 text-violet-700",
    description: "An intake meeting is on the calendar.",
  },
  approved: {
    label: "Approved",
    tone: "bg-emerald-100 text-emerald-700",
    description: "Ready to convert into an official club.",
  },
  rejected: {
    label: "Rejected",
    tone: "bg-rose-100 text-rose-700",
    description: "Closed out and not moving forward.",
  },
  converted: {
    label: "Converted",
    tone: "bg-sky-100 text-sky-700",
    description: "Now an official club in the workspace.",
  },
};

const REQUIREMENT_TYPES: Array<{ value: ProspectRequirementType; label: string }> = [
  { value: "document", label: "Document" },
  { value: "form", label: "Form" },
  { value: "meeting", label: "Meeting" },
  { value: "roster", label: "Roster" },
  { value: "advisor", label: "Advisor" },
  { value: "other", label: "Other" },
];

const initialCreateForm: CreateProspectForm = {
  name: "",
  description: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  assignedTo: "unassigned",
  notesSummary: "",
  coverImageUrl: "",
};

const initialRequirementForm: RequirementForm = {
  label: "",
  requirementType: "document",
  linkedFormId: "none",
  documentUrl: "",
  notes: "",
};

function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeDate(value: string | null) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getActivityLabel(entry: ProspectActivityRow) {
  switch (entry.action) {
    case "created":
      return "Prospect created";
    case "status_changed":
      return `Stage moved to ${STAGE_META[(entry.to_status as ProspectStatus) ?? "new"].label}`;
    case "assignment_changed":
      return "Owner assignment updated";
    case "meeting_updated":
      return "Meeting timing updated";
    case "note_added":
      return "Internal note added";
    case "requirement_completed":
      return `Requirement completed: ${String(entry.payload.label ?? "Checklist item")}`;
    case "requirement_reopened":
      return `Requirement reopened: ${String(entry.payload.label ?? "Checklist item")}`;
    case "converted_to_club":
      return "Converted to official club";
    default:
      return entry.action.replaceAll("_", " ");
  }
}

function ProspectKpi({
  label,
  value,
  helper,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Lightbulb;
  loading: boolean;
}) {
  return (
    <Card className="rounded-[20px] border-slate-200 shadow-sm">
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>}
            <p className="mt-1 text-sm text-slate-500">{helper}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Prospects() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;
  const userId = profile?.id ?? null;

  const [prospects, setProspects] = useState<ProspectClubRow[]>([]);
  const [requirements, setRequirements] = useState<ProspectRequirementRow[]>([]);
  const [notes, setNotes] = useState<ProspectNoteRow[]>([]);
  const [activity, setActivity] = useState<ProspectActivityRow[]>([]);
  const [admins, setAdmins] = useState<ProspectAdminProfile[]>([]);
  const [forms, setForms] = useState<ProspectFormOption[]>([]);
  const [conversations, setConversations] = useState<{ id: string; prospect_id: string | null; updated_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [requirementDialogOpen, setRequirementDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ProspectRequirementRow | null>(null);
  const [createForm, setCreateForm] = useState<CreateProspectForm>(initialCreateForm);
  const [requirementForm, setRequirementForm] = useState<RequirementForm>(initialRequirementForm);
  const [noteDraft, setNoteDraft] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<ProspectStatus>("new");

  const loadWorkspace = useCallback(async (isRefresh = false) => {
    if (!orgId) {
      setError("This admin account is missing an organization context.");
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const payload = await fetchProspectWorkspace(orgId);
      setProspects(payload.prospects);
      setRequirements(payload.requirements);
      setNotes(payload.notes);
      setActivity(payload.activity);
      setAdmins(payload.admins);
      setForms(payload.forms);
      setConversations(payload.conversations);
      setError(null);
    } catch (workspaceError) {
      setError(workspaceError instanceof Error ? workspaceError.message : "Failed to load prospects workspace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const adminMap = useMemo(() => new Map(admins.map((admin) => [admin.id, admin])), [admins]);
  const notesByProspect = useMemo(() => {
    const map = new Map<string, ProspectNoteRow[]>();
    notes.forEach((entry) => {
      map.set(entry.prospect_id, [...(map.get(entry.prospect_id) ?? []), entry]);
    });
    return map;
  }, [notes]);
  const activityByProspect = useMemo(() => {
    const map = new Map<string, ProspectActivityRow[]>();
    activity.forEach((entry) => {
      map.set(entry.prospect_id, [...(map.get(entry.prospect_id) ?? []), entry]);
    });
    return map;
  }, [activity]);
  const requirementsByProspect = useMemo(() => {
    const map = new Map<string, ProspectRequirementRow[]>();
    requirements.forEach((entry) => {
      map.set(entry.prospect_id, [...(map.get(entry.prospect_id) ?? []), entry]);
    });
    return map;
  }, [requirements]);
  const conversationsByProspect = useMemo(() => {
    const map = new Map<string, string>();
    conversations.forEach((entry) => {
      if (entry.prospect_id) map.set(entry.prospect_id, entry.id);
    });
    return map;
  }, [conversations]);

  const prospectsWithInsights = useMemo(() => {
    return prospects.map((prospect) => {
      const checklist = requirementsByProspect.get(prospect.id) ?? [];
      const prospectNotes = notesByProspect.get(prospect.id) ?? [];
      const prospectActivity = activityByProspect.get(prospect.id) ?? [];
      return {
        ...prospect,
        completedRequirements: checklist.filter((item) => item.is_complete).length,
        totalRequirements: checklist.length,
        noteCount: prospectNotes.length,
        latestActivityAt: prospectActivity[0]?.created_at ?? prospect.updated_at,
        conversationId: conversationsByProspect.get(prospect.id) ?? null,
      } satisfies ProspectWithInsights;
    });
  }, [activityByProspect, conversationsByProspect, notesByProspect, prospects, requirementsByProspect]);

  const filteredProspects = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return prospectsWithInsights.filter((prospect) => {
      const matchesSearch =
        !term ||
        [prospect.name, prospect.description, prospect.contact_name, prospect.contact_email, prospect.notes_summary]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchesOwner =
        ownerFilter === "all"
          ? true
          : ownerFilter === "mine"
            ? prospect.assigned_to === userId
            : !prospect.assigned_to;

      return matchesSearch && matchesOwner;
    });
  }, [ownerFilter, prospectsWithInsights, searchQuery, userId]);

  const groupedProspects = useMemo(() => {
    return STAGE_ORDER.reduce<Record<ProspectStatus, ProspectWithInsights[]>>((accumulator, stage) => {
      accumulator[stage] = filteredProspects.filter((prospect) => prospect.status === stage);
      return accumulator;
    }, {
      new: [],
      reviewing: [],
      needs_documents: [],
      meeting_scheduled: [],
      approved: [],
      rejected: [],
      converted: [],
    });
  }, [filteredProspects]);

  const summary = useMemo(() => {
    const total = prospectsWithInsights.length;
    const active = prospectsWithInsights.filter((item) => item.status !== "converted" && item.status !== "rejected").length;
    const approved = prospectsWithInsights.filter((item) => item.status === "approved").length;
    const needsDocs = prospectsWithInsights.filter((item) => item.status === "needs_documents").length;
    const meetings = prospectsWithInsights.filter((item) => item.status === "meeting_scheduled").length;
    const converted = prospectsWithInsights.filter((item) => item.status === "converted").length;
    const readyForConversion = prospectsWithInsights.filter((item) => item.status === "approved" && !item.linked_club_id).length;
    return { total, active, approved, needsDocs, meetings, converted, readyForConversion };
  }, [prospectsWithInsights]);

  const selectedProspect = useMemo(
    () => prospectsWithInsights.find((prospect) => prospect.id === selectedProspectId) ?? null,
    [prospectsWithInsights, selectedProspectId],
  );

  useEffect(() => {
    if (selectedProspect) {
      setSelectedStage(selectedProspect.status);
    }
  }, [selectedProspect]);

  const openProspect = (prospectId: string) => {
    setSelectedProspectId(prospectId);
    setDetailOpen(true);
  };

  const handleCreateProspect = async () => {
    if (!orgId || !userId || !createForm.name.trim()) return;

    setActioning("create");
    try {
      const created = await createProspectClub({
        orgId,
        createdBy: userId,
        name: createForm.name,
        description: createForm.description,
        contactName: createForm.contactName,
        contactEmail: createForm.contactEmail,
        contactPhone: createForm.contactPhone,
        assignedTo: createForm.assignedTo === "unassigned" ? null : createForm.assignedTo,
        notesSummary: createForm.notesSummary,
        coverImageUrl: createForm.coverImageUrl,
      });

      await loadWorkspace(true);
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      openProspect(created.id);
      void logAuditEventSafe({
        orgId,
        category: "prospects",
        action: "prospect_created",
        entityType: "prospect",
        entityId: created.id,
        title: "Prospect created",
        summary: `${created.name} entered the prospect pipeline.`,
        metadata: {
          assigned_to: created.assigned_to,
          contact_email: created.contact_email,
          origin: created.origin,
        },
      });
      toast({ title: "Prospect created", description: "The new prospect has an intake record, checklist, and messaging path." });
    } catch (createError) {
      toast({
        title: "Unable to create prospect",
        description: createError instanceof Error ? createError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleSaveProspect = async () => {
    if (!selectedProspect) return;
    setActioning("save-prospect");
    try {
      await updateProspectClub(selectedProspect.id, {
        name: selectedProspect.name,
        description: selectedProspect.description,
        assigned_to: selectedProspect.assigned_to,
        contact_name: selectedProspect.contact_name,
        contact_email: selectedProspect.contact_email,
        contact_phone: selectedProspect.contact_phone,
        notes_summary: selectedProspect.notes_summary,
        cover_image_url: selectedProspect.cover_image_url,
        meeting_scheduled_for: selectedProspect.meeting_scheduled_for,
      });
      await loadWorkspace(true);
      void logAuditEventSafe({
        orgId,
        category: "prospects",
        action: "prospect_updated",
        entityType: "prospect",
        entityId: selectedProspect.id,
        title: "Prospect updated",
        summary: `${selectedProspect.name} details were updated.`,
        metadata: {
          assigned_to: selectedProspect.assigned_to,
          meeting_scheduled_for: selectedProspect.meeting_scheduled_for,
          contact_email: selectedProspect.contact_email,
        },
      });
      toast({ title: "Prospect updated", description: "Prospect details were saved." });
    } catch (saveError) {
      toast({
        title: "Unable to save prospect",
        description: saveError instanceof Error ? saveError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedProspect) return;
    setActioning("status");
    try {
      await setProspectStatus({
        prospectId: selectedProspect.id,
        status: selectedStage,
        note: statusNote,
        scheduledFor: selectedStage === "meeting_scheduled" ? selectedProspect.meeting_scheduled_for : null,
      });
      setStatusNote("");
      await loadWorkspace(true);
      void logAuditEventSafe({
        orgId,
        category: "prospects",
        action: "prospect_status_updated",
        entityType: "prospect",
        entityId: selectedProspect.id,
        title: "Prospect stage updated",
        summary: `${selectedProspect.name} moved to ${STAGE_META[selectedStage].label}.`,
        metadata: {
          status: selectedStage,
          note: statusNote || null,
          scheduled_for: selectedStage === "meeting_scheduled" ? selectedProspect.meeting_scheduled_for : null,
        },
      });
      toast({ title: "Stage updated", description: `Prospect moved to ${STAGE_META[selectedStage].label}.` });
    } catch (statusError) {
      toast({
        title: "Unable to update stage",
        description: statusError instanceof Error ? statusError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleAddNote = async () => {
    if (!selectedProspect || !noteDraft.trim()) return;
    setActioning("note");
    try {
      const noteBody = noteDraft.trim();
      await addProspectNote(selectedProspect.id, noteDraft);
      setNoteDraft("");
      await loadWorkspace(true);
      void logAuditEventSafe({
        orgId,
        category: "prospects",
        action: "prospect_note_added",
        entityType: "prospect",
        entityId: selectedProspect.id,
        title: "Prospect note added",
        summary: `A note was added to ${selectedProspect.name}.`,
        metadata: {
          note_preview: noteBody.slice(0, 160),
        },
      });
      toast({ title: "Note added", description: "The note is now part of the prospect history." });
    } catch (noteError) {
      toast({
        title: "Unable to add note",
        description: noteError instanceof Error ? noteError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleOpenChat = async () => {
    if (!selectedProspect) return;
    setActioning("chat");
    try {
      const conversationId = await ensureProspectConversation(selectedProspect.id);
      window.localStorage.setItem("cc.messaging.focusConversation", conversationId);
      navigate("/messaging");
    } catch (chatError) {
      toast({
        title: "Unable to open prospect chat",
        description: chatError instanceof Error ? chatError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleConvert = async () => {
    if (!selectedProspect) return;
    setActioning("convert");
    try {
      const clubId = await convertProspectToClub(selectedProspect.id);
      await loadWorkspace(true);
      void logAuditEventSafe({
        orgId,
        category: "prospects",
        action: "prospect_converted",
        entityType: "prospect",
        entityId: selectedProspect.id,
        title: "Prospect converted",
        summary: `${selectedProspect.name} was converted into an official club.`,
        metadata: {
          club_id: clubId,
        },
      });
      toast({ title: "Prospect converted", description: "The prospect is now an official club in the workspace." });
      navigate("/clubs");
      window.localStorage.setItem("cc.clubs.highlight", clubId);
    } catch (convertError) {
      toast({
        title: "Unable to convert prospect",
        description: convertError instanceof Error ? convertError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleRequirementSave = async () => {
    if (!selectedProspect || !requirementForm.label.trim()) return;
    setActioning("requirement");
    try {
      if (editingRequirement) {
        await updateProspectRequirement({
          requirementId: editingRequirement.id,
          updates: {
            label: requirementForm.label,
            requirement_type: requirementForm.requirementType,
            linked_form_id: requirementForm.linkedFormId === "none" ? null : requirementForm.linkedFormId,
            document_url: requirementForm.documentUrl,
            notes: requirementForm.notes,
          },
        });
      } else {
        await createProspectRequirement({
          prospectId: selectedProspect.id,
          orgId: selectedProspect.org_id,
          label: requirementForm.label,
          requirementType: requirementForm.requirementType,
          linkedFormId: requirementForm.linkedFormId === "none" ? null : requirementForm.linkedFormId,
          documentUrl: requirementForm.documentUrl,
          notes: requirementForm.notes,
          displayOrder: (requirementsByProspect.get(selectedProspect.id)?.length ?? 0) * 10 + 50,
        });
      }
      setRequirementDialogOpen(false);
      setEditingRequirement(null);
      setRequirementForm(initialRequirementForm);
      await loadWorkspace(true);
    } catch (requirementError) {
      toast({
        title: "Unable to save requirement",
        description: requirementError instanceof Error ? requirementError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleRequirementToggle = async (requirement: ProspectRequirementRow, nextComplete: boolean) => {
    if (!userId) return;
    setActioning(requirement.id);
    try {
      await updateProspectRequirement({
        requirementId: requirement.id,
        completedBy: userId,
        updates: { is_complete: nextComplete },
      });
      await loadWorkspace(true);
    } catch (toggleError) {
      toast({
        title: "Unable to update checklist",
        description: toggleError instanceof Error ? toggleError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const handleRequirementDelete = async (requirementId: string) => {
    setActioning(requirementId);
    try {
      await deleteProspectRequirement(requirementId);
      await loadWorkspace(true);
    } catch (deleteError) {
      toast({
        title: "Unable to delete requirement",
        description: deleteError instanceof Error ? deleteError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActioning(null);
    }
  };

  const selectedRequirements = selectedProspect ? requirementsByProspect.get(selectedProspect.id) ?? [] : [];
  const selectedNotes = selectedProspect ? notesByProspect.get(selectedProspect.id) ?? [] : [];
  const selectedActivity = selectedProspect ? activityByProspect.get(selectedProspect.id) ?? [] : [];

  if (error) {
    return (
      <Card className="rounded-[24px] border-red-200 bg-red-50/70">
        <CardContent className="px-6 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-red-500">Prospects pipeline</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">The intake workspace failed to load.</h1>
          <p className="mt-3 max-w-2xl text-sm text-red-700">{error}</p>
          <Button className="mt-6" onClick={() => loadWorkspace(true)}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <Card className="rounded-[28px] border-slate-200 shadow-sm">
        <CardContent className="px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Prospect pipeline</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Move new club ideas through a real onboarding workflow.</h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                This is where Student Life triages new organizations, tracks requirements, schedules intake meetings,
                and converts approved prospects into official clubs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => loadWorkspace(true)} disabled={refreshing}>
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New prospect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <ProspectKpi label="Total" value={summary.total} helper="Prospects in the pipeline" icon={Lightbulb} loading={loading} />
        <ProspectKpi label="Active" value={summary.active} helper="Still moving toward a decision" icon={ClipboardList} loading={loading} />
        <ProspectKpi label="Needs docs" value={summary.needsDocs} helper="Waiting on paperwork or forms" icon={FileText} loading={loading} />
        <ProspectKpi label="Meetings" value={summary.meetings} helper="Intake meetings on the calendar" icon={CalendarClock} loading={loading} />
        <ProspectKpi label="Approved" value={summary.approved} helper={`${summary.readyForConversion} ready to convert`} icon={ShieldCheck} loading={loading} />
        <ProspectKpi label="Converted" value={summary.converted} helper="Already official clubs" icon={CheckCircle2} loading={loading} />
      </div>

      <Card className="rounded-[24px] border-slate-200 shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-2xl tracking-tight">Intake board</CardTitle>
              <CardDescription>
                Filter the queue, open a prospect, and push it forward only when the checklist and review state are actually ready.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search prospects, contacts, and notes"
                  className="pl-9"
                />
              </div>
              <Select value={ownerFilter} onValueChange={(value) => setOwnerFilter(value as OwnerFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="mine">Assigned to me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="rounded-[20px] border-slate-200">
                  <CardContent className="space-y-3 px-4 py-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[1560px] grid-cols-7 gap-4">
                {STAGE_ORDER.map((stage) => (
                  <div key={stage} className="rounded-[22px] border border-slate-200 bg-slate-50/60">
                    <div className="border-b border-slate-200 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{STAGE_META[stage].label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{STAGE_META[stage].description}</p>
                        </div>
                        <Badge className={cn("rounded-full border-0", STAGE_META[stage].tone)}>{groupedProspects[stage].length}</Badge>
                      </div>
                    </div>
                    <div className="space-y-3 p-3">
                      {groupedProspects[stage].length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-500">
                          No prospects in this stage.
                        </div>
                      ) : (
                        groupedProspects[stage].map((prospect) => {
                          const owner = prospect.assigned_to ? adminMap.get(prospect.assigned_to) : null;
                          return (
                            <button
                              key={prospect.id}
                              type="button"
                              onClick={() => openProspect(prospect.id)}
                              className="w-full rounded-[20px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-semibold leading-6 text-slate-950">{prospect.name}</p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {prospect.contact_name || prospect.contact_email || "No primary contact on file"}
                                  </p>
                                </div>
                                <Badge className={cn("rounded-full border-0", STAGE_META[prospect.status].tone)}>
                                  {STAGE_META[prospect.status].label}
                                </Badge>
                              </div>

                              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                                {prospect.notes_summary || prospect.description || "No intake summary added yet."}
                              </p>

                              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist</p>
                                  <p className="mt-1 font-semibold text-slate-950">
                                    {prospect.completedRequirements}/{prospect.totalRequirements}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Owner</p>
                                  <p className="mt-1 truncate font-semibold text-slate-950">{owner?.full_name || owner?.email || "Unassigned"}</p>
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                <span>{prospect.meeting_scheduled_for ? formatDateTime(prospect.meeting_scheduled_for) : "Meeting not scheduled"}</span>
                                <span>{formatRelativeDate(prospect.latestActivityAt)}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Create prospect</DialogTitle>
            <DialogDescription>
              Start a new club inquiry with the right owner, contact details, checklist, and internal messaging path from day one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <Field label="Prospect name" required>
              <Input value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Example: Ethiopian Literature Collective" />
            </Field>
            <Field label="Assigned admin">
              <Select value={createForm.assignedTo} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, assignedTo: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>{admin.full_name || admin.email || "Admin"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Primary contact name">
              <Input value={createForm.contactName} onChange={(event) => setCreateForm((prev) => ({ ...prev, contactName: event.target.value }))} placeholder="Student organizer" />
            </Field>
            <Field label="Primary contact email">
              <Input value={createForm.contactEmail} onChange={(event) => setCreateForm((prev) => ({ ...prev, contactEmail: event.target.value }))} placeholder="student@montgomerycollege.com" />
            </Field>
            <Field label="Primary contact phone">
              <Input value={createForm.contactPhone} onChange={(event) => setCreateForm((prev) => ({ ...prev, contactPhone: event.target.value }))} placeholder="Optional" />
            </Field>
            <Field label="Cover image URL">
              <Input value={createForm.coverImageUrl} onChange={(event) => setCreateForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))} placeholder="Optional image URL" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <Textarea value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="What is the proposed organization about?" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Internal intake summary">
                <Textarea value={createForm.notesSummary} onChange={(event) => setCreateForm((prev) => ({ ...prev, notesSummary: event.target.value }))} rows={3} placeholder="Use this for triage context, intake notes, and immediate next steps." />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProspect} disabled={actioning === "create" || !createForm.name.trim()}>
              {actioning === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create prospect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requirementDialogOpen} onOpenChange={setRequirementDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingRequirement ? "Edit requirement" : "Add requirement"}</DialogTitle>
            <DialogDescription>
              Attach document work, linked forms, or meeting checkpoints to the prospect intake checklist.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Requirement label" required>
                <Input value={requirementForm.label} onChange={(event) => setRequirementForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Constitution review completed" />
              </Field>
            </div>
            <Field label="Requirement type">
              <Select value={requirementForm.requirementType} onValueChange={(value) => setRequirementForm((prev) => ({ ...prev, requirementType: value as ProspectRequirementType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Linked form">
              <Select value={requirementForm.linkedFormId} onValueChange={(value) => setRequirementForm((prev) => ({ ...prev, linkedFormId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked form</SelectItem>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>{form.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Document URL">
                <Input value={requirementForm.documentUrl} onChange={(event) => setRequirementForm((prev) => ({ ...prev, documentUrl: event.target.value }))} placeholder="Optional policy doc, Drive link, or intake attachment" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Notes">
                <Textarea value={requirementForm.notes} onChange={(event) => setRequirementForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="How should Student Life verify this item?" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequirementDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRequirementSave} disabled={actioning === "requirement" || !requirementForm.label.trim()}>
              {actioning === "requirement" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Save requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          {selectedProspect ? (
            <div className="pb-8">
              <SheetHeader>
                <SheetTitle className="text-2xl tracking-tight">{selectedProspect.name}</SheetTitle>
                <SheetDescription>
                  Drive intake work, checklist completion, messaging, and conversion from one place.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Badge className={cn("rounded-full border-0", STAGE_META[selectedProspect.status].tone)}>
                  {STAGE_META[selectedProspect.status].label}
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">
                  {selectedProspect.completedRequirements}/{selectedProspect.totalRequirements} checklist complete
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">
                  {selectedProspect.noteCount} notes
                </Badge>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleOpenChat} disabled={actioning === "chat"}>
                  {actioning === "chat" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                  Open chat
                </Button>
                <Button onClick={handleConvert} disabled={actioning === "convert" || selectedProspect.status === "converted"}>
                  {actioning === "convert" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  Convert to official club
                </Button>
              </div>

              <Tabs defaultValue="overview" className="mt-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="checklist">Checklist</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 pt-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Prospect name" required>
                      <Input value={selectedProspect.name} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, name: event.target.value } : prospect))} />
                    </Field>
                    <Field label="Assigned admin">
                      <Select value={selectedProspect.assigned_to ?? "unassigned"} onValueChange={(value) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, assigned_to: value === "unassigned" ? null : value } : prospect))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {admins.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>{admin.full_name || admin.email || "Admin"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Primary contact name">
                      <Input value={selectedProspect.contact_name ?? ""} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, contact_name: event.target.value } : prospect))} />
                    </Field>
                    <Field label="Primary contact email">
                      <Input value={selectedProspect.contact_email ?? ""} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, contact_email: event.target.value } : prospect))} />
                    </Field>
                    <Field label="Primary contact phone">
                      <Input value={selectedProspect.contact_phone ?? ""} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, contact_phone: event.target.value } : prospect))} />
                    </Field>
                    <Field label="Meeting scheduled for">
                      <Input type="datetime-local" value={selectedProspect.meeting_scheduled_for ? new Date(selectedProspect.meeting_scheduled_for).toISOString().slice(0, 16) : ""} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, meeting_scheduled_for: event.target.value ? new Date(event.target.value).toISOString() : null } : prospect))} />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Description">
                        <Textarea rows={4} value={selectedProspect.description ?? ""} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, description: event.target.value } : prospect))} />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Internal intake summary">
                        <Textarea rows={3} value={selectedProspect.notes_summary ?? ""} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, notes_summary: event.target.value } : prospect))} />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Cover image URL">
                        <Input value={selectedProspect.cover_image_url ?? ""} onChange={(event) => setProspects((prev) => prev.map((prospect) => prospect.id === selectedProspect.id ? { ...prospect, cover_image_url: event.target.value } : prospect))} />
                      </Field>
                    </div>
                  </div>

                  <Card className="rounded-[20px] border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg tracking-tight">Stage control</CardTitle>
                      <CardDescription>Use explicit stages so Student Life knows whether the blocker is docs, review, the meeting, or final approval.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                        <Field label="Stage">
                          <Select value={selectedStage} onValueChange={(value) => setSelectedStage(value as ProspectStatus)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTIVE_STAGES.map((stage) => (
                                <SelectItem key={stage} value={stage}>{STAGE_META[stage].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Status note">
                          <Textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} rows={3} placeholder="Optional note when changing the stage." />
                        </Field>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={handleStatusUpdate} disabled={actioning === "status"}>
                          {actioning === "status" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                          Update stage
                        </Button>
                        <Button variant="outline" onClick={handleSaveProspect} disabled={actioning === "save-prospect"}>
                          {actioning === "save-prospect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                          Save prospect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="checklist" className="space-y-5 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Requirements</h3>
                      <p className="text-sm text-slate-500">Track the forms, documents, meetings, and advisor confirmation needed before conversion.</p>
                    </div>
                    <Button variant="outline" onClick={() => { setEditingRequirement(null); setRequirementForm(initialRequirementForm); setRequirementDialogOpen(true); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add requirement
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedRequirements.length === 0 ? (
                      <Card className="rounded-[20px] border-dashed border-slate-200">
                        <CardContent className="px-5 py-6 text-sm text-slate-500">No checklist items yet.</CardContent>
                      </Card>
                    ) : (
                      selectedRequirements.map((requirement) => (
                        <Card key={requirement.id} className="rounded-[20px] border-slate-200 shadow-sm">
                          <CardContent className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => handleRequirementToggle(requirement, !requirement.is_complete)} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", requirement.is_complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600") }>
                                  {requirement.is_complete ? "Complete" : "Open"}
                                </button>
                                <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">{requirement.requirement_type.replaceAll("_", " ")}</Badge>
                                {requirement.linked_form_id ? <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">Linked form</Badge> : null}
                              </div>
                              <p className="mt-3 text-base font-semibold text-slate-950">{requirement.label}</p>
                              <p className="mt-1 text-sm text-slate-500">{requirement.notes || "No additional instructions."}</p>
                              {requirement.document_url ? (
                                <a href={requirement.document_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
                                  Open linked document
                                </a>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" onClick={() => {
                                setEditingRequirement(requirement);
                                setRequirementForm({
                                  label: requirement.label,
                                  requirementType: requirement.requirement_type,
                                  linkedFormId: requirement.linked_form_id ?? "none",
                                  documentUrl: requirement.document_url ?? "",
                                  notes: requirement.notes ?? "",
                                });
                                setRequirementDialogOpen(true);
                              }}>
                                Edit
                              </Button>
                              <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => handleRequirementDelete(requirement.id)} disabled={actioning === requirement.id}>
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-5 pt-5">
                  <Card className="rounded-[20px] border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg tracking-tight">Internal notes</CardTitle>
                      <CardDescription>Capture reviewer comments, next-step instructions, and anything the next admin needs to know.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={4} placeholder="Add an internal note for the prospect record." />
                      <Button onClick={handleAddNote} disabled={actioning === "note" || !noteDraft.trim()}>
                        {actioning === "note" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Add note
                      </Button>
                    </CardContent>
                  </Card>
                  <div className="space-y-3">
                    {selectedNotes.length === 0 ? (
                      <Card className="rounded-[20px] border-dashed border-slate-200">
                        <CardContent className="px-5 py-6 text-sm text-slate-500">No internal notes yet.</CardContent>
                      </Card>
                    ) : (
                      selectedNotes.map((note) => {
                        const author = adminMap.get(note.author_id);
                        return (
                          <Card key={note.id} className="rounded-[20px] border-slate-200 shadow-sm">
                            <CardContent className="px-5 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-950">{author?.full_name || author?.email || "Admin"}</p>
                                <span className="text-xs text-slate-500">{formatDateTime(note.created_at)}</span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-slate-600">{note.body}</p>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="pt-5">
                  <div className="space-y-3">
                    {selectedActivity.length === 0 ? (
                      <Card className="rounded-[20px] border-dashed border-slate-200">
                        <CardContent className="px-5 py-6 text-sm text-slate-500">No history yet.</CardContent>
                      </Card>
                    ) : (
                      selectedActivity.map((entry) => {
                        const actor = entry.actor_id ? adminMap.get(entry.actor_id) : null;
                        return (
                          <Card key={entry.id} className="rounded-[20px] border-slate-200 shadow-sm">
                            <CardContent className="px-5 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">{getActivityLabel(entry)}</p>
                                  <p className="mt-1 text-xs text-slate-500">{actor?.full_name || actor?.email || "System"}</p>
                                </div>
                                <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">Select a prospect to inspect its pipeline.</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

export default Prospects;
