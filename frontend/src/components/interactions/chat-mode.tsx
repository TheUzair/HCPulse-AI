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
import { aiApi } from "@/lib/api";
import { ChatMessage } from "@/types";

const SUGGESTIONS = [
  "I just met with Dr. Johnson about CardioMax",
  "Log my phone call with Dr. Chen about the oncology trial",
  "Summarize my last interaction notes",
  "What should I do next with Dr. Rodriguez?",
  "Edit my last interaction to add follow-up notes",
];

export function ChatMode() {
  const dispatch = useDispatch();
  const messages = useSelector((state: RootState) => state.chat.messages);
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const user = useSelector((state: RootState) => state.auth.user);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

      // Sync extracted data to form draft if interaction was logged
      if (res.data?.extracted_data) {
        const extracted = res.data.extracted_data;
        dispatch(
          syncFromChat({
            notes: extracted.notes || "",
            products_discussed: extracted.products_discussed || [],
            follow_up_actions: extracted.follow_up_actions || [],
          })
        );
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
    <div className="flex h-[600px] flex-col rounded-lg border bg-background">
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
                Describe your HCP interaction and I&apos;ll help you log it.
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
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.toolUsed && (
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      Tool: {message.toolUsed}
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
          Powered by Groq AI &middot; gemma2-9b-it
        </p>
      </div>
    </div>
  );
}
