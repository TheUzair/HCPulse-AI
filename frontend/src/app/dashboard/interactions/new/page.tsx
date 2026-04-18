"use client";

import { FormMode } from "@/components/interactions/form-mode";
import { ChatMode } from "@/components/interactions/chat-mode";

export default function NewInteractionPage() {
  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Log HCP Interaction</h1>
        <p className="text-sm text-muted-foreground">
          Use the AI assistant on the right to fill the form. Describe your interaction naturally.
        </p>
      </div>

      {/* Split-screen layout */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left — Structured Form (scrollable) */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 flex shrink-0 items-center gap-2 text-sm font-semibold text-muted-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            Interaction Details
            <span className="ml-auto text-xs font-normal text-muted-foreground/70">Auto-filled by AI</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-background p-4">
            <FormMode />
          </div>
        </div>

        {/* Right — AI Chat (fixed full height) */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 flex shrink-0 items-center gap-2 text-sm font-semibold text-muted-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Assistant
            <span className="ml-auto text-xs font-normal text-muted-foreground/70">Controls the form</span>
          </div>
          <div className="min-h-0 flex-1">
            <ChatMode />
          </div>
        </div>
      </div>
    </div>
  );
}
