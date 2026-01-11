export type SessionOut = {
  id: string;
  title: string;
  topics: string | null;
  created_at: string;
  question_count: number;
};

export type SessionCreate = {
  title: string;
  topics?: string | null;
};

export type QuestionOut = {
  id: string;
  session_id: string;
  text: string;
  asked_at: string;
  order_index: number;
};

export type QuestionCreate = {
  text: string;
};

export type ResourceOut = {
  id: string;
  session_id: string;
  filename: string;
  mime_type: string | null;
  status: string; // UPLOADED | EXTRACTED | FAILED
  created_at: string;
  extracted_at: string | null;
  error: string | null;
};

export type ChunkHitOut = {
  chunk_id: string;
  resource_id: string;
  filename: string;
  page_ref: string | null;
  text: string;
  rank: number;
};

export type AnswerOut = {
  id: string;
  session_id: string;
  question_id: string;
  answer_md: string;
  sources_json: string;
  created_at: string;
};

export type AnswerListOut = AnswerOut[];
