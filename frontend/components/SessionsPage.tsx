"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { SessionOut } from "../lib/types";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState("");

  const canCreate = useMemo(() => title.trim().length > 0, [title]);

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;

    setErr(null);
    try {
      const created = await api.createSession({
        title: title.trim(),
        topics: topics.trim() ? topics : null,
      });
      setTitle("");
      setTopics("");
      setSessions((prev) => [created, ...prev]);
    } catch (e: any) {
      setErr(e?.message || "Failed to create session");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Lecture Companion</h1>
        <span style={{ opacity: 0.7 }}>Phase 1.0</span>
      </header>

      <section style={{ marginTop: 18, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 650, marginBottom: 10 }}>Create a session</h2>

        <form onSubmit={onCreate} style={{ display: "grid", gap: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title (e.g., Backprop + Chain Rule)"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
          <textarea
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="Topics / bullets (optional)"
            rows={4}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              disabled={!canCreate}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: canCreate ? "#111" : "#999",
                color: "white",
                cursor: canCreate ? "pointer" : "not-allowed",
              }}
            >
              Create
            </button>

            <button
              type="button"
              onClick={refresh}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>

            {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 650, marginBottom: 10 }}>
          Sessions {loading ? "(loading…)" : `(${sessions.length})`}
        </h2>

        {sessions.length === 0 && !loading ? (
          <p style={{ opacity: 0.7 }}>No sessions yet. Create one above.</p>
        ) : null}

        <div style={{ display: "grid", gap: 10 }}>
          {sessions.map((s) => (
            <a
              key={s.id}
              href={`/sessions/${s.id}`}
              style={{
                display: "block",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ opacity: 0.8 }}>
                  {s.question_count} question{s.question_count === 1 ? "" : "s"}
                </div>
              </div>

              {s.topics ? (
                <pre
                  style={{
                    marginTop: 10,
                    whiteSpace: "pre-wrap",
                    background: "#fafafa",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 13,
                    lineHeight: 1.35,
                  }}
                >
                  {s.topics}
                </pre>
              ) : null}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
