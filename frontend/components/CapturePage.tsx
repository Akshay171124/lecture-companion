"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { QuestionOut, ResourceOut } from "../lib/types";

function Badge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let bg = "#eee";
  let fg = "#111";
  if (s === "EXTRACTED") {
    bg = "#e8fff0";
    fg = "#0a6b2b";
  } else if (s === "FAILED") {
    bg = "#ffecec";
    fg = "#b00020";
  } else if (s === "UPLOADED") {
    bg = "#eef5ff";
    fg = "#1849a9";
  }
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 650,
        display: "inline-block",
      }}
    >
      {s}
    </span>
  );
}

export default function CapturePage({ sessionId }: { sessionId: string }) {
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [resources, setResources] = useState<ResourceOut[]>([]);
  const [text, setText] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [loadingQ, setLoadingQ] = useState(true);
  const [loadingR, setLoadingR] = useState(true);

  const [uploading, setUploading] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  async function refreshQuestions() {
    setErr(null);
    setLoadingQ(true);
    try {
      const data = await api.listQuestions(sessionId);
      setQuestions(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load questions");
    } finally {
      setLoadingQ(false);
    }
  }

  async function refreshResources() {
    setErr(null);
    setLoadingR(true);
    try {
      const data = await api.listResources(sessionId);
      setResources(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load resources");
    } finally {
      setLoadingR(false);
    }
  }

  async function refreshAll() {
    await Promise.all([refreshQuestions(), refreshResources()]);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [questions.length]);

  async function submitQuestion() {
    const v = text.trim();
    if (!v) return;

    setErr(null);

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
      setQuestions((prev) => prev.map((q) => (q.id === optimistic.id ? created : q)));
    } catch (e: any) {
      setQuestions((prev) => prev.filter((q) => q.id !== optimistic.id));
      setErr(e?.message || "Failed to create question");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitQuestion();
    }
  }

  async function onUploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setErr(null);
    setUploading(true);

    try {
      const created = await api.uploadResources(sessionId, files);
      // prepend newly created resources
      setResources((prev) => [...created, ...prev]);
      // refresh to ensure ordering/status is accurate
      await refreshResources();
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <a href="/" style={{ textDecoration: "none", color: "#111" }}>
          ← Back
        </a>
        <div style={{ opacity: 0.7, fontSize: 13 }}>Session: {sessionId}</div>
      </header>

      <h1 style={{ fontSize: 22, fontWeight: 750, marginTop: 12 }}>Capture Mode</h1>

      {err ? (
        <p style={{ color: "crimson", marginTop: 10, whiteSpace: "pre-wrap" }}>{err}</p>
      ) : null}

      {/* Upload section */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Lecture materials</h2>
          <span style={{ opacity: 0.7, fontSize: 12 }}>
            PDF / PPTX • Extraction happens immediately
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: uploading ? "#999" : "#111",
              color: "white",
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading…" : "Upload files"}
            <input
              type="file"
              multiple
              accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={(e) => onUploadFiles(e.target.files)}
            />
          </label>

          <button
            onClick={refreshResources}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
            }}
          >
            Refresh materials
          </button>

          <span style={{ opacity: 0.7, fontSize: 12 }}>
            {loadingR ? "Loading…" : `${resources.length} file(s)`}
          </span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {resources.length === 0 && !loadingR ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              No files uploaded yet. Upload a PDF or PPTX so answers can be grounded in your slides.
            </div>
          ) : null}

          {resources.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                background: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{r.filename}</div>
                <Badge status={r.status} />
              </div>

              <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                Uploaded: {new Date(r.created_at).toLocaleString()}
                {r.extracted_at ? ` • Processed: ${new Date(r.extracted_at).toLocaleString()}` : ""}
              </div>

              {r.status === "FAILED" && r.error ? (
                <div style={{ marginTop: 8, color: "#b00020", fontSize: 13, whiteSpace: "pre-wrap" }}>
                  {r.error}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Question capture section */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Questions</h2>

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
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
            onClick={submitQuestion}
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
            onClick={refreshQuestions}
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

        <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
          {loadingQ ? "Loading…" : `${questions.length} question(s)`}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                border: "1px solid #eee",
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
