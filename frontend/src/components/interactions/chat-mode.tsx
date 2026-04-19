"use client";

import { useRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { addMessage, setLoading } from "@/store/slices/chatSlice";
import { syncFromChat } from "@/store/slices/interactionSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { aiApi, hcpApi } from "@/lib/api";
import { ChatMessage, HCP } from "@/types";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "I met with Dr. Johnson today to discuss CardioMax. Sentiment was positive and I shared brochures.",
  "Edit: change the sentiment to negative and the type to phone call",
  "Summarize: Discussed drug efficacy, side effects, pricing. Dr. Chen wants samples.",
  "What should I do next with Dr. Rodriguez?",
  "Tell me about Dr. Kim's interaction history",
];

export function ChatMode() {
  const dispatch = useDispatch();
  const messages = useSelector((state: RootState) => state.chat.messages);
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const user = useSelector((state: RootState) => state.auth.user);
  const [input, setInput] = useState("");
  const [hcps, setHcps] = useState<HCP[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load HCPs once for name → id resolution
  useEffect(() => {
    hcpApi.list({ limit: 100 }).then((res) => setHcps(res.data || [])).catch(() => { });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /**
   * Resolve an HCP name from extracted_data to an actual HCP id.
   * Matches first_name + last_name case-insensitively, stripping "Dr." prefix.
   */
  const resolveHcpId = (name: string): string => {
    if (!name) return "";
    const clean = name.replace(/^dr\.?\s*/i, "").trim().toLowerCase();
    const parts = clean.split(/\s+/);
    const match = hcps.find((h) => {
      const full = `${h.first_name} ${h.last_name}`.toLowerCase();
      const last = h.last_name.toLowerCase();
      if (parts.length >= 2) return full.includes(parts[0]) && full.includes(parts[parts.length - 1]);
      return last === parts[0] || full.includes(parts[0]);
    });
    return match?.id || "";
  };

  /**
   * Map extracted_data from the AI response to InteractionDraft fields
   * and dispatch syncFromChat to update the left-side form.
   */
  const syncExtractedToForm = async (extracted: Record<string, unknown>) => {
    const formUpdate: Record<string, unknown> = {};

    // Text / scalar fields
    if (extracted.notes) formUpdate.notes = extracted.notes;
    if (extracted.summary) formUpdate.outcomes = extracted.summary;
    if (extracted.interaction_type) formUpdate.interaction_type = extracted.interaction_type;
    if (extracted.date) formUpdate.date = extracted.date;
    if (extracted.sentiment) formUpdate.sentiment = extracted.sentiment;
    if (extracted.follow_up_date) formUpdate.follow_up_date = extracted.follow_up_date;

    // Array fields
    if (Array.isArray(extracted.products_discussed)) formUpdate.products_discussed = extracted.products_discussed;
    if (Array.isArray(extracted.key_topics)) formUpdate.topics_discussed = extracted.key_topics;
    if (Array.isArray(extracted.follow_up_actions)) formUpdate.follow_up_actions = extracted.follow_up_actions;
    if (Array.isArray(extracted.materials_shared)) formUpdate.materials_shared = extracted.materials_shared;
    if (Array.isArray(extracted.samples_distributed)) formUpdate.samples_distributed = extracted.samples_distributed;
    if (Array.isArray(extracted.attendees)) formUpdate.attendees = extracted.attendees;

    // Resolve HCP name → id, auto-create if not found
    if (extracted.hcp_name) {
      let hcpId = resolveHcpId(extracted.hcp_name as string);
      if (!hcpId) {
        // Auto-create the HCP
        try {
          const name = (extracted.hcp_name as string).replace(/^dr\.?\s*/i, "").trim();
          const parts = name.split(/\s+/);
          const firstName = parts[0] || name;
          const lastName = parts.slice(1).join(" ") || name;
          const newHcp = await hcpApi.create({ first_name: firstName, last_name: lastName });
          if (newHcp?.id) {
            hcpId = newHcp.id;
            setHcps((prev) => [...prev, newHcp]);
          }
        } catch {
          // ignore creation error
        }
      }
      if (hcpId) formUpdate.hcp_id = hcpId;
    }

    if (Object.keys(formUpdate).length > 0) {
      dispatch(syncFromChat(formUpdate));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    dispatch(addMessage(userMessage));
    setInput("");
    dispatch(setLoading(true));

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const userId = user?.id || "demo-user";
      const res = await aiApi.chat(userMessage.content, userId, history);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.message,
        timestamp: new Date().toISOString(),
        toolUsed: res.tool_used,
        data: res.data,
      };

      dispatch(addMessage(assistantMessage));

      // Sync extracted data to form draft
      if (res.data?.extracted_data) {
        syncExtractedToForm(res.data.extracted_data);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'm having trouble connecting to the AI service. Please check that the backend is running and try again.",
        timestamp: new Date().toISOString(),
      };
      dispatch(addMessage(errorMessage));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col rounded-lg border bg-background">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">AI Interaction Assistant</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe your HCP interaction and I&apos;ll fill the form automatically.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                    }`}
                >
                  <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                    {message.role === "assistant" ? (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.toolUsed && message.toolUsed !== "general" && (
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      🔧 {message.toolUsed.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                </Avatar>
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Describe your HCP interaction..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={!input.trim() || isLoading} size="icon">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Powered by LangGraph + Groq AI &middot; 5 tools: log, edit, context, suggest, summarize
        </p>
      </div>
    </div>
  );
}
