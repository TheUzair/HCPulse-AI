import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { InteractionDraft } from "@/types";

interface InteractionState {
  draft: InteractionDraft;
  mode: "form" | "chat";
  isSubmitting: boolean;
  lastSaved?: string;
}

const initialDraft: InteractionDraft = {
  hcp_id: "",
  interaction_type: "in_person",
  date: new Date().toISOString().split("T")[0],
  time: new Date().toTimeString().slice(0, 5),
  attendees: [],
  topics_discussed: [],
  notes: "",
  voice_note_consent: false,
  materials_shared: [],
  samples_distributed: [],
  sentiment: "",
  outcomes: "",
  products_discussed: [],
  follow_up_actions: [],
  follow_up_date: undefined,
};

const initialState: InteractionState = {
  draft: initialDraft,
  mode: "form",
  isSubmitting: false,
};

const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    updateDraft(state, action: PayloadAction<Partial<InteractionDraft>>) {
      state.draft = { ...state.draft, ...action.payload };
    },
    resetDraft(state) {
      state.draft = initialDraft;
    },
    setMode(state, action: PayloadAction<"form" | "chat">) {
      state.mode = action.payload;
    },
    setSubmitting(state, action: PayloadAction<boolean>) {
      state.isSubmitting = action.payload;
    },
    setLastSaved(state, action: PayloadAction<string>) {
      state.lastSaved = action.payload;
    },
    syncFromChat(state, action: PayloadAction<Partial<InteractionDraft>>) {
      state.draft = { ...state.draft, ...action.payload };
    },
  },
});

export const { updateDraft, resetDraft, setMode, setSubmitting, setLastSaved, syncFromChat } =
  interactionSlice.actions;
export default interactionSlice.reducer;
