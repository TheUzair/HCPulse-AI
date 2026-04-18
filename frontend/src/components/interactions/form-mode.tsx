"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { updateDraft, setSubmitting } from "@/store/slices/interactionSlice";
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

export function FormMode() {
  const dispatch = useDispatch();
  const draft = useSelector((state: RootState) => state.interaction.draft);
  const isSubmitting = useSelector((state: RootState) => state.interaction.isSubmitting);
  const user = useSelector((state: RootState) => state.auth.user);
  const [hcps, setHcps] = useState<HCP[]>([]);
  const [hcpOpen, setHcpOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Tag inputs
  const [attendeeInput, setAttendeeInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [materialInput, setMaterialInput] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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
    if (!draft.hcp_id || !draft.notes) return;
    setLoadingSuggestions(true);
    try {
      const res = await aiApi.chat(
        `Based on this interaction: ${draft.notes}\nTopics: ${draft.topics_discussed.join(", ")}\nSentiment: ${draft.sentiment}\nSuggest 3 specific follow-up actions.`,
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
      await interactionApi.create(user.id, {
        hcp_id: draft.hcp_id,
        interaction_type: draft.interaction_type,
        date: draft.date,
        notes: draft.notes,
        products_discussed: draft.products_discussed,
        follow_up_actions: draft.follow_up_actions,
        follow_up_date: draft.follow_up_date || null,
      });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to create interaction:", err);
    } finally {
      dispatch(setSubmitting(false));
    }
  };

  return (
    <div className="space-y-4">
      {submitSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Interaction logged successfully!
        </div>
      )}

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
      <TagField
        label="Topics Discussed"
        placeholder="Add a topic..."
        items={draft.topics_discussed}
        input={topicInput}
        setInput={setTopicInput}
        onAdd={() => addToArray("topics_discussed", topicInput, setTopicInput)}
        onRemove={(i) => removeFromArray("topics_discussed", i)}
      />

      {/* Voice Note Option */}
      <div className="flex items-center gap-3 rounded-lg border p-3">
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
        <div>
          <p className="text-sm font-medium">Summarize from voice note</p>
          <p className="text-xs text-muted-foreground">Requires consent from all participants</p>
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
                  <span className="flex-1">{suggestion}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      dispatch(
                        updateDraft({
                          follow_up_actions: [...draft.follow_up_actions, suggestion],
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
