import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Plus,
  MoreVertical,
  Phone,
  Video,
  Image as ImageIcon,
  Send,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Club = {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
};

type Message = {
  id: string;
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
};

// Mock initial messages
const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    senderId: "other",
    text: "Hi there! I had a question about the upcoming event registration.",
    imageUrl: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    status: "read",
  },
  {
    id: "2",
    senderId: "me",
    text: "Hello! Sure, I'd be happy to help. What would you like to know?",
    imageUrl: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.9),
    status: "read",
  },
  {
    id: "3",
    senderId: "other",
    text: "Is there a deadline for club members to sign up?",
    imageUrl: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.8),
    status: "read",
  },
];

export default function Messaging() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [search, setSearch] = useState("");

  // Chat State
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClubs();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedClub]);

  const fetchClubs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clubs")
      .select("id,name,description,cover_image_url")
      .order("name");
    setClubs(data ?? []);
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) =>
      club.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [clubs, search]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: "me",
      text: inputText,
      imageUrl: null,
      timestamp: new Date(),
      status: "sent",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    // Simulate reply
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        senderId: "other",
        text: "Thanks for the info! This is really helpful.",
        imageUrl: null,
        timestamp: new Date(),
        status: "delivered",
      };
      setMessages((prev) => [...prev, reply]);
    }, 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newMessage: Message = {
          id: Date.now().toString(),
          senderId: "me",
          text: null,
          imageUrl: reader.result as string,
          timestamp: new Date(),
          status: "sent",
        };
        setMessages((prev) => [...prev, newMessage]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="flex w-80 flex-col border-r bg-muted/10">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Messages</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))
            ) : filteredClubs.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No conversations found.
              </p>
            ) : (
              filteredClubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => setSelectedClub(club)}
                  className={cn(
                    "flex items-center gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent",
                    selectedClub?.id === club.id && "bg-accent"
                  )}
                >
                  <Avatar>
                    <AvatarImage src={club.cover_image_url || undefined} />
                    <AvatarFallback>
                      {club.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{club.name}</span>
                      <span className="text-xs text-muted-foreground">12:30 PM</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {club.description || "No recent messages"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col bg-background">
        {selectedClub ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={selectedClub.cover_image_url || undefined} />
                  <AvatarFallback>{selectedClub.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold leading-none">{selectedClub.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Video className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="mx-2 h-6" />
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
              {messages.map((msg) => {
                const isMe = msg.senderId === "me";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex w-full",
                      isMe ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "flex max-w-[70%] flex-col gap-1",
                        isMe ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2 shadow-sm",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-white dark:bg-card border rounded-bl-none"
                        )}
                      >
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt="Attachment"
                            className="mb-2 max-w-full rounded-lg"
                          />
                        )}
                        {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span>{format(msg.timestamp, "h:mm a")}</span>
                        {isMe && (
                          <span>
                            {msg.status === "read" ? (
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
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-4 bg-background">
              <div className="flex items-end gap-2">
                <div className="flex gap-1 pb-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </div>
                <div className="relative flex-1">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="pr-10 min-h-[44px] py-3 rounded-full bg-muted/30 border-muted-foreground/20 focus-visible:ring-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  size="icon"
                  className="h-11 w-11 rounded-full shadow-md shrink-0"
                >
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <MessageSquareIcon className="h-10 w-10 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No Chat Selected</h3>
            <p className="max-w-sm mt-2 text-sm">
              Select a conversation from the sidebar to start messaging clubs and students.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
