"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { QuestionOut } from "../lib/types";

export default function CapturePage({ sessionId }: { sessionId: string }) {
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const data = await api.listQuestions(sessionId);
      setQuestions(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [questions.length]);

  async function submit() {
    const v = text.trim();
    if (!v) return;

    setErr(null);

    // Optimistic UI (temporary item)
    const optimistic: QuestionOut = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      text: v,
      asked_at: new Date().toISOString(),
      order_index: (questions.at(-1)?.order_index || 0) + 1,
    };
    setQuestions((prev) => [...prev, optimistic]);
    setText("");

    try {
      const created = await api.createQuestion(sessionId, { text: v });
      // Replace optimistic with real
      setQuestions((prev) =>
        prev.map((q) => (q.id === optimistic.id ? created : q))
      );
    } catch (e: any) {
      // Remove optimistic on failure
      setQuestions((prev) => prev.filter((q) => q.id !== optimistic.id));
      setErr(e?.message || "Failed to create question");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <a href="/" style={{ textDecoration: "none", color: "#111" }}>
          ← Back
        </a>
        <div style={{ opacity: 0.7, fontSize: 13 }}>Session: {sessionId}</div>
      </header>

      <h1 style={{ fontSize: 22, fontWeight: 750, marginTop: 12 }}>
        Capture Mode
      </h1>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a question and press Enter…"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={submit}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          Add
        </button>
        <button
          onClick={refresh}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {err ? <p style={{ color: "crimson", marginTop: 10 }}>{err}</p> : null}

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 650 }}>
          Questions {loading ? "(loading…)" : `(${questions.length})`}
        </h2>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 12,
                background: q.id.startsWith("temp-") ? "#fffdf2" : "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 650 }}>#{q.order_index}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {new Date(q.asked_at).toLocaleTimeString()}
                </div>
              </div>
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{q.text}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </section>
    </main>
  );
}
