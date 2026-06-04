import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Lightbulb,
  Loader2,
  Mail,
  MessageSquare,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMessaging } from "@/hooks/useMessaging";
import { logAuditEventSafe } from "@/lib/auditApi";
import {
  addConversationAccess,
  type ConversationAccessMember,
  type ConversationAccessState,
  type ConversationCategory,
  fetchConversationAccessState,
  fetchRecipientOptions,
  findMessagingUserByEmail,
  type MessagingDirectoryUser,
  type MessagingProfile,
  removeConversationAccess,
  type RecipientOption,
  type RecipientTab,
  searchMessagingUsers,
  syncClubMessagingPaths,
} from "@/lib/messagingApi";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: {
  key: ConversationCategory;
  label: string;
  subtitle: string;
  emptyMessage: string;
  newChatCta: string;
  icon: typeof Building2;
  summaryTone: string;
  summaryText: string;
}[] = [
  {
    key: "clubs",
    label: "Clubs Chat",
    subtitle: "Official clubs and active organization accounts.",
    emptyMessage: "No club conversations yet.",
    newChatCta: "Start a club chat",
    icon: Building2,
    summaryTone: "border-sky-200 bg-sky-50 text-sky-700",
    summaryText: "Approved clubs",
  },
  {
    key: "admins",
    label: "Admins Chat",
    subtitle: "Internal coordination with Student Life staff.",
    emptyMessage: "No admin conversations yet.",
    newChatCta: "Start an admin chat",
    icon: Shield,
    summaryTone: "border-violet-200 bg-violet-50 text-violet-700",
    summaryText: "Internal",
  },
  {
    key: "prospects",
    label: "Prospects",
    subtitle: "Prospective clubs still moving through approval.",
    emptyMessage: "No prospect conversations yet.",
    newChatCta: "Start a prospect chat",
    icon: Lightbulb,
    summaryTone: "border-amber-200 bg-amber-50 text-amber-700",
    summaryText: "Pre-approval",
  },
];

const CATEGORY_META = Object.fromEntries(
  CATEGORY_ORDER.map((item) => [item.key, item]),
) as Record<ConversationCategory, (typeof CATEGORY_ORDER)[number]>;

const RECIPIENT_PLACEHOLDER: Record<RecipientTab, string> = {
  club: "Search official clubs...",
  admin: "Search admins...",
  prospect: "Search prospect clubs...",
};

const RECIPIENT_EMPTY_COPY: Record<RecipientTab, string> = {
  club: "No official clubs found.",
  admin: "No admins found.",
  prospect: "No prospect clubs found.",
};

const COMPOSER_HINT: Record<ConversationCategory, string> = {
  clubs: "Use club chats for follow-up, reminders, and direct support.",
  admins: "Use admin chats for cross-campus coordination and internal handoff.",
  prospects: "Use prospect chats for onboarding, requirements, and next steps.",
};

const COMPOSER_PLACEHOLDER: Record<ConversationCategory, string> = {
  clubs: "Message this club...",
  admins: "Message another admin...",
  prospects: "Message this prospect club...",
};

const ADMIN_ROLES = new Set(["admin", "student_life_admin", "super_admin"]);

const EMPTY_ACCESS_STATE: ConversationAccessState = {
  directMembers: [],
  suggestedMembers: [],
  latestMessageAt: null,
  latestMessagePreview: "",
  readSummary: {
    totalMembers: 0,
    adminMembers: 0,
    clubMembers: 0,
    seenLatestCount: 0,
  },
};

const isNearBottom = (element: HTMLElement) => {
  const threshold = 120;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
};

function formatReadState(member: ConversationAccessMember) {
  switch (member.readState) {
    case "seen_latest":
      return {
        label: "Seen latest",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "read_earlier":
      return {
        label: member.lastReadAt
          ? `Read ${formatDistanceToNowStrict(new Date(member.lastReadAt), { addSuffix: true })}`
          : "Read earlier",
        tone: "border-slate-200 bg-slate-100 text-slate-600",
      };
    case "unread":
      return {
        label: "Unread",
        tone: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "not_added":
      return {
        label: "Not added",
        tone: "border-sky-200 bg-sky-50 text-sky-700",
      };
    default:
      return {
        label: "No messages yet",
        tone: "border-slate-200 bg-slate-100 text-slate-600",
      };
  }
}

function Messaging() {
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const userId = session?.user?.id ?? null;

  const {
    orgId,
    conversationSearch,
    setConversationSearch,
    conversations,
    conversationsLoading,
    conversationsError,
    refreshConversations,
    selectedConversationId,
    setSelectedConversationId,
    selectedConversation,
    messages,
    messagesLoading,
    messagesError,
    refreshMessages,
    loadingOlderMessages,
    hasMoreMessages,
    sendingMessage,
    sendMessage,
    loadOlderMessages,
    creatingConversation,
    startConversation,
  } = useMessaging({
    userId,
    profile: (profile as MessagingProfile | null) ?? null,
  });

  const [composerValue, setComposerValue] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConversationTab, setNewConversationTab] = useState<RecipientTab>("club");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
  const [loadingRecipientOptions, setLoadingRecipientOptions] = useState(false);
  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string | null>(null);
  const [syncingClubPaths, setSyncingClubPaths] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [accessState, setAccessState] = useState<ConversationAccessState>(EMPTY_ACCESS_STATE);
  const [accessLoading, setAccessLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState<MessagingDirectoryUser[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [emailAccess, setEmailAccess] = useState("");
  const [addingAccess, setAddingAccess] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [bulkAddingSuggested, setBulkAddingSuggested] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const groupedConversations = useMemo(() => {
    const groups: Record<ConversationCategory, typeof conversations> = {
      clubs: [],
      admins: [],
      prospects: [],
    };

    conversations.forEach((conversation) => {
      groups[conversation.category].push(conversation);
    });

    return groups;
  }, [conversations]);

  const summaryCards = useMemo(
    () =>
      CATEGORY_ORDER.map((group) => ({
        ...group,
        count: groupedConversations[group.key].length,
        unread: groupedConversations[group.key].reduce(
          (total, conversation) => total + conversation.unreadCount,
          0,
        ),
      })),
    [groupedConversations],
  );

  const selectedRecipient = useMemo(
    () => recipientOptions.find((option) => option.key === selectedRecipientKey) ?? null,
    [recipientOptions, selectedRecipientKey],
  );

  const existingAccessUserIds = useMemo(
    () =>
      new Set([
        ...accessState.directMembers.map((member) => member.id),
        ...accessState.suggestedMembers.map((member) => member.id),
      ]),
    [accessState.directMembers, accessState.suggestedMembers],
  );

  const participantMap = useMemo(
    () =>
      new Map(
        accessState.directMembers.map((member) => [
          member.id,
          member.fullName || member.email || "Participant",
        ]),
      ),
    [accessState.directMembers],
  );

  const suggestedMembers = useMemo(
    () => accessState.suggestedMembers.filter((member) => !member.isCurrentUser),
    [accessState.suggestedMembers],
  );

  const clubMembersCount = accessState.readSummary.clubMembers || selectedConversation?.clubMemberCount || 0;
  const selectedConversationNeedsAccess = selectedConversation?.targetType === "club" && clubMembersCount === 0;
  const seenLatestCount = accessState.readSummary.seenLatestCount;
  const totalMembers = accessState.readSummary.totalMembers || accessState.directMembers.length;

  const eligibleDirectoryUsers = useMemo(() => {
    if (!selectedConversation) return directoryUsers;
    if (selectedConversation.targetType === "club") return directoryUsers;

    return directoryUsers.filter((user) => ADMIN_ROLES.has(user.role ?? ""));
  }, [directoryUsers, selectedConversation]);

  const participantManagerDescription = useMemo(() => {
    if (!selectedConversation) return "Manage who can access this conversation.";
    if (selectedConversation.targetType === "club") {
      return "Grant access to officers, club-linked accounts, or internal staff so this club thread is actually reachable from both sides.";
    }
    if (selectedConversation.targetType === "prospect") {
      return "Prospect threads are internal by default. Add the right Student Life staff so intake, review, and follow-up stay coordinated.";
    }
    return "Admin chats should stay internal. Add or remove staff cleanly so the thread matches the actual working group.";
  }, [selectedConversation]);

  const directorySectionTitle = selectedConversation?.targetType === "club" ? "Add from workspace users" : "Add internal participant";
  const directorySectionDescription = selectedConversation?.targetType === "club"
    ? "Search existing workspace users and grant this chat directly."
    : "Search admin accounts in this workspace and attach them to the conversation.";

  const refreshAccessState = useCallback(async () => {
    if (!selectedConversation) {
      setAccessState(EMPTY_ACCESS_STATE);
      return;
    }

    setAccessLoading(true);
    try {
      const nextState = await fetchConversationAccessState({
        conversationId: selectedConversation.id,
        clubId: selectedConversation.targetType === "club" ? selectedConversation.targetId : null,
      });
      setAccessState(nextState);
    } finally {
      setAccessLoading(false);
    }
  }, [selectedConversation]);

  const userEligibleForConversation = useCallback(
    (user: Pick<MessagingDirectoryUser, "role">) => {
      if (!selectedConversation) return false;
      if (selectedConversation.targetType === "club") return true;
      return ADMIN_ROLES.has(user.role ?? "");
    },
    [selectedConversation],
  );

  const grantAccessAndRefresh = useCallback(
    async (targetUserId: string, metadata?: Record<string, unknown>) => {
      if (!selectedConversation) return;

      setAddingAccess(true);
      try {
        await addConversationAccess({
          conversationId: selectedConversation.id,
          userId: targetUserId,
        });

        await Promise.all([refreshConversations(), refreshAccessState()]);
        setEmailAccess("");

        void logAuditEventSafe({
          orgId,
          category: "messaging",
          action: "conversation_access_granted",
          entityType: "conversation",
          entityId: selectedConversation.id,
          title: "Conversation access granted",
          summary: `${selectedConversation.title} access was granted to a workspace user.`,
          metadata: {
            conversationTitle: selectedConversation.title,
            targetType: selectedConversation.targetType,
            targetId: selectedConversation.targetId,
            grantedUserId: targetUserId,
            ...metadata,
          },
        });

        toast({
          title: "Access granted",
          description: "This user can now open the chat.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Could not grant access",
          description: error instanceof Error ? error.message : "Please retry.",
        });
      } finally {
        setAddingAccess(false);
      }
    },
    [orgId, refreshAccessState, refreshConversations, selectedConversation, toast],
  );

  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [selectedConversationId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !autoScrollEnabled) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [autoScrollEnabled, messages]);

  useEffect(() => {
    if (!selectedConversation) {
      setAccessState(EMPTY_ACCESS_STATE);
      return;
    }

    let active = true;
    refreshAccessState().catch((error) => {
      if (!active) return;
      toast({
        variant: "destructive",
        title: "Could not load participants",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    });

    return () => {
      active = false;
    };
  }, [refreshAccessState, selectedConversation, toast]);

  useEffect(() => {
    if (!newConversationOpen || !orgId || !userId) return;

    let active = true;
    setLoadingRecipientOptions(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const nextOptions = await fetchRecipientOptions({
          orgId,
          tab: newConversationTab,
          search: recipientSearch,
          currentUserId: userId,
        });

        if (!active) return;

        setRecipientOptions(nextOptions);
        if (nextOptions.length === 0) {
          setSelectedRecipientKey(null);
        } else if (!nextOptions.some((option) => option.key === selectedRecipientKey)) {
          setSelectedRecipientKey(nextOptions[0].key);
        }
      } catch (error) {
        if (!active) return;

        toast({
          variant: "destructive",
          title: "Could not load recipients",
          description: error instanceof Error ? error.message : "Please retry.",
        });
      } finally {
        if (active) {
          setLoadingRecipientOptions(false);
        }
      }
    }, 160);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [newConversationOpen, newConversationTab, orgId, recipientSearch, selectedRecipientKey, toast, userId]);

  useEffect(() => {
    if (!accessDialogOpen || !userId || !orgId) return;

    let active = true;
    setDirectoryLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const nextUsers = await searchMessagingUsers({
          orgId,
          search: directorySearch,
          excludeUserIds: Array.from(existingAccessUserIds),
          currentUserId: userId,
        });

        if (!active) return;
        setDirectoryUsers(nextUsers);
      } catch (error) {
        if (!active) return;
        toast({
          variant: "destructive",
          title: "Could not load workspace users",
          description: error instanceof Error ? error.message : "Please retry.",
        });
      } finally {
        if (active) setDirectoryLoading(false);
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [accessDialogOpen, directorySearch, existingAccessUserIds, orgId, toast, userId]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    setAutoScrollEnabled(isNearBottom(container));
  };

  const handleSendMessage = async () => {
    const body = composerValue.trim();
    if (!body) return;

    try {
      await sendMessage(body);
      setComposerValue("");
      setAutoScrollEnabled(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Message could not be sent.",
      });
    }
  };

  const handleComposerKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  const handleStartConversation = async () => {
    if (!selectedRecipient) return;

    try {
      await startConversation(selectedRecipient.targetType, selectedRecipient.targetId);
      setNewConversationOpen(false);
      setRecipientSearch("");
      setSelectedRecipientKey(null);
      toast({
        title: "Conversation ready",
        description: `You can now message ${selectedRecipient.label}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not start chat",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    }
  };

  const openNewConversation = (tab: RecipientTab) => {
    setNewConversationTab(tab);
    setRecipientSearch("");
    setSelectedRecipientKey(null);
    setNewConversationOpen(true);
  };

  const handleSyncClubPaths = async () => {
    if (!orgId || !userId) {
      toast({
        variant: "destructive",
        title: "Workspace context required",
        description: "This admin account is missing either a user session or an organization context.",
      });
      return;
    }

    setSyncingClubPaths(true);
    try {
      const result = await syncClubMessagingPaths({ orgId, currentUserId: userId });
      await refreshConversations();
      void logAuditEventSafe({
        orgId,
        category: "messaging",
        action: "club_channels_synced",
        entityType: "workspace",
        entityId: orgId,
        title: "Club channels synced",
        summary: `${result.clubCount} clubs were checked for messaging coverage.`,
        metadata: result,
      });
      toast({
        title: "Club channels synced",
        description: `${result.clubCount} clubs checked, ${result.createdCount} channels created, ${result.connectedCount} connected to your inbox.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not sync club channels",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    } finally {
      setSyncingClubPaths(false);
    }
  };

  const handleGrantAccess = async (targetUserId: string) => {
    if (!selectedConversation) return;

    const candidate = directoryUsers.find((user) => user.id === targetUserId) ?? null;
    if (candidate && !userEligibleForConversation(candidate)) {
      toast({
        variant: "destructive",
        title: "Not allowed in this thread",
        description: "Only internal admin accounts can be added to this conversation.",
      });
      return;
    }

    await grantAccessAndRefresh(targetUserId, {
      source: candidate ? "directory" : "manual",
      grantedRole: candidate?.role ?? null,
      grantedEmail: candidate?.email ?? null,
    });
  };

  const handleGrantSuggestedMember = async (member: ConversationAccessMember) => {
    await grantAccessAndRefresh(member.id, {
      source: "suggested_member",
      grantedEmail: member.email,
      grantedTags: member.tags,
    });
  };

  const handleGrantAllSuggested = async () => {
    if (suggestedMembers.length === 0) return;

    setBulkAddingSuggested(true);
    try {
      for (const member of suggestedMembers) {
        await addConversationAccess({
          conversationId: selectedConversation!.id,
          userId: member.id,
        });
      }

      await Promise.all([refreshConversations(), refreshAccessState()]);
      void logAuditEventSafe({
        orgId,
        category: "messaging",
        action: "conversation_access_bulk_granted",
        entityType: "conversation",
        entityId: selectedConversation?.id ?? null,
        title: "Suggested club-side access granted",
        summary: `${suggestedMembers.length} suggested members were added to ${selectedConversation?.title ?? "the conversation"}.`,
        metadata: {
          conversationTitle: selectedConversation?.title ?? null,
          grantedUserIds: suggestedMembers.map((member) => member.id),
        },
      });
      toast({
        title: "Suggested access granted",
        description: `${suggestedMembers.length} members can now open this chat.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not add suggested members",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    } finally {
      setBulkAddingSuggested(false);
    }
  };

  const handleGrantAccessByEmail = async () => {
    const normalized = emailAccess.trim().toLowerCase();
    if (!normalized) return;
    if (!orgId) {
      toast({
        variant: "destructive",
        title: "Workspace context required",
        description: "This admin account is missing an organization context.",
      });
      return;
    }

    try {
      const user = await findMessagingUserByEmail({
        orgId,
        email: normalized,
      });
      if (!user) {
        toast({
          variant: "destructive",
          title: "No account found",
          description: "Use Add Members or User Management first, then grant chat access here.",
        });
        return;
      }

      if (!userEligibleForConversation(user)) {
        toast({
          variant: "destructive",
          title: "Not allowed in this thread",
          description: "Only internal admin accounts can be added to this conversation.",
        });
        return;
      }

      await grantAccessAndRefresh(user.id, {
        source: "email_lookup",
        grantedEmail: user.email,
        grantedRole: user.role,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not add by email",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    }
  };

  const handleRemoveAccess = async (member: ConversationAccessMember) => {
    if (!selectedConversation) return;

    setRemovingMemberId(member.id);
    try {
      await removeConversationAccess({
        conversationId: selectedConversation.id,
        userId: member.id,
      });
      await Promise.all([refreshConversations(), refreshAccessState()]);
      void logAuditEventSafe({
        orgId,
        category: "messaging",
        action: "conversation_access_removed",
        entityType: "conversation",
        entityId: selectedConversation.id,
        title: "Conversation access removed",
        summary: `${member.fullName || member.email || "A workspace user"} was removed from ${selectedConversation.title}.`,
        metadata: {
          conversationTitle: selectedConversation.title,
          targetType: selectedConversation.targetType,
          removedUserId: member.id,
          removedEmail: member.email,
          removedTags: member.tags,
        },
      });
      toast({
        title: "Participant removed",
        description: "This user no longer has access to the conversation.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not remove participant",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const selectedMeta = selectedConversation ? CATEGORY_META[selectedConversation.category] : null;
  const readHeadline = accessState.latestMessageAt
    ? `${seenLatestCount} of ${Math.max(totalMembers, 1)} participants have seen the latest message.`
    : "No messages yet, so there is no read state to show yet.";

  if (!userId) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="max-w-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50">
            <Shield className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">Sign in required</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Messaging only loads after this workspace has an authenticated user session.
          </p>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center rounded-[28px] border border-amber-200 bg-amber-50 p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="max-w-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-amber-200 bg-white text-amber-700">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-amber-950">Workspace context is missing</h2>
          <p className="mt-3 text-sm leading-6 text-amber-900/80">
            This account does not currently resolve to an organization. Messaging is blocked until the user is attached to the workspace.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline" className="rounded-full border-amber-300 bg-white">
              <Link to="/users">Open user management</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-amber-300 bg-white">
              <Link to="/settings">Open settings</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-background shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <aside className="flex w-[390px] flex-col border-r border-slate-200 bg-slate-50/80">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Messaging</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Inbox</h2>
              <p className="mt-1 text-sm text-slate-600">
                Keep club, admin, and prospect conversations organized in one place.
              </p>
            </div>
            <Button
              size="icon"
              className="h-11 w-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={() => openNewConversation("club")}
              aria-label="Start new conversation"
              disabled={!orgId}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative mt-5">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search conversations..."
              className="h-11 rounded-2xl border-slate-200 bg-white pl-10"
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className={cn(
                    "rounded-2xl border px-3 py-3 shadow-sm",
                    card.summaryTone,
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-4 w-4" />
                    {card.unread > 0 && (
                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold">
                        {card.unread > 99 ? "99+" : card.unread}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-lg font-semibold leading-none">{card.count}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-80">{card.summaryText}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-2xl border-slate-200 bg-white"
              onClick={handleSyncClubPaths}
              disabled={syncingClubPaths || !orgId}
            >
              {syncingClubPaths ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync club channels
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {conversationsLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </div>
              ))
            ) : conversationsError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p className="font-semibold text-rose-900">Could not load conversations</p>
                <p className="mt-1 leading-6">{conversationsError}</p>
                <Button variant="outline" className="mt-3 rounded-full border-rose-300 bg-white" onClick={() => void refreshConversations()}>
                  Retry
                </Button>
              </div>
            ) : (
              CATEGORY_ORDER.map((group) => {
                const Icon = group.icon;
                const items = groupedConversations[group.key];

                return (
                  <section key={group.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", group.summaryTone)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-950">{group.label}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{group.subtitle}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                          {items.length}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2 p-2">
                      {items.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center">
                          <p className="text-sm font-medium text-slate-600">{group.emptyMessage}</p>
                          <Button
                            variant="link"
                            className="mt-1 h-auto p-0 text-sm text-slate-950"
                            onClick={() => openNewConversation(group.key === "prospects" ? "prospect" : group.key === "admins" ? "admin" : "club")}
                          >
                            {group.newChatCta}
                          </Button>
                        </div>
                      ) : (
                        items.map((conversation) => {
                          const active = selectedConversationId === conversation.id;
                          const fallback = conversation.title.slice(0, 2).toUpperCase();

                          return (
                            <button
                              key={conversation.id}
                              type="button"
                              onClick={() => setSelectedConversationId(conversation.id)}
                              className={cn(
                                "w-full rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50",
                                active
                                  ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)]"
                                  : "border-transparent bg-white",
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <Avatar className="h-11 w-11 rounded-2xl">
                                  <AvatarImage src={conversation.avatarUrl ?? undefined} />
                                  <AvatarFallback className={cn(active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700")}>
                                    {fallback}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-semibold">{conversation.title}</p>
                                        {conversation.needsAttention && (
                                          <span className={cn(
                                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                            active ? "bg-white/15 text-white" : "bg-amber-100 text-amber-800",
                                          )}>
                                            Setup needed
                                          </span>
                                        )}
                                      </div>
                                      <p className={cn("mt-1 text-xs", active ? "text-slate-300" : "text-slate-500")}>
                                        {conversation.needsAttention
                                          ? "No club-side member linked yet"
                                          : CATEGORY_META[conversation.category].summaryText}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className={cn("text-[11px]", active ? "text-slate-300" : "text-slate-400")}>
                                        {conversation.lastMessageAt
                                          ? formatDistanceToNowStrict(new Date(conversation.lastMessageAt), {
                                              addSuffix: true,
                                            })
                                          : "new"}
                                      </p>
                                      {conversation.unreadCount > 0 && (
                                        <span className={cn(
                                          "mt-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                                          active ? "bg-white text-slate-950" : "bg-slate-950 text-white",
                                        )}>
                                          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <p className={cn("mt-3 truncate text-xs", active ? "text-slate-200" : "text-slate-500")}>
                                    {conversation.preview}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        {!selectedConversation || !selectedMeta ? (
          <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_38%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-8 py-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <MessageSquare className="h-11 w-11 text-slate-400" />
              </div>
              <h3 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">Messaging should feel operational, not empty</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Select an existing conversation or start a new thread with an official club, another admin, or a prospect club.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {CATEGORY_ORDER.map((group) => {
                  const Icon = group.icon;
                  const tab = group.key === "prospects" ? "prospect" : group.key === "admins" ? "admin" : "club";

                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => openNewConversation(tab)}
                      className="rounded-3xl border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", group.summaryTone)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-950">{group.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{group.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-200 bg-white/85 px-6 py-5 backdrop-blur">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 rounded-2xl border border-slate-200">
                  <AvatarImage src={selectedConversation.avatarUrl ?? undefined} />
                  <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                    {selectedConversation.title.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate text-xl font-semibold tracking-tight text-slate-950">
                      {selectedConversation.title}
                    </h3>
                    <Badge className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", selectedMeta.summaryTone)}>
                      {selectedMeta.label}
                    </Badge>
                    {selectedConversationNeedsAccess && (
                      <Badge className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        Setup needed
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>{selectedMeta.subtitle}</span>
                    <span className="text-slate-300">•</span>
                    <span>{totalMembers} participants</span>
                    <span className="text-slate-300">•</span>
                    <span>{readHeadline}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setDetailsOpen(true)}
                  >
                    <PanelRightOpen className="mr-2 h-4 w-4" />
                    Details
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setAccessDialogOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Participants
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden bg-[linear-gradient(180deg,_rgba(248,250,252,0.85),_#ffffff)]">
              {messagesLoading ? (
                <div className="space-y-4 p-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-16 w-2/3 rounded-3xl" />
                    </div>
                  ))}
                </div>
              ) : messagesError ? (
                <div className="flex h-full items-center justify-center px-6 py-10">
                  <div className="max-w-lg rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-700">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <h4 className="mt-4 text-lg font-semibold text-rose-950">Could not load this conversation</h4>
                    <p className="mt-2 text-sm leading-6 text-rose-800">{messagesError}</p>
                    <Button className="mt-4 rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={() => void refreshMessages()}>
                      Retry conversation
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="h-full overflow-y-auto px-6 py-5"
                >
                  <div className="mx-auto w-full max-w-4xl space-y-5">
                    {selectedConversationNeedsAccess && (
                      <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-left shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-amber-950">This club chat is still one-sided.</p>
                            <p className="mt-1 text-sm leading-6 text-amber-900/80">
                              The thread exists, but no officer or club-linked account can reply yet. {suggestedMembers.length > 0
                                ? `There ${suggestedMembers.length === 1 ? "is" : "are"} ${suggestedMembers.length} recommended ${suggestedMembers.length === 1 ? "account" : "accounts"} ready to add.`
                                : "You still need to onboard or link a club-side user before expecting replies."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {suggestedMembers.length > 0 && (
                                <Button
                                  variant="outline"
                                  className="rounded-full border-amber-300 bg-white"
                                  onClick={handleGrantAllSuggested}
                                  disabled={bulkAddingSuggested || addingAccess}
                                >
                                  {bulkAddingSuggested ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                  Add recommended users
                                </Button>
                              )}
                              <Button variant="outline" className="rounded-full border-amber-300 bg-white" onClick={() => setAccessDialogOpen(true)}>
                                <Users className="mr-2 h-4 w-4" />
                                Manage participants
                              </Button>
                              <Button asChild variant="outline" className="rounded-full border-amber-300 bg-white">
                                <Link to="/officers">Open officers</Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Participants</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{totalMembers}</p>
                        <p className="mt-1 text-xs text-slate-500">Admins and club-side members currently attached.</p>
                      </div>
                      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Seen latest</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{seenLatestCount}</p>
                        <p className="mt-1 text-xs text-slate-500">Participants whose read state is at or beyond the latest message.</p>
                      </div>
                      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Club-side readiness</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{clubMembersCount}</p>
                        <p className="mt-1 text-xs text-slate-500">Club-linked participants who can respond from the other side.</p>
                      </div>
                    </div>

                    {hasMoreMessages && (
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={loadOlderMessages}
                          disabled={loadingOlderMessages}
                        >
                          {loadingOlderMessages && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Load older messages
                        </Button>
                      </div>
                    )}

                    {messages.length === 0 && (
                      <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
                        <p className="text-lg font-semibold text-slate-900">No messages yet</p>
                        <p className="mt-2 text-sm text-slate-500">Send the first message below to open this thread.</p>
                      </div>
                    )}

                    {messages.map((message) => {
                      const mine = message.senderId === userId;
                      const senderName = mine ? "You" : participantMap.get(message.senderId) || selectedConversation.title;

                      return (
                        <div key={message.id} className={cn("flex w-full", mine ? "justify-end" : "justify-start")}> 
                          <div className="max-w-[78%] space-y-2">
                            <div className={cn("px-1 text-[11px] font-medium text-slate-400", mine && "text-right")}>
                              {senderName}
                            </div>
                            <div
                              className={cn(
                                "rounded-[28px] px-4 py-3 text-sm leading-6 shadow-sm",
                                mine
                                  ? "rounded-br-md bg-slate-950 text-white"
                                  : "rounded-bl-md border border-slate-200 bg-white text-slate-800",
                              )}
                            >
                              {message.body}
                            </div>
                            <div className={cn("px-1 text-[10px] text-slate-400", mine && "text-right")}>
                              {format(new Date(message.createdAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4">
              <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
                <Textarea
                  value={composerValue}
                  onChange={(event) => setComposerValue(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={2}
                  placeholder={COMPOSER_PLACEHOLDER[selectedConversation.category]}
                  className="min-h-[60px] resize-y border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-500">{COMPOSER_HINT[selectedConversation.category]}</p>
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !composerValue.trim()}
                    className="h-11 rounded-full px-5"
                  >
                    {sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full max-w-xl border-slate-200 px-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <SheetHeader>
              <SheetTitle className="text-2xl tracking-tight">Conversation details</SheetTitle>
              <SheetDescription>
                Review participant state, read posture, and setup readiness before you treat this thread as fully operational.
              </SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="h-full px-6 pb-6">
            <div className="space-y-5 py-5">
              {selectedConversation && (
                <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 rounded-2xl border border-slate-200 bg-white">
                      <AvatarImage src={selectedConversation.avatarUrl ?? undefined} />
                      <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                        {selectedConversation.title.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-950">{selectedConversation.title}</p>
                        <Badge className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", selectedMeta?.summaryTone)}>
                          {selectedMeta?.label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selectedMeta?.subtitle}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full bg-white text-slate-700">{totalMembers} participants</Badge>
                        <Badge variant="secondary" className="rounded-full bg-white text-slate-700">{seenLatestCount} seen latest</Badge>
                        {selectedConversationNeedsAccess && (
                          <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700">Club setup needed</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Read posture</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{seenLatestCount}/{Math.max(totalMembers, 1)}</p>
                  <p className="mt-1 text-xs text-slate-500">Participants who have seen the latest message.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Latest activity</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {accessState.latestMessageAt
                      ? formatDistanceToNowStrict(new Date(accessState.latestMessageAt), { addSuffix: true })
                      : "No messages yet"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{accessState.latestMessagePreview || "No message preview yet."}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Setup readiness</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {selectedConversationNeedsAccess ? "Needs club-side participant" : "Operational"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedConversationNeedsAccess
                      ? `${suggestedMembers.length} recommended accounts are available to add.`
                      : "The thread has at least one reachable participant on each required side."}
                  </p>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Participants</p>
                    <p className="mt-1 text-xs text-slate-500">Current membership and read-state visibility.</p>
                  </div>
                  <Button variant="outline" className="rounded-full" onClick={() => setAccessDialogOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Manage access
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {accessLoading ? (
                    Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-2xl" />)
                  ) : accessState.directMembers.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No participants found for this conversation.</p>
                  ) : (
                    accessState.directMembers.map((member) => {
                      const readState = formatReadState(member);
                      return (
                        <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                          <Avatar className="h-10 w-10 rounded-2xl">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                              {(member.fullName || member.email || "U").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-slate-950">{member.fullName || member.email || "Unnamed user"}</p>
                              {member.tags.map((tag) => (
                                <Badge key={`${member.id}-${tag}`} variant="secondary" className="rounded-full bg-white text-[11px] text-slate-600">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                          </div>
                          <Badge className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", readState.tone)}>
                            {readState.label}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {selectedConversation?.targetType === "club" && (
                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Recommended club-side accounts</p>
                      <p className="mt-1 text-xs text-slate-500">Officer records and club-linked accounts that can make this thread two-way.</p>
                    </div>
                    {suggestedMembers.length > 0 && (
                      <Button variant="outline" className="rounded-full" onClick={handleGrantAllSuggested} disabled={bulkAddingSuggested || addingAccess}>
                        {bulkAddingSuggested ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Add all
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {accessLoading ? (
                      Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-2xl" />)
                    ) : suggestedMembers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        No recommended club-side accounts are linked yet. Create or link officers in the roster first.
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild variant="outline" className="rounded-full">
                            <Link to="/officers">Open officers</Link>
                          </Button>
                          <Button asChild variant="outline" className="rounded-full">
                            <Link to="/users">Open User Management</Link>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      suggestedMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                          <Avatar className="h-10 w-10 rounded-2xl">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                              {(member.fullName || member.email || "U").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-slate-950">{member.fullName || member.email || "Unnamed user"}</p>
                              {member.tags.map((tag) => (
                                <Badge key={`${member.id}-${tag}`} variant="secondary" className="rounded-full bg-white text-[11px] text-slate-600">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                          </div>
                          <Button size="sm" className="rounded-full" onClick={() => handleGrantSuggestedMember(member)} disabled={addingAccess}>
                            Add
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog
        open={newConversationOpen}
        onOpenChange={(open) => {
          setNewConversationOpen(open);
          if (!open) {
            setRecipientSearch("");
            setSelectedRecipientKey(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-200 p-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl tracking-tight">Start conversation</DialogTitle>
              <DialogDescription className="pt-1 text-sm text-slate-500">
                Choose the right audience first. Club and prospect chats route to a club-linked workflow, while admin chats stay internal.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-5">
            <Tabs
              value={newConversationTab}
              onValueChange={(value) => {
                const next = value as RecipientTab;
                setNewConversationTab(next);
                setSelectedRecipientKey(null);
              }}
            >
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="club" className="rounded-xl py-2.5">Clubs</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-xl py-2.5">Admins</TabsTrigger>
                <TabsTrigger value="prospect" className="rounded-xl py-2.5">Prospects</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder={RECIPIENT_PLACEHOLDER[newConversationTab]}
                className="h-11 rounded-2xl border-slate-200 pl-10"
              />
            </div>

            <div className="max-h-80 overflow-y-auto rounded-[24px] border border-slate-200 bg-slate-50/70 p-2">
              {loadingRecipientOptions ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                  ))}
                </div>
              ) : recipientOptions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-600">{RECIPIENT_EMPTY_COPY[newConversationTab]}</p>
                  <p className="mt-1 text-xs text-slate-500">Try a different search or come back after new accounts are created.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recipientOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSelectedRecipientKey(option.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-all",
                        selectedRecipientKey === option.key
                          ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-white",
                      )}
                    >
                      <Avatar className="h-10 w-10 rounded-2xl">
                        <AvatarImage src={option.avatarUrl ?? undefined} />
                        <AvatarFallback className={cn(selectedRecipientKey === option.key ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700")}>
                          {option.label.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{option.label}</p>
                        {option.subtitle && (
                          <p className={cn("truncate text-xs", selectedRecipientKey === option.key ? "text-slate-200" : "text-slate-500")}>
                            {option.subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setNewConversationOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-full px-5" onClick={handleStartConversation} disabled={!selectedRecipient || creatingConversation}>
              {creatingConversation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Open chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={accessDialogOpen}
        onOpenChange={(open) => {
          setAccessDialogOpen(open);
          if (!open) {
            setDirectorySearch("");
            setEmailAccess("");
          }
        }}
      >
        <DialogContent className="max-w-4xl rounded-[28px] border-slate-200 p-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl tracking-tight">Manage participants</DialogTitle>
              <DialogDescription className="pt-1 text-sm text-slate-500">
                {participantManagerDescription}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Current participants</p>
                    <p className="mt-1 text-xs text-slate-500">Direct room members with live read-state visibility.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {seenLatestCount}/{Math.max(totalMembers, 1)} seen latest
                  </div>
                </div>

                {selectedConversationNeedsAccess && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No club-side participant is linked yet. This thread will stay admin-only until you add an officer or a club account.
                  </div>
                )}

                {accessLoading ? (
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {accessState.directMembers.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No direct room members yet.</p>
                    ) : (
                      accessState.directMembers.map((member) => {
                        const readState = formatReadState(member);
                        const adminMembers = accessState.directMembers.filter((entry) => entry.memberType === "admin").length;
                        const canRemove = !member.isCurrentUser && !(member.memberType === "admin" && adminMembers <= 1);

                        return (
                          <div key={`direct-${member.id}`} className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-3">
                            <Avatar className="h-10 w-10 rounded-2xl">
                              <AvatarImage src={member.avatarUrl ?? undefined} />
                              <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                                {(member.fullName || member.email || "U").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium text-slate-950">{member.fullName || member.email || "Unnamed user"}</p>
                                {member.tags.map((tag) => (
                                  <Badge key={`${member.id}-${tag}`} variant="secondary" className="rounded-full bg-slate-100 text-[11px] text-slate-600">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                              <div className="mt-2">
                                <Badge className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", readState.tone)}>
                                  {readState.label}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-2xl"
                              onClick={() => handleRemoveAccess(member)}
                              disabled={!canRemove || removingMemberId === member.id}
                            >
                              {removingMemberId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </section>

              {selectedConversation?.targetType === "club" && (
                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Recommended club-side access</p>
                      <p className="mt-1 text-xs text-slate-500">Officer records and club-linked accounts discovered from the workspace.</p>
                    </div>
                    {suggestedMembers.length > 0 && (
                      <Button variant="outline" className="rounded-full" onClick={handleGrantAllSuggested} disabled={bulkAddingSuggested || addingAccess}>
                        {bulkAddingSuggested ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Add all
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {accessLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                      ))
                    ) : suggestedMembers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        No linked officer or club accounts are ready yet.
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild variant="outline" className="rounded-full">
                            <Link to="/officers">Open officers</Link>
                          </Button>
                          <Button asChild variant="outline" className="rounded-full">
                            <Link to="/users">Open User Management</Link>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      suggestedMembers.map((member) => (
                        <div key={`suggested-${member.id}`} className="flex items-center gap-3 rounded-2xl border bg-slate-50/70 px-3 py-3">
                          <Avatar className="h-10 w-10 rounded-2xl">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                              {(member.fullName || member.email || "U").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-slate-950">{member.fullName || member.email || "Unnamed user"}</p>
                              {member.tags.map((tag) => (
                                <Badge key={`${member.id}-${tag}`} variant="secondary" className="rounded-full bg-white text-[11px] text-slate-600">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                          </div>
                          <Button size="sm" className="rounded-full" onClick={() => handleGrantSuggestedMember(member)} disabled={addingAccess}>
                            Add
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-5">
              <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{directorySectionTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">{directorySectionDescription}</p>
                </div>

                <div className="relative mt-4">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={directorySearch}
                    onChange={(event) => setDirectorySearch(event.target.value)}
                    placeholder={selectedConversation?.targetType === "club" ? "Search workspace users..." : "Search admins..."}
                    className="h-11 rounded-2xl border-slate-200 pl-10"
                  />
                </div>

                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                  {directoryLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                    ))
                  ) : eligibleDirectoryUsers.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No additional eligible users match the current search.</p>
                  ) : (
                    eligibleDirectoryUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-3 rounded-2xl border bg-slate-50/70 px-3 py-3">
                        <Avatar className="h-10 w-10 rounded-2xl">
                          <AvatarImage src={user.avatarUrl ?? undefined} />
                          <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                            {(user.fullName || user.email || "U").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-950">{user.fullName || user.email || "Unnamed user"}</p>
                          <p className="truncate text-xs text-slate-500">{user.email || "No email on file"}</p>
                        </div>
                        <Button
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleGrantAccess(user.id)}
                          disabled={addingAccess}
                        >
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Quick add by email</p>
                <p className="mt-1 text-xs text-slate-500">
                  Only existing workspace accounts can be granted directly here.
                </p>

                <div className="mt-4 flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={emailAccess}
                      onChange={(event) => setEmailAccess(event.target.value)}
                      placeholder="Enter an existing account email"
                      className="h-11 rounded-2xl border-slate-200 pl-10"
                    />
                  </div>
                  <Button className="rounded-full px-5" onClick={handleGrantAccessByEmail} disabled={addingAccess || !emailAccess.trim()}>
                    Add email
                  </Button>
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-sm font-medium text-slate-700">Need to create or onboard the user first?</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Create the account, assign workspace access, or link the person to the club first. Then come back here to grant the chat directly.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to="/users">Open User Management</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to="/members/add">Open Add Members</Link>
                    </Button>
                    {selectedConversation?.targetType === "club" && (
                      <Button asChild variant="outline" className="rounded-full">
                        <Link to="/officers">Open officers</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setAccessDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Messaging;
