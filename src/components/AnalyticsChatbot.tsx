import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateOllamaResponse } from "@/lib/ollamaApi";
import ReactMarkdown from "react-markdown";

type Message = {
    role: "user" | "assistant" | "system";
    content: string;
};

type AnalyticsContext = {
    stats: any;
    topClubs: any[];
    engagement: any[];
};

export function AnalyticsChatbot({ context }: { context: AnalyticsContext }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hi! I'm your Analytics AI. Ask me anything about your club data, trends, or engagement." }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: "user" as const, content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            // Construct system prompt with context
            const systemPrompt = `You are an expert data analyst for the Connect Camp Student Life Admin Dashboard. 
            
            You have access to the following current analytics data:
            
            Overview Stats:
            ${JSON.stringify(context.stats, null, 2)}
            
            Top Clubs:
            ${JSON.stringify(context.topClubs, null, 2)}
            
            Engagement Trends (Last 7 Days):
            ${JSON.stringify(context.engagement, null, 2)}
            
            YOUR BEHAVIOR:
            - Reason as if you are "looking at" the analytics dashboard.
            - Explain insights clearly and calmly.
            - Be extremely concise. Avoid fluff.
            
            WHEN ANSWERING:
            1. Start with a direct answer (1 sentence).
            2. Provide 1-2 key observations supported by data.
            3. Suggest 1 practical next action.
            
            FORMATTING:
            - Use **Markdown** (bold, bullet points).
            - Keep the total response under 100 words.
            
            USER QUESTION:
            ${input}
            `;

            console.log("Sending prompt to Ollama...");

            // Call Ollama API
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

            setMessages(prev => [...prev, { role: "assistant", content: responseText }]);

        } catch (error) {
            console.error("Chatbot error:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            setMessages(prev => [...prev, { role: "assistant", content: `Error: ${errorMessage}. Please check your connection.` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
            {isOpen && (
                <Card className="w-[400px] shadow-2xl border-slate-200 animate-in slide-in-from-bottom-10 fade-in duration-300 flex flex-col h-[500px]">
                    <CardHeader className="bg-slate-950 text-white rounded-t-xl p-4 flex flex-row items-center justify-between space-y-0 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-white/10 rounded-lg">
                                <Sparkles className="h-4 w-4 text-yellow-300" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-medium">Analytics AI</CardTitle>
                                <p className="text-xs text-slate-400">Powered by Local LLM</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white hover:bg-white/10 h-8 w-8"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <div
                            ref={scrollRef}
                            className="h-full overflow-y-auto p-4 space-y-4 bg-slate-50/50"
                        >
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex w-full",
                                        msg.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className={cn(
                                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                        msg.role === "user"
                                            ? "bg-slate-900 text-white rounded-br-none"
                                            : "bg-white border border-slate-100 text-slate-700 rounded-bl-none"
                                    )}>
                                        {msg.role === "user" ? (
                                            msg.content
                                        ) : (
                                            <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:p-2 prose-pre:rounded-lg">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                                        li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                                                        strong: ({ node, ...props }) => <span className="font-semibold text-slate-900" {...props} />,
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="p-3 bg-white border-t shrink-0">
                        <form
                            className="flex w-full gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                        >
                            <Input
                                placeholder="Ask about trends..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="flex-1 bg-slate-50 border-slate-200 focus-visible:ring-slate-900"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={loading || !input.trim()}
                                className="bg-slate-900 hover:bg-slate-800 shrink-0"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            <Button
                size="lg"
                className={cn(
                    "h-14 w-14 rounded-full shadow-xl transition-all duration-300 hover:scale-105",
                    isOpen ? "bg-slate-200 text-slate-600 hover:bg-slate-300" : "bg-slate-900 text-white hover:bg-slate-800"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
            </Button>
        </div>
    );
}
