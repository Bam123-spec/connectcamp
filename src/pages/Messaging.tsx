import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Check,
  CheckCheck,
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAdminMessaging } from "@/hooks/useAdminMessaging";
import {
  type ClubRecipient,
  type MessagingProfile,
  fetchClubsForNewConversation,
} from "@/lib/adminMessagingApi";
import { cn } from "@/lib/utils";

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
    memberDirectory,
    sendMessage,
    sendingMessage,
    loadOlderMessages,
    startConversationWithClub,
    creatingConversation,
  } = useAdminMessaging({
    userId,
    profile: (profile as MessagingProfile | null) ?? null,
  });

  const [composerValue, setComposerValue] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [clubSearch, setClubSearch] = useState("");
  const [clubOptions, setClubOptions] = useState<ClubRecipient[]>([]);
  const [loadingClubOptions, setLoadingClubOptions] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [campusId, setCampusId] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const selectedClubOption = useMemo(
    () => clubOptions.find((club) => club.id === selectedClubId) ?? null,
    [clubOptions, selectedClubId],
  );

  useEffect(() => {
    if (!newConversationOpen || !orgId) return;

    let active = true;
    setLoadingClubOptions(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await fetchClubsForNewConversation({ orgId, search: clubSearch });
        if (active) {
          setClubOptions(results);
          if (results.length === 0) {
            setSelectedClubId(null);
          } else if (!results.some((club) => club.id === selectedClubId)) {
            setSelectedClubId(results[0].id);
          }
        }
      } catch (error) {
        if (active) {
          toast({
            variant: "destructive",
            title: "Could not load clubs",
            description: error instanceof Error ? error.message : "Please retry.",
          });
        }
      } finally {
        if (active) {
          setLoadingClubOptions(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [clubSearch, newConversationOpen, orgId, selectedClubId, toast]);

  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [selectedConversationId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !autoScrollEnabled) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, autoScrollEnabled]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    setAutoScrollEnabled(isNearBottom(container));
  };

  const handleSendMessage = async () => {
    const value = composerValue.trim();
    if (!value) return;

    try {
      await sendMessage(value);
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

  const handleCreateConversation = async () => {
    if (!selectedClubOption) return;

    try {
      await startConversationWithClub({
        club: selectedClubOption,
        campusId: campusId.trim() || null,
        subject: subject.trim() || null,
      });

      setNewConversationOpen(false);
      setSubject("");
      setCampusId("");
      setClubSearch("");
      toast({ title: "Conversation ready", description: `You can now message ${selectedClubOption.name}.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not create conversation",
        description:
          error instanceof Error
            ? error.message
            : "Club account has no login user or access is restricted.",
      });
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-lg border bg-background">
      <div className="flex w-80 flex-col border-r bg-muted/10">
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
              placeholder="Search conversations..."
              className="bg-background pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {conversationsLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-md p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conversations found.
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = selectedConversationId === conversation.id;
                const fallback = conversation.otherParticipantName.slice(0, 2).toUpperCase();

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent",
                      isActive && "bg-accent",
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conversation.otherParticipantAvatarUrl ?? undefined} />
                      <AvatarFallback>{fallback}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{conversation.otherParticipantName}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {conversation.lastMessageAt
                            ? formatDistanceToNowStrict(new Date(conversation.lastMessageAt), { addSuffix: true })
                            : "new"}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {conversation.lastMessageSnippet}
                        </p>
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
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {!selectedConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
              <MessageSquare className="h-10 w-10 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No Chat Selected</h3>
            <p className="mt-2 max-w-sm text-sm">
              Select a conversation from the sidebar to message clubs in real time.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b p-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{selectedConversation.otherParticipantName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedConversation.subject || "Direct conversation"}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedConversation.lastMessageAt
                  ? `Last activity ${formatDistanceToNowStrict(new Date(selectedConversation.lastMessageAt), { addSuffix: true })}`
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
                        No messages yet. Start the conversation below.
                      </div>
                    )}

                    {messages.map((message) => {
                      const isMine = message.senderId === userId;
                      const sender = memberDirectory.get(message.senderId);
                      const senderName = isMine
                        ? "You"
                        : sender?.displayName ||
                          (message.senderRole === "club" ? selectedConversation.otherParticipantName : "Admin");

                      return (
                        <div
                          key={message.id}
                          className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] space-y-1",
                              isMine ? "items-end" : "items-start",
                            )}
                          >
                            <div className={cn("text-[11px] text-muted-foreground", isMine && "text-right")}>{senderName}</div>
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2 text-sm shadow-sm",
                                isMine
                                  ? "rounded-br-none bg-primary text-primary-foreground"
                                  : "rounded-bl-none border bg-background",
                              )}
                            >
                              {message.body}
                            </div>
                            <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground", isMine && "justify-end")}>
                              <span>{format(new Date(message.createdAt), "MMM d, h:mm a")}</span>
                              {isMine && (
                                <span>
                                  {selectedConversation.unreadCount === 0 ? (
                                    <CheckCheck className="h-3 w-3 text-blue-500" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </span>
                              )}
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

      <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Start a direct message thread with a club account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="club-search">Find club</Label>
              <Input
                id="club-search"
                value={clubSearch}
                onChange={(event) => setClubSearch(event.target.value)}
                placeholder="Search clubs..."
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-md border">
              {loadingClubOptions ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : clubOptions.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No clubs available for messaging.</p>
              ) : (
                <div className="p-1">
                  {clubOptions.map((club) => (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => setSelectedClubId(club.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        selectedClubId === club.id && "bg-accent",
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={club.avatarUrl ?? undefined} />
                        <AvatarFallback>{club.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{club.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conversation-subject">Subject (optional)</Label>
                <Input
                  id="conversation-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Optional conversation subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conversation-campus">Campus ID (optional)</Label>
                <Input
                  id="conversation-campus"
                  value={campusId}
                  onChange={(event) => setCampusId(event.target.value)}
                  placeholder="Campus UUID"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewConversationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConversation} disabled={!selectedClubId || creatingConversation}>
              {creatingConversation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Messaging;
