import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId: string | null;
}

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  sessionId: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    clearChat(state) {
      state.messages = [];
      state.sessionId = null;
    },
    setSessionId(state, action: PayloadAction<string>) {
      state.sessionId = action.payload;
    },
  },
});

export const { addMessage, setLoading, clearChat, setSessionId } = chatSlice.actions;
export default chatSlice.reducer;
