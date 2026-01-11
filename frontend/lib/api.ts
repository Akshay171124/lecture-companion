import type { ResourceOut } from "./types";
import type {
  SessionCreate,
  SessionOut,
  QuestionCreate,
  QuestionOut,
  ChunkHitOut,
  AnswerOut,
  AnswerListOut,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

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

  createQuestion: (sessionId: string, payload: QuestionCreate) =>
    http<QuestionOut>(`/api/sessions/${sessionId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listResources: (sessionId: string) =>
    http<ResourceOut[]>(`/api/sessions/${sessionId}/resources`),

  uploadResources: async (
    sessionId: string,
    files: File[]
  ): Promise<ResourceOut[]> => {
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
    http<ChunkHitOut[]>(
      `/api/sessions/${sessionId}/chunks/search?q=${encodeURIComponent(
        query
      )}&limit=${limit}`
    ),

  chunkAll: (sessionId: string) =>
    http<{
      processed_resources: number;
      skipped_resources: number;
      chunks_created: number;
    }>(`/api/sessions/${sessionId}/chunk-all`, { method: "POST" }),

  // ✅ Answer persistence
  listAnswers: (sessionId: string) =>
    http<AnswerListOut>(`/api/sessions/${sessionId}/answers`),

  // ✅ Explain + Regenerate (force)
  explainQuestion: (questionId: string, force = false) =>
    http<AnswerOut>(
      `/api/questions/${questionId}/explain${force ? "?force=1" : ""}`,
      { method: "POST" }
    ),

  regenerateQuestion: (questionId: string) =>
    api.explainQuestion(questionId, true),

  // ✅ Explain all (+ optional regenerate all)
  explainAll: (sessionId: string, force = false) =>
    http<{ count: number; answers: AnswerOut[] }>(
      `/api/sessions/${sessionId}/explain-all${force ? "?force=1" : ""}`,
      { method: "POST" }
    ),
};
