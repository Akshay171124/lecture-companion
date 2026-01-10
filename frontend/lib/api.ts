import type { ResourceOut } from "./types"; // add to top import list if needed
import type { SessionCreate, SessionOut, QuestionCreate, QuestionOut, ChunkHitOut, AnswerOut } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  listSessions: () => http<SessionOut[]>("/api/sessions"),
  createSession: (payload: SessionCreate) =>
    http<SessionOut>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listQuestions: (sessionId: string) =>
    http<QuestionOut[]>(`/api/sessions/${sessionId}/questions`),

  explainQuestion: (questionId: string) =>
    http<AnswerOut>(`/api/questions/${questionId}/explain`, { method: "POST" }),

  createQuestion: (sessionId: string, payload: QuestionCreate) =>
    http<QuestionOut>(`/api/sessions/${sessionId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  
  listResources: (sessionId: string) =>
    http<ResourceOut[]>(`/api/sessions/${sessionId}/resources`),

  uploadResources: async (sessionId: string, files: File[]): Promise<ResourceOut[]> => {
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
    const form = new FormData();
    files.forEach((f) => form.append("files", f));

    const res = await fetch(`${base}/api/sessions/${sessionId}/resources`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    }

    return res.json();
  },

  searchChunks: (sessionId: string, query: string, limit = 6) =>
    http<ChunkHitOut[]>(`/api/sessions/${sessionId}/chunks/search?q=${encodeURIComponent(query)}&limit=${limit}`),
};

