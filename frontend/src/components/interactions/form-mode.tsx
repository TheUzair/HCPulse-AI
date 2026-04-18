"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { updateDraft, resetDraft, setSubmitting, setMode } from "@/store/slices/interactionSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { hcpApi, interactionApi, aiApi } from "@/lib/api";
import { HCP } from "@/types";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export function FormMode() {
  const dispatch = useDispatch();
  const draft = useSelector((state: RootState) => state.interaction.draft);
  const isSubmitting = useSelector((state: RootState) => state.interaction.isSubmitting);
  const user = useSelector((state: RootState) => state.auth.user);
  const [hcps, setHcps] = useState<HCP[]>([]);
  const [hcpOpen, setHcpOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Tag inputs
  const [attendeeInput, setAttendeeInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [materialInput, setMaterialInput] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Voice input for topics
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceTranscript(transcript);
    };

    recognition.onerror = () => {
      stopRecording();
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setVoiceTranscript("");
  }, [stopRecording]);

  const addVoiceTranscriptAsTopics = useCallback(() => {
    if (voiceTranscript.trim()) {
      // Split transcript by commas, periods, or "and" into separate topics
      const topics = voiceTranscript
        .split(/[,.]|\band\b/i)
        .map((t) => t.trim())
        .filter(Boolean);
      dispatch(
        updateDraft({
          topics_discussed: [...draft.topics_discussed, ...topics],
        })
      );
      setVoiceTranscript("");
    }
  }, [voiceTranscript, draft.topics_discussed, dispatch]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    async function loadHCPs() {
      try {
        const res = await hcpApi.list({ limit: 100 });
        setHcps(res.data || []);
      } catch (err) {
        console.error("Failed to load HCPs:", err);
      }
    }
    loadHCPs();
  }, []);

  const selectedHcp = hcps.find((h) => h.id === draft.hcp_id);

  // Generic add/remove for array fields
  const addToArray = (field: string, value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      const current = (draft as unknown as Record<string, unknown>)[field] as string[];
      dispatch(updateDraft({ [field]: [...current, value.trim()] } as Partial<typeof draft>));
      setter("");
    }
  };

  const removeFromArray = (field: string, index: number) => {
    const current = (draft as unknown as Record<string, unknown>)[field] as string[];
    dispatch(updateDraft({ [field]: current.filter((_, i) => i !== index) } as Partial<typeof draft>));
  };

  const fetchAiSuggestions = async () => {
    if (!draft.notes) return;
    setLoadingSuggestions(true);
    try {
      const res = await aiApi.chat(
        `Please provide 3 specific follow-up action items for this HCP interaction.\nNotes: ${draft.notes}\nTopics: ${draft.topics_discussed.join(", ")}\nSentiment: ${draft.sentiment}\nProducts: ${draft.products_discussed.join(", ")}`,
        user?.id || "demo-user",
        []
      );
      const lines = res.message
        .split("\n")
        .filter((l: string) => l.trim().match(/^[-•\d]/))
        .map((l: string) => l.replace(/^[-•\d.)\s]+/, "").trim())
        .filter(Boolean);
      setAiSuggestions(lines.length > 0 ? lines.slice(0, 5) : [res.message]);
    } catch {
      setAiSuggestions(["Could not generate suggestions. Please try again."]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSubmit = async () => {
    if (!draft.hcp_id || !user?.id) return;

    dispatch(setSubmitting(true));
    try {
      const payload: Record<string, unknown> = {
        hcp_id: draft.hcp_id,
        interaction_type: draft.interaction_type,
        date: draft.date,
        notes: draft.notes || undefined,
        summary: draft.outcomes || undefined,
        products_discussed: draft.products_discussed,
        key_topics: draft.topics_discussed,
        follow_up_actions: draft.follow_up_actions,
        follow_up_date: draft.follow_up_date || undefined,
      };
      if (draft.sentiment && ["positive", "neutral", "negative"].includes(draft.sentiment)) {
        payload.sentiment = draft.sentiment;
      }
      await interactionApi.create(user.id, payload);
      dispatch(resetDraft());
      setAiSuggestions([]);
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to log interaction. Please try again.");
      setTimeout(() => setSubmitError(null), 5000);
    } finally {
      dispatch(setSubmitting(false));
    }
  };

  return (
    <div className="space-y-4">
      {submitSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Interaction logged successfully!
          </div>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
            Switch to the AI Assistant to explore more:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-emerald-300 dark:border-emerald-700"
              onClick={() => dispatch(setMode("chat"))}
            >
              Ask AI Assistant
            </Button>
            {[
              { label: "View History", hint: "Tell me about Dr. ..." },
              { label: "Summarize", hint: "Summarize my interactions" },
              { label: "Get Suggestions", hint: "What should I do next?" },
            ].map((action) => (
              <span
                key={action.label}
                className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                title={action.hint}
              >
                {action.label}
              </span>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 h-7 text-xs text-emerald-600 dark:text-emerald-400"
            onClick={() => setSubmitSuccess(false)}
          >
            Log Another Interaction
          </Button>
        </div>
      )}

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {submitError}
          </div>
        </div>
      )}

      {submitSuccess ? null : (<>
        {/* HCP Selection — Command Popover */}
        <div className="space-y-2">
          <Label>Healthcare Professional *</Label>
          <Popover open={hcpOpen} onOpenChange={setHcpOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={hcpOpen}
                className="w-full justify-between font-normal"
              >
                {selectedHcp
                  ? `Dr. ${selectedHcp.first_name} ${selectedHcp.last_name} — ${selectedHcp.specialty || "General"}`
                  : "Search or select HCP..."}
                <svg className="ml-2 h-4 w-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search HCP by name or specialty..." />
                <CommandList>
                  <CommandEmpty>No HCP found.</CommandEmpty>
                  <CommandGroup>
                    {hcps.map((hcp) => (
                      <CommandItem
                        key={hcp.id}
                        value={`${hcp.first_name} ${hcp.last_name} ${hcp.specialty}`}
                        onSelect={() => {
                          dispatch(updateDraft({ hcp_id: hcp.id }));
                          setHcpOpen(false);
                        }}
                      >
                        <svg
                          className={cn("mr-2 h-4 w-4", draft.hcp_id === hcp.id ? "opacity-100" : "opacity-0")}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium">Dr. {hcp.first_name} {hcp.last_name}</p>
                          <p className="text-xs text-muted-foreground">{hcp.specialty || "General"} · {hcp.organization || ""}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Interaction Type + Date + Time */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Interaction Type *</Label>
            <Select
              value={draft.interaction_type}
              onValueChange={(value) => dispatch(updateDraft({ interaction_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In Person</SelectItem>
                <SelectItem value="phone">Phone Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="video">Video Call</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => dispatch(updateDraft({ date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <Input
              type="time"
              value={draft.time}
              onChange={(e) => dispatch(updateDraft({ time: e.target.value }))}
            />
          </div>
        </div>

        {/* Attendees */}
        <TagField
          label="Attendees"
          placeholder="Add attendee name..."
          items={draft.attendees}
          input={attendeeInput}
          setInput={setAttendeeInput}
          onAdd={() => addToArray("attendees", attendeeInput, setAttendeeInput)}
          onRemove={(i) => removeFromArray("attendees", i)}
        />

        {/* Topics Discussed */}
        <div className="space-y-2">
          <Label>Topics Discussed</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a topic..."
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addToArray("topics_discussed", topicInput, setTopicInput);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => addToArray("topics_discussed", topicInput, setTopicInput)}
            >
              Add
            </Button>
            <Button
              type="button"
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              className="shrink-0"
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? "Stop recording" : "Speak topics"}
            >
              {isRecording ? (
                <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              )}
            </Button>
          </div>

          {/* Voice transcript preview */}
          {(isRecording || voiceTranscript) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              {isRecording && (
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Listening...
                </div>
              )}
              {voiceTranscript && (
                <>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{voiceTranscript}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={addVoiceTranscriptAsTopics}
                  >
                    Add as Topics
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Existing topic tags */}
          {draft.topics_discussed.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.topics_discussed.map((item, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {item}
                  <button onClick={() => removeFromArray("topics_discussed", i)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20">
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3.05 3.05a.75.75 0 011.06 0L6 4.94l1.89-1.89a.75.75 0 111.06 1.06L7.06 6l1.89 1.89a.75.75 0 11-1.06 1.06L6 7.06 4.11 8.95a.75.75 0 01-1.06-1.06L4.94 6 3.05 4.11a.75.75 0 010-1.06z" />
                    </svg>
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Voice Note Consent */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={draft.voice_note_consent}
                onClick={() => dispatch(updateDraft({ voice_note_consent: !draft.voice_note_consent }))}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                  draft.voice_note_consent
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input"
                )}
              >
                {draft.voice_note_consent && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Summary from Voice Note</p>
            </div>
            <p className="mt-1 ml-7 text-xs text-amber-600 dark:text-amber-400">
              ⚠ Requires consent from all participants before recording. Ensure compliance with local regulations.
            </p>
          </div>
        </div>

        {/* Materials Shared */}
        <TagField
          label="Materials Shared"
          placeholder="Search or add material..."
          items={draft.materials_shared}
          input={materialInput}
          setInput={setMaterialInput}
          onAdd={() => addToArray("materials_shared", materialInput, setMaterialInput)}
          onRemove={(i) => removeFromArray("materials_shared", i)}
        />

        {/* Samples Distributed */}
        <TagField
          label="Samples Distributed"
          placeholder="Add sample..."
          items={draft.samples_distributed}
          input={sampleInput}
          setInput={setSampleInput}
          onAdd={() => addToArray("samples_distributed", sampleInput, setSampleInput)}
          onRemove={(i) => removeFromArray("samples_distributed", i)}
        />

        {/* Sentiment */}
        <div className="space-y-2">
          <Label>Observed / Inferred HCP Sentiment</Label>
          <div className="flex gap-2">
            {(["positive", "neutral", "negative"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                variant={draft.sentiment === s ? "default" : "outline"}
                size="sm"
                className={cn(
                  "flex-1 capitalize",
                  draft.sentiment === s && s === "positive" && "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700",
                  draft.sentiment === s && s === "neutral" && "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600",
                  draft.sentiment === s && s === "negative" && "bg-red-600 hover:bg-red-700 dark:bg-red-700"
                )}
                onClick={() => dispatch(updateDraft({ sentiment: draft.sentiment === s ? "" : s }))}
              >
                {s === "positive" && "😊 "}
                {s === "neutral" && "😐 "}
                {s === "negative" && "😞 "}
                {s}
              </Button>
            ))}
          </div>
        </div>

        {/* Outcomes */}
        <div className="space-y-2">
          <Label>Outcomes</Label>
          <Textarea
            placeholder="Key outcomes from this interaction..."
            className="min-h-[80px]"
            value={draft.outcomes}
            onChange={(e) => dispatch(updateDraft({ outcomes: e.target.value }))}
          />
        </div>

        {/* Follow-up Actions */}
        <TagField
          label="Follow-up Actions"
          placeholder="Add a follow-up action..."
          items={draft.follow_up_actions}
          input={followUpInput}
          setInput={setFollowUpInput}
          onAdd={() => addToArray("follow_up_actions", followUpInput, setFollowUpInput)}
          onRemove={(i) => removeFromArray("follow_up_actions", i)}
          asList
        />

        {/* AI Suggested Follow-ups */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">AI Suggested Follow-ups</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchAiSuggestions}
                disabled={loadingSuggestions || !draft.notes}
              >
                {loadingSuggestions ? (
                  <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                )}
                Generate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiSuggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Fill in the form and click Generate for AI-powered follow-up suggestions.
              </p>
            ) : (
              <div className="space-y-2">
                {aiSuggestions.map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                    <div className="flex-1 prose prose-sm dark:prose-invert max-w-none [&>p]:my-0">
                      <ReactMarkdown>{suggestion}</ReactMarkdown>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-2 text-xs"
                      onClick={() => {
                        const cleaned = suggestion.replace(/\*\*/g, "").trim();
                        dispatch(
                          updateDraft({
                            follow_up_actions: [...draft.follow_up_actions, cleaned],
                          })
                        );
                      }}
                    >
                      + Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={handleSubmit} disabled={!draft.hcp_id || isSubmitting} className="min-w-[140px]">
            {isSubmitting ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Logging...
              </>
            ) : (
              "Log Interaction"
            )}
          </Button>
        </div>
      </>)}
    </div>
  );
}

// Reusable tag/list field component
function TagField({
  label,
  placeholder,
  items,
  input,
  setInput,
  onAdd,
  onRemove,
  asList,
}: {
  label: string;
  placeholder: string;
  items: string[];
  input: string;
  setInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  asList?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onAdd}>
          Add
        </Button>
      </div>
      {items.length > 0 && (
        asList ? (
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{item}</span>
                <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {item}
                <button onClick={() => onRemove(i)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20">
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M3.05 3.05a.75.75 0 011.06 0L6 4.94l1.89-1.89a.75.75 0 111.06 1.06L7.06 6l1.89 1.89a.75.75 0 11-1.06 1.06L6 7.06 4.11 8.95a.75.75 0 01-1.06-1.06L4.94 6 3.05 4.11a.75.75 0 010-1.06z" />
                  </svg>
                </button>
              </Badge>
            ))}
          </div>
        )
      )}
    </div>
  );
}
