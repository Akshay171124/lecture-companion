import type { SessionCreate, SessionOut, QuestionCreate, QuestionOut } from "./types";

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

  createQuestion: (sessionId: string, payload: QuestionCreate) =>
    http<QuestionOut>(`/api/sessions/${sessionId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
