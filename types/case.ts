export type CorrectionType =
  | "고침"
  | "바로잡습니다"
  | "정정보도"
  | "반론보도"
  | "추후보도"
  | "알립니다";

export type Confidence = "high" | "medium" | "low";

export interface Correction {
  publisher: string;
  type: CorrectionType;
  date: string; // YYYY-MM-DD
  url: string;
  title: string;
  body: string;
}

export interface OriginalCandidate {
  url: string;
  title: string;
  date: string; // YYYY-MM-DD
  snippet: string;
  confidence: Confidence;
}

export interface Case {
  id: string; // e.g. "2026-05-12-chosun-001"
  correction: Correction;
  original_candidates: OriginalCandidate[]; // 0~5개, 0개도 정상
  original_clue: string; // 본문 속 "본보 ○월 ○일자 …" 등 단서
}
