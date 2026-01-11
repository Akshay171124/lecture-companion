"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { QuestionOut, ResourceOut, ChunkHitOut, AnswerOut } from "../lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


function toSearchQuery(s: string) {
  const stop = new Set([
    "the","a","an","and","or","but","so","to","of","in","on","for","with","as","at","by",
    "is","are","was","were","be","been","being","do","does","did",
    "why","what","how","when","where","which","who",
    "this","that","these","those","it","we","you","i","they",
    "can","could","should","would","may","might"
  ]);

  const tokens = s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 3 && !stop.has(t));

  const uniq: string[] = [];
  for (const t of tokens) {
    if (!uniq.includes(t)) uniq.push(t);
    if (uniq.length >= 8) break;
  }

  return uniq.length ? uniq.join(" ") : s.trim();
}

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

type SourceItem = {
  chunk_id?: string;
  filename?: string;
  page_ref?: string | null;
  rank?: number;
};

function safeParseSources(sourcesJson: string): SourceItem[] {
  try {
    const v = JSON.parse(sourcesJson);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
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

  // Context search (Phase 1.2)
  const [contextFor, setContextFor] = useState<string | null>(null);
  const [contextHits, setContextHits] = useState<ChunkHitOut[]>([]);
  const [loadingCtx, setLoadingCtx] = useState(false);

  // Phase 1.3 answers
  const [answers, setAnswers] = useState<Record<string, AnswerOut>>({});
  const [explainingId, setExplainingId] = useState<string | null>(null);

  // Explain all
  const [explainingAll, setExplainingAll] = useState(false);

  const hasExtracted = resources.some((r) => r.status === "EXTRACTED");
  const hasQuestions = questions.some((q) => !q.id.startsWith("temp-"));

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
    await Promise.all([refreshQuestions(), refreshResources(), refreshAnswers()]);
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
      setResources((prev) => [...created, ...prev]);
      await refreshResources();

      // Auto-chunk (best-effort)
      try {
        await api.chunkAll(sessionId);
        await refreshResources();
      } catch (e) {
        console.warn("Auto-chunk failed:", e);
      }
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function findContext(questionId: string, query: string) {
    const q = query.trim();
    if (!q) return;

    setErr(null);
    setContextFor(questionId);
    setLoadingCtx(true);
    setContextHits([]);

    try {
      const hits = await api.searchChunks(sessionId, q, 6);
      setContextHits(hits);
    } catch (e: any) {
      setErr(e?.message || "Failed to retrieve context");
    } finally {
      setLoadingCtx(false);
    }
  }

  async function explain(questionId: string) {
    // ignore temp questions (not persisted yet)
    if (questionId.startsWith("temp-")) {
      setErr("Please wait until the question is saved before explaining.");
      return;
    }

    setErr(null);
    setExplainingId(questionId);

    try {
      const a = await api.explainQuestion(questionId);
      setAnswers((prev) => ({ ...prev, [questionId]: a }));
    } catch (e: any) {
      setErr(e?.message || "Explain failed");
    } finally {
      setExplainingId(null);
    }
  }

  async function explainAll() {
    if (!hasExtracted) {
      setErr("Upload slides first (and wait for extraction/chunking) before using Explain all.");
      return;
    }
    if (!hasQuestions) {
      setErr("Add at least one saved question before using Explain all.");
      return;
    }

    setErr(null);
    setExplainingAll(true);

    try {
      const res = await api.explainAll(sessionId);

      // merge returned answers into existing state
      const map: Record<string, AnswerOut> = {};
      for (const a of res.answers) map[a.question_id] = a;

      setAnswers((prev) => ({ ...prev, ...map }));
      if (res.count === 0) {
        setErr("No unanswered questions left (answers already exist).");
      }
    } catch (e: any) {
      setErr(e?.message || "Explain All failed");
    } finally {
      setExplainingAll(false);
    }
  }

  async function refreshAnswers() {
    try {
      const data = await api.listAnswers(sessionId);
      const map: Record<string, AnswerOut> = {};
      for (const a of data) map[a.question_id] = a;
      setAnswers(map);
    } catch (e) {
      // optional: ignore silently
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

      {err ? <p style={{ color: "crimson", marginTop: 10, whiteSpace: "pre-wrap" }}>{err}</p> : null}

      {/* Upload section */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Lecture materials</h2>
          <span style={{ opacity: 0.7, fontSize: 12 }}>PDF / PPTX • Extraction happens immediately</span>
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

          <span style={{ opacity: 0.7, fontSize: 12 }}>{loadingR ? "Loading…" : `${resources.length} file(s)`}</span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {resources.length === 0 && !loadingR ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              No files uploaded yet. Upload a PDF or PPTX so answers can be grounded in your slides.
            </div>
          ) : null}

          {resources.map((r) => (
            <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{r.filename}</div>
                <Badge status={r.status} />
              </div>

              <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                Uploaded: {new Date(r.created_at).toLocaleString()}
                {r.extracted_at ? ` • Processed: ${new Date(r.extracted_at).toLocaleString()}` : ""}
              </div>

              {r.status === "FAILED" && r.error ? (
                <div style={{ marginTop: 8, color: "#b00020", fontSize: 13, whiteSpace: "pre-wrap" }}>{r.error}</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Question capture section */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Questions</h2>

        {/* ✅ Explain All row (polish) */}
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={explainAll}
            disabled={explainingAll || !hasExtracted || !hasQuestions}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: explainingAll ? "#999" : "#111",
              color: "white",
              cursor: explainingAll ? "not-allowed" : "pointer",
              fontWeight: 650,
              opacity: !hasExtracted || !hasQuestions ? 0.6 : 1,
            }}
            title={!hasExtracted ? "Upload and extract slides first" : !hasQuestions ? "Add a question first" : ""}
          >
            {explainingAll ? "Explaining all…" : "Explain all"}
          </button>

          <span style={{ opacity: 0.7, fontSize: 12 }}>
            Explains only unanswered questions • requires extracted slides
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a question and press Enter…"
            style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
          />
          <button
            onClick={submitQuestion}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer" }}
          >
            Add
          </button>
          <button
            onClick={refreshQuestions}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #ccc", background: "white", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>{loadingQ ? "Loading…" : `${questions.length} question(s)`}</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {questions.map((q) => {
            const answer = answers[q.id];
            const sources = answer?.sources_json ? safeParseSources(answer.sources_json) : [];

            return (
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
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{new Date(q.asked_at).toLocaleTimeString()}</div>
                </div>

                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{q.text}</div>

                {/* Buttons row */}
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => findContext(q.id, toSearchQuery(q.text))}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ccc",
                      background: "white",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Find context
                  </button>

                  <button
                    onClick={() => explain(q.id)}
                    disabled={explainingId === q.id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #111",
                      background: explainingId === q.id ? "#999" : "#111",
                      color: "white",
                      cursor: explainingId === q.id ? "not-allowed" : "pointer",
                      fontSize: 13,
                    }}
                  >
                    {explainingId === q.id ? "Explaining…" : "Explain"}
                  </button>

                  {contextFor === q.id ? (
                    <span style={{ opacity: 0.7, fontSize: 12 }}>
                      {loadingCtx ? "Searching slides…" : `${contextHits.length} hit(s)`}
                    </span>
                  ) : null}
                </div>

                {/* Context results */}
                {contextFor === q.id ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {loadingCtx ? (
                      <div style={{ opacity: 0.7, fontSize: 13 }}>Searching…</div>
                    ) : contextHits.length === 0 ? (
                      <div style={{ opacity: 0.7, fontSize: 13 }}>No relevant chunks found yet.</div>
                    ) : (
                      contextHits.map((h) => (
                        <div
                          key={h.chunk_id}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 12,
                            padding: 12,
                            background: "#fafafa",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ fontWeight: 650 }}>
                              {h.filename} {h.page_ref ? `• ${h.page_ref}` : ""}
                            </div>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>
                              rank {Number.isFinite(h.rank) ? h.rank.toFixed(3) : h.rank}
                            </div>
                          </div>

                          <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.35 }}>
                            {h.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}

                {/* Answer rendering */}
                {answer?.answer_md ? (
                  <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
                    <div style={{ fontWeight: 750, marginBottom: 6 }}>Answer</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {answer.answer_md}
                      </ReactMarkdown>
                    </div>

                    {sources.length > 0 ? (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Sources</div>
                        <ul style={{ marginTop: 6, paddingLeft: 18, opacity: 0.9, fontSize: 13 }}>
                          {sources.slice(0, 6).map((s, idx) => (
                            <li key={idx}>
                              {s.filename || "resource"}
                              {s.page_ref ? ` • ${s.page_ref}` : ""}
                              {typeof s.rank === "number" ? ` (rank ${s.rank.toFixed(3)})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </section>
    </main>
  );
}
