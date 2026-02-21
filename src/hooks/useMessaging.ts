import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  MESSAGE_PAGE_SIZE,
  type ConversationMessage,
  type ConversationSummary,
  type MessagingBackend,
  type MessagingProfile,
  type TargetType,
  fetchConversationMessages,
  fetchConversationSummaries,
  getMessagingBackend,
  getOrCreateConversation,
  markConversationRead,
  resolveOrgId,
  resolveSenderType,
  sendConversationMessage,
} from "@/lib/messagingApi";

type UseMessagingParams = {
  userId: string | null;
  profile: MessagingProfile | null;
};

const normalizePreview = (value: string) => {
  const text = value.trim();
  if (!text) return "No messages yet";
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
};

export function useMessaging({ userId, profile }: UseMessagingParams) {
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagePage, setMessagePage] = useState(0);

  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [backend, setBackend] = useState<MessagingBackend>("modern");

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

      if (!selectedConversationIdRef.current && data.length > 0) {
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
    const timeoutId = window.setTimeout(() => {
      refreshConversations();
    }, 150);

    return () => window.clearTimeout(timeoutId);
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
        setHasMoreMessages(false);
        setMessagePage(0);
        return;
      }

      setMessagesLoading(true);
      setMessagePage(0);

      try {
        const payload = await fetchConversationMessages({
          conversationId: selectedConversationId,
          page: 0,
          pageSize: MESSAGE_PAGE_SIZE,
        });

        setMessages(payload.messages);
        setHasMoreMessages(payload.hasMore);
        await markSelectedConversationRead(selectedConversationId);
      } finally {
        setMessagesLoading(false);
      }
    };

    loadSelectedConversation();
  }, [markSelectedConversationRead, selectedConversationId]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedConversationId || loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);
    try {
      const nextPage = messagePage + 1;
      const payload = await fetchConversationMessages({
        conversationId: selectedConversationId,
        page: nextPage,
        pageSize: MESSAGE_PAGE_SIZE,
      });

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

      setSendingMessage(true);
      try {
        const message = await sendConversationMessage({
          conversationId: selectedConversationId,
          orgId,
          senderId: userId,
          senderType: resolveSenderType(profile),
          body: trimmed,
        });

        setMessages((prev) => {
          if (prev.some((entry) => entry.id === message.id)) return prev;
          return [...prev, message];
        });

        setConversations((prev) => {
          const target = prev.find((conversation) => conversation.id === selectedConversationId);
          if (!target) return prev;

          const updated: ConversationSummary = {
            ...target,
            preview: normalizePreview(trimmed),
            lastMessageAt: message.createdAt,
            updatedAt: message.createdAt,
            unreadCount: 0,
          };

          return [updated, ...prev.filter((conversation) => conversation.id !== selectedConversationId)];
        });

        await markSelectedConversationRead(selectedConversationId);
      } finally {
        setSendingMessage(false);
      }
    },
    [markSelectedConversationRead, orgId, profile, selectedConversationId, userId],
  );

  const startConversation = useCallback(
    async (targetType: TargetType, targetId: string) => {
      if (!userId) return null;

      setCreatingConversation(true);
      try {
        const conversationId = await getOrCreateConversation({
          orgId,
          currentUserId: userId,
          targetType,
          targetId,
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
    let mounted = true;
    getMessagingBackend().then((value) => {
      if (mounted) setBackend(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !orgId) return;

    const messageTable = backend === "legacy" ? "chat_messages" : "messages";
    const conversationTable = backend === "legacy" ? "chat_rooms" : "conversations";
    const filter = backend === "legacy" ? undefined : `org_id=eq.${orgId}`;

    const channel = supabase
      .channel(`messaging-${orgId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: messageTable,
          filter,
        },
        async (payload) => {
          let conversationId = "";
          let body = "";
          let createdAt = "";
          let senderId = "";
          let senderType: "admin" | "club" | "officer" | "other" = "other";
          let payloadOrgId = orgId;
          let messageId = "";

          if (backend === "legacy") {
            const inserted = payload.new as {
              id: string;
              room_id: string;
              sender_id: string;
              content: string;
              created_at: string;
            };

            messageId = inserted.id;
            conversationId = inserted.room_id;
            body = inserted.content;
            createdAt = inserted.created_at;
            senderId = inserted.sender_id;
            senderType = "other";
            payloadOrgId = orgId;
          } else {
            const inserted = payload.new as {
              id: string;
              conversation_id: string;
              org_id: string;
              sender_id: string;
              sender_type: "admin" | "club" | "officer" | "other";
              body: string;
              created_at: string;
            };

            messageId = inserted.id;
            conversationId = inserted.conversation_id;
            body = inserted.body;
            createdAt = inserted.created_at;
            senderId = inserted.sender_id;
            senderType = inserted.sender_type;
            payloadOrgId = inserted.org_id;
          }

          let conversationExists = false;

          setConversations((prev) => {
            const target = prev.find((conversation) => conversation.id === conversationId);
            if (!target) return prev;

            conversationExists = true;
            const isActive = selectedConversationIdRef.current === conversationId;
            const unreadCount =
              isActive || senderId === userId
                ? 0
                : target.unreadCount + 1;

            const updated: ConversationSummary = {
              ...target,
              preview: normalizePreview(body),
              lastMessageAt: createdAt,
              updatedAt: createdAt,
              unreadCount,
            };

            return [updated, ...prev.filter((conversation) => conversation.id !== conversationId)];
          });

          if (!conversationExists) {
            await refreshConversations();
          }

          if (selectedConversationIdRef.current === conversationId) {
            const message: ConversationMessage = {
              id: messageId,
              conversationId,
              orgId: payloadOrgId,
              senderId,
              senderType,
              body,
              createdAt,
            };

            setMessages((prev) => {
              if (prev.some((entry) => entry.id === message.id)) return prev;
              return [...prev, message];
            });

            await markSelectedConversationRead(conversationId);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: conversationTable,
          filter,
        },
        async () => {
          await refreshConversations();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [backend, markSelectedConversationRead, orgId, refreshConversations, userId]);

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
  };
}
