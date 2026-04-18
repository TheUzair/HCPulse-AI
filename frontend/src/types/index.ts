export interface HCP {
  id: string;
  first_name: string;
  last_name: string;
  specialty?: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  npi_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  user_id: string;
  hcp_id: string;
  interaction_type: "in_person" | "phone" | "email" | "video";
  date: string;
  notes?: string;
  summary?: string;
  products_discussed: string[];
  key_topics: string[];
  sentiment?: "positive" | "neutral" | "negative";
  follow_up_actions: string[];
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolUsed?: string;
  data?: Record<string, any>;
}

export interface InteractionDraft {
  hcp_id: string;
  interaction_type: string;
  date: string;
  time: string;
  attendees: string[];
  topics_discussed: string[];
  notes: string;
  voice_note_consent: boolean;
  materials_shared: string[];
  samples_distributed: string[];
  sentiment: "positive" | "neutral" | "negative" | "";
  outcomes: string;
  products_discussed: string[];
  follow_up_actions: string[];
  follow_up_date?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  limit: number;
}
