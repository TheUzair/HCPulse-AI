const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API Error: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// HCP APIs
export const hcpApi = {
  list: (params?: { skip?: number; limit?: number; search?: string; specialty?: string }) => {
    const query = new URLSearchParams();
    if (params?.skip) query.set("skip", String(params.skip));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (params?.specialty) query.set("specialty", params.specialty);
    return fetchAPI(`/hcp/?${query.toString()}`);
  },
  get: (id: string) => fetchAPI(`/hcp/${id}`),
  create: (data: any) => fetchAPI("/hcp/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => fetchAPI(`/hcp/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI(`/hcp/${id}`, { method: "DELETE" }),
};

// Interaction APIs
export const interactionApi = {
  list: (params?: { skip?: number; limit?: number; user_id?: string; hcp_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.skip) query.set("skip", String(params.skip));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.user_id) query.set("user_id", params.user_id);
    if (params?.hcp_id) query.set("hcp_id", params.hcp_id);
    return fetchAPI(`/interaction/?${query.toString()}`);
  },
  get: (id: string) => fetchAPI(`/interaction/${id}`),
  create: (userId: string, data: any) =>
    fetchAPI("/interaction/", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "x-user-id": userId },
    }),
  update: (id: string, userId: string, data: any) =>
    fetchAPI(`/interaction/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "x-user-id": userId },
    }),
  delete: (id: string) => fetchAPI(`/interaction/${id}`, { method: "DELETE" }),
  recent: (userId: string, limit?: number) => {
    const query = new URLSearchParams();
    if (limit) query.set("limit", String(limit));
    return fetchAPI(`/interaction/recent?${query.toString()}`, {
      headers: { "x-user-id": userId },
    });
  },
};

// AI Chat API
export const aiApi = {
  chat: (message: string, userId: string, history?: { role: string; content: string }[]) =>
    fetchAPI("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, user_id: userId, history }),
    }),
};

// Seed API
export const seedApi = {
  seed: () => fetchAPI("/seed"),
};
