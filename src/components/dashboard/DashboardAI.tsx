import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import type {
    DashboardStats,
    TrendPoint,
    EventDayStat,
    DashboardEvent,
    PendingItem,
} from "@/lib/supabaseDashboardApi";
import { generateOllamaResponse } from "@/lib/ollamaApi";

interface DashboardAIProps {
    stats: DashboardStats | null;
    trendData: TrendPoint[];
    activeDaysData: EventDayStat[];
    recentEvents: DashboardEvent[];
    pendingItems: PendingItem[];
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function DashboardAI({
    stats,
    trendData,
    activeDaysData,
    recentEvents,
    pendingItems,
}: DashboardAIProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const generateSnapshot = () => {
        if (!stats) return "No data available.";

        return JSON.stringify(
            {
                kpi_overview: {
                    active_clubs: stats.activeClubs,
                    approved_clubs: stats.approvedClubs,
                    total_members: stats.totalMembers,
                    upcoming_events: stats.upcomingEvents,
                    pending_events: stats.pendingEvents,
                    officer_accounts: stats.officerAccounts,
                    total_profiles: stats.totalProfiles,
                },
                engagement_trend: trendData.map((t) => ({
                    date: t.dateLabel,
                    members: t.members,
                    clubs: t.clubs,
                })),
                most_active_days: activeDaysData,
                recent_events: recentEvents.map((e) => ({
                    name: e.name,
                    date: e.date,
                    location: e.location,
                    approved: e.approved,
                })),
                pending_approvals: pendingItems.map((i) => ({
                    name: i.name,
                    type: i.type,
                    owner: i.owner,
                    created_at: i.created_at,
                })),
            },
            null,
            2
        );
    };

    const handleAsk = async () => {
        if (!query.trim()) return;

        const userMsg = query;
        setQuery("");
        setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
        setIsLoading(true);

        try {
            // Generate the snapshot
            const snapshot = generateSnapshot();

            // Construct the full prompt
            const systemPrompt = `
You are UniCentral Analytics AI, an assistant for campus administrators.

You are viewing a live analytics dashboard that summarizes club activity,
member engagement, and growth trends.

You are given a structured snapshot of what is currently displayed on the page.
Treat this data as the ONLY source of truth.

YOUR BEHAVIOR:
- Reason as if you are "looking at" the analytics dashboard.
- Explain insights clearly and calmly, like a data analyst.
- When making claims, point to specific metrics you observed.
- If data is sparse or missing, explicitly say so and explain the limitation.
- Do NOT guess or invent metrics.
- Do NOT reference raw JSON or technical internals in your answer.

WHEN ANSWERING:
1. Start with a short direct answer.
2. Explain how the dashboard data supports this conclusion.
3. Highlight 1-3 notable observations.
4. Suggest 2-4 practical next actions for admins.

TONE:
- Professional
- Analytical
- Helpful
- Not salesy
- Not overly verbose

DATA CURRENTLY DISPLAYED:
${snapshot}

USER QUESTION:
${userMsg}

ANALYSIS AND RESPONSE:
`;

            console.log("Sending prompt to Ollama...");

            // Call Ollama API
            // We try a few common models if the default fails, or just let the user know
            let responseText = "";
            try {
                responseText = await generateOllamaResponse(systemPrompt, "llama3.2");
            } catch (err) {
                console.warn("Failed with llama3.2, trying deepseek-r1:1.5b...", err);
                try {
                    responseText = await generateOllamaResponse(systemPrompt, "deepseek-r1:1.5b");
                } catch (retryErr) {
                    console.error("All Ollama attempts failed:", retryErr);
                    throw new Error("Could not connect to local AI. Is Ollama running?");
                }
            }

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: responseText },
            ]);
        } catch (error) {
            console.error("AI Error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "I couldn't connect to your local AI model. Please ensure Ollama is running with `OLLAMA_ORIGINS=\"*\" ollama serve`.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 z-50"
                >
                    <Sparkles className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        Analytics Assistant
                    </SheetTitle>
                    <SheetDescription>
                        Ask questions about your dashboard metrics and get AI-powered insights.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 flex flex-col gap-4 mt-4 overflow-hidden">
                    <ScrollArea className="flex-1 pr-4">
                        <div className="flex flex-col gap-4">
                            {messages.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>
                                        Hi! I'm your analytics assistant. Ask me anything about your
                                        club growth, event trends, or pending approvals.
                                    </p>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    <div
                                        className={`rounded-lg px-4 py-2 max-w-[85%] text-sm ${msg.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                            }`}
                                    >
                                        {msg.content.split("\n").map((line, j) => (
                                            <p key={j} className="mb-1 last:mb-0">
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-xs text-muted-foreground">
                                            Analyzing data...
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="flex gap-2 pt-2">
                        <Input
                            placeholder="Ask a question about your data..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                            disabled={isLoading}
                        />
                        <Button size="icon" onClick={handleAsk} disabled={isLoading || !query.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
