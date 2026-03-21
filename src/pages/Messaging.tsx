import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Lightbulb,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  UserPlus,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMessaging } from "@/hooks/useMessaging";
import {
  addConversationAccess,
  type ConversationAccessState,
  type ConversationCategory,
  findMessagingUserByEmail,
  type MessagingProfile,
  type MessagingDirectoryUser,
  type RecipientOption,
  type RecipientTab,
  fetchConversationAccessState,
  fetchRecipientOptions,
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
  clubs: "Club chats are best for operational follow-up, reminders, and direct support.",
  admins: "Use admin chats for cross-campus coordination and internal handoff.",
  prospects: "Prospect chats should focus on onboarding, next steps, and approval guidance.",
};

const COMPOSER_PLACEHOLDER: Record<ConversationCategory, string> = {
  clubs: "Message this club...",
  admins: "Message another admin...",
  prospects: "Message this prospect club...",
};

const isNearBottom = (element: HTMLElement) => {
  const threshold = 120;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
};

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
    refreshConversations,
    selectedConversationId,
    setSelectedConversationId,
    selectedConversation,
    messages,
    messagesLoading,
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
  const [accessState, setAccessState] = useState<ConversationAccessState>({
    directMembers: [],
    clubLinkedMembers: [],
  });
  const [accessLoading, setAccessLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState<MessagingDirectoryUser[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [emailAccess, setEmailAccess] = useState("");
  const [addingAccess, setAddingAccess] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const autoProvisionedRef = useRef(false);
  const isAdminWorkspace =
    profile?.role === "admin" || profile?.role === "student_life_admin" || profile?.role === "super_admin";

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
        ...accessState.clubLinkedMembers.map((member) => member.id),
      ]),
    [accessState.clubLinkedMembers, accessState.directMembers],
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
    if (!userId || !isAdminWorkspace || autoProvisionedRef.current) return;

    autoProvisionedRef.current = true;
    let active = true;
    setSyncingClubPaths(true);

    syncClubMessagingPaths()
      .then(async (result) => {
        if (!active) return;
        await refreshConversations();

        if (result.createdCount > 0 || result.connectedCount > 0) {
          toast({
            title: "Club channels synced",
            description: `${result.clubCount} clubs checked, ${result.createdCount} channels created, ${result.connectedCount} connected to your inbox.`,
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        toast({
          variant: "destructive",
          title: "Could not sync club channels",
          description: error instanceof Error ? error.message : "Please retry.",
        });
      })
      .finally(() => {
        if (active) setSyncingClubPaths(false);
      });

    return () => {
      active = false;
    };
  }, [isAdminWorkspace, refreshConversations, toast, userId]);

  useEffect(() => {
    if (!accessDialogOpen || !selectedConversation || selectedConversation.targetType !== "club") return;

    let active = true;
    setAccessLoading(true);

    fetchConversationAccessState({
      conversationId: selectedConversation.id,
      clubId: selectedConversation.targetId,
    })
      .then((state) => {
        if (!active) return;
        setAccessState(state);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          variant: "destructive",
          title: "Could not load chat access",
          description: error instanceof Error ? error.message : "Please retry.",
        });
      })
      .finally(() => {
        if (active) setAccessLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessDialogOpen, selectedConversation, toast]);

  useEffect(() => {
    if (!accessDialogOpen || !userId) return;

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
    setSyncingClubPaths(true);
    try {
      const result = await syncClubMessagingPaths();
      await refreshConversations();
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

    setAddingAccess(true);
    try {
      await addConversationAccess({
        conversationId: selectedConversation.id,
        userId: targetUserId,
      });

      await refreshConversations();

      const [nextAccess, nextDirectory] = await Promise.all([
        fetchConversationAccessState({
          conversationId: selectedConversation.id,
          clubId: selectedConversation.targetType === "club" ? selectedConversation.targetId : null,
        }),
        searchMessagingUsers({
          orgId,
          search: directorySearch,
          excludeUserIds: Array.from(new Set([...Array.from(existingAccessUserIds), targetUserId])),
          currentUserId: userId,
        }),
      ]);

      setAccessState(nextAccess);
      setDirectoryUsers(nextDirectory);
      setEmailAccess("");

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
  };

  const handleGrantAccessByEmail = async () => {
    const normalized = emailAccess.trim().toLowerCase();
    if (!normalized) return;

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

      await handleGrantAccess(user.id);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not add by email",
        description: error instanceof Error ? error.message : "Please retry.",
      });
    }
  };

  const selectedMeta = selectedConversation ? CATEGORY_META[selectedConversation.category] : null;
  const selectedConversationNeedsAccess =
    selectedConversation?.targetType === "club" &&
    selectedConversation.clubMemberCount === 0;

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
              disabled={syncingClubPaths}
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
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>{selectedMeta.subtitle}</span>
                    <span className="text-slate-300">•</span>
                    <span>
                      {selectedConversation.targetType === "club"
                        ? `${selectedConversation.clubMemberCount} club-side ${selectedConversation.clubMemberCount === 1 ? "member" : "members"}`
                        : `${selectedConversation.adminMemberCount} admin participants`}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      {selectedConversation.lastMessageAt
                        ? `Last activity ${formatDistanceToNowStrict(new Date(selectedConversation.lastMessageAt), {
                            addSuffix: true,
                          })}`
                        : "No messages yet"}
                    </span>
                  </div>
                </div>
                {selectedConversation.targetType === "club" && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setAccessDialogOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Manage access
                  </Button>
                )}
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
                            <p className="text-sm font-semibold text-amber-950">This club chat is not reachable from the club side yet.</p>
                            <p className="mt-1 text-sm leading-6 text-amber-900/80">
                              The conversation exists for this club, but no officer or linked club account has access yet. Add access before expecting replies.
                            </p>
                          </div>
                          <Button variant="outline" className="rounded-full border-amber-300 bg-white" onClick={() => setAccessDialogOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add access
                          </Button>
                        </div>
                      </div>
                    )}

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
                      const senderName = mine ? "You" : selectedConversation.title;

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
                Choose the right audience first. Club and prospect chats route to a club-linked account, while admin chats stay internal.
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
        <DialogContent className="max-w-3xl rounded-[28px] border-slate-200 p-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl tracking-tight">Manage chat access</DialogTitle>
              <DialogDescription className="pt-1 text-sm text-slate-500">
                Grant direct access to this club channel from the workspace user directory, or add an existing account by email.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Current access</p>
                    <p className="mt-1 text-xs text-slate-500">Direct room members plus club-linked users already attached to this club.</p>
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
                      <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Direct room members</p>
                      <div className="space-y-2">
                        {accessState.directMembers.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No direct room members yet.</p>
                        ) : (
                          accessState.directMembers.map((member) => (
                            <div key={`direct-${member.id}`} className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-3">
                              <Avatar className="h-10 w-10 rounded-2xl">
                                <AvatarImage src={member.avatarUrl ?? undefined} />
                                <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                                  {(member.fullName || member.email || "U").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-950">{member.fullName || member.email || "Unnamed user"}</p>
                                <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1">
                                {member.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="rounded-full bg-slate-100 text-[11px] text-slate-600">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Club-linked access</p>
                      <div className="space-y-2">
                        {accessState.clubLinkedMembers.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No linked club members or officers yet.</p>
                        ) : (
                          accessState.clubLinkedMembers.map((member) => (
                            <div key={`linked-${member.id}`} className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-3">
                              <Avatar className="h-10 w-10 rounded-2xl">
                                <AvatarImage src={member.avatarUrl ?? undefined} />
                                <AvatarFallback className="rounded-2xl bg-slate-100 text-slate-700">
                                  {(member.fullName || member.email || "U").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-950">{member.fullName || member.email || "Unnamed user"}</p>
                                <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1">
                                {member.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="rounded-full bg-slate-100 text-[11px] text-slate-600">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Add from User Management</p>
                <p className="mt-1 text-xs text-slate-500">Search existing workspace users and grant this chat directly.</p>

                <div className="relative mt-4">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={directorySearch}
                    onChange={(event) => setDirectorySearch(event.target.value)}
                    placeholder="Search workspace users..."
                    className="h-11 rounded-2xl border-slate-200 pl-10"
                  />
                </div>

                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                  {directoryLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                    ))
                  ) : directoryUsers.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">No additional users match the current search.</p>
                  ) : (
                    directoryUsers.map((user) => (
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
                <p className="mt-1 text-xs text-slate-500">Only existing workspace accounts can be granted directly here.</p>

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
                    Create the account or link them to the club first, then come back here to grant direct chat access.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to="/users">Open User Management</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to="/members/add">Open Add Members</Link>
                    </Button>
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
