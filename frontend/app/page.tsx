export default async function Home() {
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
  
    let status = "unknown";
    try {
      const res = await fetch(`${base}/health`, { cache: "no-store" });
      status = res.ok ? "connected" : "error";
    } catch {
      status = "offline";
    }
  
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Lecture Companion (MVP)</h1>
        <p style={{ marginTop: 8 }}>
          API status: <b>{status}</b>
        </p>
        <p style={{ marginTop: 12, opacity: 0.75 }}>
          Next steps: Sessions → Capture Questions → Explain (RAG)
        </p>
      </main>
    );
  }
  