import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  type ClubRecipient,
  type ConversationMemberInfo,
  type ConversationMessage,
  type ConversationSummary,
  type MessagingProfile,
  MESSAGE_PAGE_SIZE,
  createOrGetConversationForClub,
  fetchConversationMemberDirectory,
  fetchConversationMessages,
  fetchConversationSummaries,
  markConversationRead,
  resolveOrgId,
  sendConversationMessage,
} from "@/lib/adminMessagingApi";

const normalizeSnippet = (value: string) => {
  const text = value.trim();
  if (!text) return "No messages yet";
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
};

type UseAdminMessagingParams = {
  userId: string | null;
  profile: MessagingProfile | null;
};

export function useAdminMessaging({ userId, profile }: UseAdminMessagingParams) {
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagePage, setMessagePage] = useState(0);

  const [memberDirectory, setMemberDirectory] = useState<Map<string, ConversationMemberInfo>>(new Map());

  const [creatingConversation, setCreatingConversation] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const orgId = useMemo(() => resolveOrgId(profile), [profile]);

  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const refreshConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      return;
    }

    setConversationsLoading(true);
    try {
      const data = await fetchConversationSummaries({
        userId,
        orgId,
        search: conversationSearch,
      });
      setConversations(data);

      if (data.length > 0 && !selectedConversationIdRef.current) {
        setSelectedConversationId(data[0].id);
      }

      if (
        selectedConversationIdRef.current &&
        !data.some((conversation) => conversation.id === selectedConversationIdRef.current)
      ) {
        setSelectedConversationId(data[0]?.id ?? null);
      }
    } finally {
      setConversationsLoading(false);
    }
  }, [conversationSearch, orgId, userId]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const markSelectedConversationRead = useCallback(
    async (conversationId: string) => {
      if (!userId) return;

      await markConversationRead({
        conversationId,
        orgId,
        userId,
        at: new Date().toISOString(),
      });

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
    },
    [orgId, userId],
  );

  useEffect(() => {
    const loadSelectedConversation = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        setMemberDirectory(new Map());
        return;
      }

      setMessagesLoading(true);
      setMessagePage(0);

      try {
        const [messagePayload, directory] = await Promise.all([
          fetchConversationMessages(selectedConversationId, 0, MESSAGE_PAGE_SIZE),
          fetchConversationMemberDirectory(selectedConversationId),
        ]);

        setMessages(messagePayload.messages);
        setHasMoreMessages(messagePayload.hasMore);
        setMemberDirectory(directory);

        await markSelectedConversationRead(selectedConversationId);
      } finally {
        setMessagesLoading(false);
      }
    };

    loadSelectedConversation();
  }, [markSelectedConversationRead, selectedConversationId]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedConversationId || loadingOlderMessages || !hasMoreMessages) {
      return;
    }

    setLoadingOlderMessages(true);
    try {
      const nextPage = messagePage + 1;
      const payload = await fetchConversationMessages(selectedConversationId, nextPage, MESSAGE_PAGE_SIZE);
      setMessages((prev) => [...payload.messages, ...prev]);
      setHasMoreMessages(payload.hasMore);
      setMessagePage(nextPage);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [hasMoreMessages, loadingOlderMessages, messagePage, selectedConversationId]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!userId || !selectedConversationId) return;

      const trimmed = body.trim();
      if (!trimmed) return;

      const senderRole: "admin" | "club" =
        profile?.role === "admin" || profile?.role === "student_life_admin"
          ? "admin"
          : "club";

      setSendingMessage(true);
      try {
        const insertedMessage = await sendConversationMessage({
          conversationId: selectedConversationId,
          orgId,
          senderId: userId,
          senderRole,
          body: trimmed,
        });

        setMessages((prev) => {
          if (prev.some((message) => message.id === insertedMessage.id)) {
            return prev;
          }
          return [...prev, insertedMessage];
        });

        await markSelectedConversationRead(selectedConversationId);

        setConversations((prev) => {
          const existing = prev.find((conversation) => conversation.id === selectedConversationId);
          if (!existing) return prev;

          const updatedConversation: ConversationSummary = {
            ...existing,
            lastMessageSnippet: normalizeSnippet(trimmed),
            lastMessageAt: insertedMessage.createdAt,
            updatedAt: insertedMessage.createdAt,
            lastMessageSenderId: insertedMessage.senderId,
            unreadCount: 0,
          };

          return [updatedConversation, ...prev.filter((conversation) => conversation.id !== selectedConversationId)];
        });
      } finally {
        setSendingMessage(false);
      }
    },
    [markSelectedConversationRead, orgId, profile?.role, selectedConversationId, userId],
  );

  const startConversationWithClub = useCallback(
    async (params: { club: ClubRecipient; campusId?: string | null; subject?: string | null }) => {
      if (!userId) return null;

      setCreatingConversation(true);
      try {
        const conversationId = await createOrGetConversationForClub({
          orgId,
          adminUserId: userId,
          club: params.club,
          campusId: params.campusId,
          subject: params.subject,
        });

        await refreshConversations();
        setSelectedConversationId(conversationId);
        return conversationId;
      } finally {
        setCreatingConversation(false);
      }
    },
    [orgId, refreshConversations, userId],
  );

  useEffect(() => {
    if (!userId || !orgId) return;

    const channel = supabase
      .channel(`admin-messaging-${orgId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_messages",
          filter: `org_id=eq.${orgId}`,
        },
        async (payload) => {
          const inserted = payload.new as {
            id: string;
            conversation_id: string;
            org_id: string;
            sender_id: string;
            sender_role: "admin" | "club";
            body: string;
            created_at: string;
            edited_at: string | null;
          };

          setConversations((prev) => {
            const target = prev.find((conversation) => conversation.id === inserted.conversation_id);
            if (!target) {
              return prev;
            }

            const isActiveConversation = selectedConversationIdRef.current === inserted.conversation_id;
            const nextUnreadCount =
              isActiveConversation || inserted.sender_id === userId
                ? 0
                : target.unreadCount + 1;

            const updatedTarget: ConversationSummary = {
              ...target,
              lastMessageSnippet: normalizeSnippet(inserted.body),
              lastMessageAt: inserted.created_at,
              updatedAt: inserted.created_at,
              lastMessageSenderId: inserted.sender_id,
              unreadCount: nextUnreadCount,
            };

            return [updatedTarget, ...prev.filter((conversation) => conversation.id !== inserted.conversation_id)];
          });

          if (selectedConversationIdRef.current === inserted.conversation_id) {
            const message: ConversationMessage = {
              id: inserted.id,
              conversationId: inserted.conversation_id,
              orgId: inserted.org_id,
              senderId: inserted.sender_id,
              senderRole: inserted.sender_role,
              body: inserted.body,
              createdAt: inserted.created_at,
              editedAt: inserted.edited_at,
            };

            setMessages((prev) => {
              if (prev.some((entry) => entry.id === message.id)) {
                return prev;
              }
              return [...prev, message];
            });

            await markSelectedConversationRead(inserted.conversation_id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "admin_conversations",
          filter: `org_id=eq.${orgId}`,
        },
        async () => {
          await refreshConversations();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [markSelectedConversationRead, orgId, refreshConversations, userId]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  return {
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
    memberDirectory,
    sendMessage,
    sendingMessage,
    loadOlderMessages,
    startConversationWithClub,
    creatingConversation,
  };
}
