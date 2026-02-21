import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMessaging } from "@/hooks/useMessaging";
import {
  type ConversationCategory,
  type MessagingProfile,
  type RecipientOption,
  type RecipientTab,
  fetchRecipientOptions,
} from "@/lib/messagingApi";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: { key: ConversationCategory; label: string }[] = [
  { key: "clubs", label: "Clubs" },
  { key: "officers", label: "Officers" },
  { key: "admins", label: "Admins" },
  { key: "others", label: "Others" },
];

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

  const [collapsedGroups, setCollapsedGroups] = useState<Record<ConversationCategory, boolean>>({
    clubs: false,
    officers: false,
    admins: false,
    others: false,
  });

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const groupedConversations = useMemo(() => {
    const groups: Record<ConversationCategory, typeof conversations> = {
      clubs: [],
      officers: [],
      admins: [],
      others: [],
    };

    conversations.forEach((conversation) => {
      groups[conversation.category].push(conversation);
    });

    return groups;
  }, [conversations]);

  const selectedRecipient = useMemo(
    () => recipientOptions.find((option) => option.key === selectedRecipientKey) ?? null,
    [recipientOptions, selectedRecipientKey],
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

  const toggleGroup = (key: ConversationCategory) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-lg border bg-background">
      <div className="flex w-96 flex-col border-r bg-muted/10">
        <div className="space-y-4 border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Messages</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setNewConversationOpen(true)}
              aria-label="Start new conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search chats..."
              className="bg-background pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 p-2">
            {conversationsLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-md p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No conversations found.</div>
            ) : (
              CATEGORY_ORDER.map((group) => {
                const items = groupedConversations[group.key];
                const collapsed = collapsedGroups[group.key];

                return (
                  <section key={group.key} className="rounded-md border bg-background/80">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {group.label}
                      </span>
                      <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                        {items.length}
                      </Badge>
                    </button>

                    {!collapsed && (
                      <div className="space-y-1 p-1 pt-0">
                        {items.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No chats in this section.</div>
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
                                  "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent",
                                  active && "bg-accent",
                                )}
                              >
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={conversation.avatarUrl ?? undefined} />
                                  <AvatarFallback>{fallback}</AvatarFallback>
                                </Avatar>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-sm font-medium">{conversation.title}</p>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                      {conversation.lastMessageAt
                                        ? formatDistanceToNowStrict(new Date(conversation.lastMessageAt), {
                                            addSuffix: true,
                                          })
                                        : "new"}
                                    </span>
                                  </div>

                                  <div className="mt-0.5 flex items-center justify-between gap-2">
                                    <p className="truncate text-xs text-muted-foreground">{conversation.preview}</p>
                                    {conversation.unreadCount > 0 && (
                                      <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                                        {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {!selectedConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
              <MessageSquare className="h-10 w-10 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No Chat Selected</h3>
            <p className="mt-2 max-w-sm text-sm">Select a conversation from the sidebar to start messaging.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b p-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{selectedConversation.title}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.category.charAt(0).toUpperCase() + selectedConversation.category.slice(1)} chat
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedConversation.lastMessageAt
                  ? `Last activity ${formatDistanceToNowStrict(new Date(selectedConversation.lastMessageAt), {
                      addSuffix: true,
                    })}`
                  : "No messages yet"}
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
              {messagesLoading ? (
                <div className="space-y-4 p-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-12 w-2/3 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="h-full overflow-y-auto px-4 py-3"
                >
                  <div className="mx-auto w-full max-w-4xl space-y-4">
                    {hasMoreMessages && (
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadOlderMessages}
                          disabled={loadingOlderMessages}
                        >
                          {loadingOlderMessages && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Load older messages
                        </Button>
                      </div>
                    )}

                    {messages.length === 0 && (
                      <div className="rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground">
                        No messages yet. Send the first message below.
                      </div>
                    )}

                    {messages.map((message) => {
                      const mine = message.senderId === userId;
                      const senderName = mine ? "You" : selectedConversation.title;

                      return (
                        <div key={message.id} className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
                          <div className="max-w-[75%] space-y-1">
                            <div className={cn("text-[11px] text-muted-foreground", mine && "text-right")}>{senderName}</div>
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2 text-sm shadow-sm",
                                mine
                                  ? "rounded-br-none bg-primary text-primary-foreground"
                                  : "rounded-bl-none border bg-background",
                              )}
                            >
                              {message.body}
                            </div>
                            <div className={cn("text-[10px] text-muted-foreground", mine && "text-right")}>
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

            <div className="border-t bg-background p-4">
              <div className="mx-auto flex w-full max-w-4xl items-end gap-2">
                <Textarea
                  value={composerValue}
                  onChange={(event) => setComposerValue(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={2}
                  placeholder="Type a message..."
                  className="max-h-28 min-h-[44px] resize-y"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !composerValue.trim()}
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full"
                >
                  {sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Start New Chat</DialogTitle>
            <DialogDescription>Select a recipient and open a direct conversation.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <Tabs
              value={newConversationTab}
              onValueChange={(value) => {
                const next = value as RecipientTab;
                setNewConversationTab(next);
                setSelectedRecipientKey(null);
              }}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="club">Club</TabsTrigger>
                <TabsTrigger value="officer">Officer</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder={`Search ${newConversationTab}s...`}
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border">
              {loadingRecipientOptions ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : recipientOptions.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No recipients found.</p>
              ) : (
                <div className="p-1">
                  {recipientOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSelectedRecipientKey(option.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        selectedRecipientKey === option.key && "bg-accent",
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={option.avatarUrl ?? undefined} />
                        <AvatarFallback>{option.label.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{option.label}</p>
                        {option.subtitle && <p className="truncate text-xs text-muted-foreground">{option.subtitle}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewConversationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartConversation} disabled={!selectedRecipient || creatingConversation}>
              {creatingConversation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Messaging;
