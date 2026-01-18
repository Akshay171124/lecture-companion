# Lecture Companion 📚🤖

**Lecture Companion** is a **local-first AI assistant** that helps students **capture**, **organize**, and **understand** lecture content.  
Students upload lecture slides, ask questions during or after class, and receive **grounded, explainable answers** powered by **Retrieval-Augmented Generation (RAG)**.

---

## ✨ Features

### 1. Session-based Lecture Capture
- Create lecture sessions with a title and topics
- All questions and materials are scoped to a session

### 2. Slide Upload & Extraction
- Upload PDF / PPTX lecture slides
- Automatic text extraction
- Extraction status tracking:
  - `UPLOADED`
  - `EXTRACTED`
  - `FAILED`

### 3. Chunking & Retrieval
- Slides are split into manageable text chunks
- Chunks are stored **per session** and **per resource**
- Chunking is **explicit** (run once after extraction)

### 4. Hybrid Search (FTS + Semantic)
- **Full-text search (Postgres FTS)** for exact keyword matches
- **Semantic search (pgvector embeddings)** for meaning-based retrieval
- Hybrid retrieval combines both for improved recall and precision

### 5. Question Capture
- Add questions during or after a lecture
- Questions are ordered and persisted

### 6. Explain (RAG)
- Generate answers using:
  - Retrieved slide chunks
  - Local LLM via **Ollama**
- Answers include:
  - Markdown-formatted explanations
  - Explicit sources (slide + page / slide reference)

### 7. Explain All
- Batch-generate answers for unanswered questions
- Idempotent and safe to re-run

### 8. Answer Persistence
- Answers are stored in the database
- Automatically restored on page reload
- Supports regeneration (overwrite)

---

## 🏗️ Architecture

```
Frontend (Next.js + React)
        |
        | REST API
        v
Backend (FastAPI)
        |
        | SQLAlchemy
        v
PostgreSQL
```

### Core Tables
- `sessions`
- `questions`
- `resources`
- `resource_chunks` (FTS + embeddings)
- `answers`

---

## 🧠 Retrieval Strategy

1. Slides → extracted text  
2. Extracted text → chunks  
3. Each chunk → embedding (stored once)  
4. Query → embedding  
5. Hybrid retrieval:
   - Full-text search ranking
   - Semantic similarity  
6. Top chunks → RAG prompt → LLM answer  

> ⚠️ Chunking is **not implicit** — it must be explicitly triggered once after extraction.

---

## 🛠️ Tech Stack

### Frontend
- Next.js (App Router)
- React + TypeScript
- Fetch API
- Markdown rendering (`react-markdown`)

### Backend
- FastAPI
- SQLAlchemy
- Alembic (database migrations)

### Database
- PostgreSQL
- pgvector
- Full-text search (GIN + `tsvector`)

### AI / ML
- Ollama (local)
- Embeddings + generation
- Retrieval-Augmented Generation (RAG)
- **No external API calls required**

---

## 🚀 Local Development

### Prerequisites
- Docker & Docker Compose
- Ollama installed and running
- PostgreSQL with `pgvector` enabled

### Start Services
```bash
docker compose up --build
```

### Run Migrations
```bash
docker compose exec backend alembic upgrade head
```

### Chunk All Extracted Resources
```bash
curl -X POST http://localhost:8000/api/sessions/{session_id}/chunk-all
```

---

## 📌 API Highlights

- `POST /api/sessions`
- `POST /api/sessions/{id}/resources`
- `POST /api/sessions/{id}/chunk-all`
- `GET /api/sessions/{id}/chunks/search`
- `POST /api/questions/{id}/explain`
- `POST /api/sessions/{id}/explain-all`

---

## 🔮 Roadmap

- Hybrid score tuning
- Re-explain / regenerate UI
- Confidence scoring
- Multi-resource attribution
- Study mode / summaries
- Authentication (optional)

---

**Lecture Companion** is designed to be **local-first, explainable, and extensible** — giving students clarity without sacrificing privacy or control.