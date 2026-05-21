"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { diffWords } from "diff";
import type { Change } from "diff";
import type { Case, CorrectionType, OriginalCandidate } from "@/types/case";

// ── 상수 ──────────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  고침: "bg-blue-100 text-blue-700",
  바로잡습니다: "bg-blue-100 text-blue-700",
  정정보도: "bg-red-100 text-red-700",
  반론보도: "bg-amber-100 text-amber-700",
  추후보도: "bg-green-100 text-green-700",
  알립니다: "bg-purple-100 text-purple-700",
};

const FILTER_ORDER: Array<CorrectionType | "전체"> = [
  "전체", "반론보도", "정정보도", "추후보도", "바로잡습니다", "고침", "알립니다",
];

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "높음", medium: "보통", low: "낮음",
};
const CONFIDENCE_STYLE: Record<string, string> = {
  high: "text-green-700 bg-green-50",
  medium: "text-amber-600 bg-amber-50",
  low: "text-gray-500 bg-gray-50",
};

// ── 보조 컴포넌트 ─────────────────────────────────────────────────────────────

function DiffPanel({ parts, side }: { parts: Change[]; side: "original" | "correction" }) {
  return (
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (side === "original") {
          if (part.added) return null;
          if (part.removed)
            return <mark key={i} className="bg-red-100 text-red-800 line-through not-italic">{part.value}</mark>;
        } else {
          if (part.removed) return null;
          if (part.added)
            return <mark key={i} className="bg-green-100 text-green-800 not-italic">{part.value}</mark>;
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
}

function CandidateDiff({
  candidate,
  correctionBody,
  correctionUrl,
}: {
  candidate: OriginalCandidate;
  correctionBody: string;
  correctionUrl: string;
}) {
  const parts = useMemo(
    () => diffWords(candidate.snippet, correctionBody),
    [candidate.snippet, correctionBody]
  );
  const hasDiff = parts.some((p) => p.added || p.removed);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {/* 원본 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">원본 기사 발췌</span>
          <span className="text-xs text-gray-400">{candidate.date}</span>
        </div>
        <p className="text-sm font-medium text-gray-900 mb-2">{candidate.title}</p>
        {hasDiff
          ? <DiffPanel parts={parts} side="original" />
          : <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{candidate.snippet}</p>
        }
        <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">※ 저작권 보호를 위해 발췌문만 표시합니다.</p>
          <a href={candidate.url} target="_blank" rel="noopener noreferrer"
             className="text-xs text-blue-600 hover:underline ml-3 flex-shrink-0">원문 →</a>
        </div>
      </div>
      {/* 정정문 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-red-600">정정문</span>
          <a href={correctionUrl} target="_blank" rel="noopener noreferrer"
             className="text-xs text-blue-600 hover:underline">원문 →</a>
        </div>
        {hasDiff
          ? <DiffPanel parts={parts} side="correction" />
          : <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{correctionBody}</p>
        }
      </div>
    </div>
  );
}

function DetailPanel({ c, onBack }: { c: Case; onBack?: () => void }) {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const candidate = c.original_candidates[candidateIdx] ?? null;

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* 모바일 뒤로가기 */}
      {onBack && (
        <button onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4 md:hidden">
          ← 목록으로
        </button>
      )}

      {/* 정정문 카드 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
        <div className="flex items-start gap-3 mb-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
            TYPE_BADGE[c.correction.type] ?? "bg-gray-100 text-gray-600"
          }`}>
            {c.correction.type}
          </span>
          <span className="text-sm text-gray-500">{c.correction.publisher}</span>
          <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{c.correction.date}</span>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">{c.correction.title}</h2>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.correction.body}</p>
        <a href={c.correction.url} target="_blank" rel="noopener noreferrer"
           className="inline-block mt-3 text-xs text-blue-600 hover:underline">
          네이버 뉴스 원문 →
        </a>
      </div>

      {/* 원본 후보 */}
      {c.original_candidates.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-400">
          원본 기사 후보를 찾지 못했습니다.
        </div>
      ) : (
        <>
          {/* 후보 탭 (여러 개인 경우) */}
          {c.original_candidates.length > 1 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {c.original_candidates.map((cand, idx) => (
                <button
                  key={idx}
                  onClick={() => setCandidateIdx(idx)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    candidateIdx === idx
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  후보 {idx + 1}
                  <span className={`px-1.5 py-0.5 rounded text-xs font-normal ${
                    candidateIdx === idx ? "bg-blue-500 text-white" : CONFIDENCE_STYLE[cand.confidence]
                  }`}>
                    {CONFIDENCE_LABEL[cand.confidence]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 단일 후보 신뢰도 표시 */}
          {c.original_candidates.length === 1 && candidate && (
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${CONFIDENCE_STYLE[candidate.confidence]}`}>
                일치도 {CONFIDENCE_LABEL[candidate.confidence]}
              </span>
            </div>
          )}

          {/* 비교 패널 */}
          {candidate && (
            <CandidateDiff
              candidate={candidate}
              correctionBody={c.correction.body}
              correctionUrl={c.correction.url}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "30일", days: 30 },
  { label: "60일", days: 60 },
  { label: "90일", days: 90 },
  { label: "전체", days: 0 },
] as const;

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface Props {
  cases: Case[];
  todayStr: string;
}

type CollectState = "idle" | "running" | "done" | "error";

export function CaseExplorer({ cases, todayStr }: Props) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<CorrectionType | "전체">("전체");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [collectState, setCollectState] = useState<CollectState>("idle");
  const [collectLog, setCollectLog] = useState("");

  async function handleCollect() {
    setCollectState("running");
    setCollectLog("수집 시작...");
    try {
      const res = await fetch("/api/collect", { method: "POST" });
      if (!res.body) throw new Error("응답 없음");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const raw of chunk.split("\n")) {
          if (!raw.startsWith("data: ")) continue;
          try {
            const { line } = JSON.parse(raw.slice(6)) as { line: string };
            if (line === "__DONE__") { finished = true; setCollectState("done"); break; }
            if (line.startsWith("__ERROR__:")) { finished = true; setCollectState("error"); setCollectLog(line.slice(10).trim()); break; }
            if (line) setCollectLog(line);
          } catch { /* ignore parse errors */ }
        }
      }
      if (!finished) setCollectState("done");
    } catch (e) {
      setCollectState("error");
      setCollectLog(e instanceof Error ? e.message : "오류 발생");
    }
  }

  // 기간 필터 적용
  const periodFiltered = useMemo(() => {
    if (periodDays === 0) return cases;
    const d = new Date(todayStr);
    d.setDate(d.getDate() - periodDays);
    const cutoff = d.toISOString().slice(0, 10);
    return cases.filter((c) => c.correction.date >= cutoff);
  }, [cases, todayStr, periodDays]);

  const cutoffStr = useMemo(() => {
    if (periodDays === 0) return cases.at(-1)?.correction.date ?? "";
    const d = new Date(todayStr);
    d.setDate(d.getDate() - periodDays);
    return d.toISOString().slice(0, 10);
  }, [cases, todayStr, periodDays]);

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of periodFiltered) map[c.correction.type] = (map[c.correction.type] ?? 0) + 1;
    return map;
  }, [periodFiltered]);

  const filtered = useMemo(
    () => activeFilter === "전체" ? periodFiltered : periodFiltered.filter((c) => c.correction.type === activeFilter),
    [periodFiltered, activeFilter]
  );

  const selected = useMemo(() => cases.find((c) => c.id === selectedId) ?? null, [cases, selectedId]);

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  function handleFilterChange(f: CorrectionType | "전체") {
    setActiveFilter(f);
    setSelectedId(null);
  }

  function handlePeriodChange(days: number) {
    setPeriodDays(days);
    setActiveFilter("전체");
    setSelectedId(null);
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-900">네이버 뉴스 정정·고침 비교기</h1>
          <p className="text-xs text-gray-400">정정문과 원본 기사를 나란히 비교합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">
            {cutoffStr} ~ {todayStr}
          </span>
          <button
            onClick={handleCollect}
            disabled={collectState === "running"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {collectState === "running" ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                수집 중…
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 4v5h5M20 20v-5h-5M4.07 15a8 8 0 1014-7.93" strokeLinecap="round"/>
                </svg>
                수집하기
              </>
            )}
          </button>
        </div>
      </header>

      {/* 필터 바 */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto">
        {/* 유형 필터 */}
        {FILTER_ORDER.filter((t) => t === "전체" || typeCounts[t]).map((t) => {
          const active = activeFilter === t;
          const count = t === "전체" ? periodFiltered.length : (typeCounts[t] ?? 0);
          return (
            <button
              key={t}
              onClick={() => handleFilterChange(t as CorrectionType | "전체")}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t}
              <span className={`text-xs ${active ? "opacity-70" : "opacity-60"}`}>{count}</span>
            </button>
          );
        })}

        {/* 구분선 */}
        <div className="flex-shrink-0 w-px h-4 bg-gray-200 mx-1" />

        {/* 기간 선택 */}
        <div className="flex-shrink-0 flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5">
          {PERIOD_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => handlePeriodChange(days)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                periodDays === days
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 본문: 좌우 패널 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 목록 (모바일에서 선택 시 숨김) */}
        <div className={`
          flex-shrink-0 w-full md:w-72 xl:w-80 overflow-y-auto border-r border-gray-200 bg-white
          ${selected ? "hidden md:block" : "block"}
        `}>
          <div className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">해당 유형의 사례가 없습니다.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                    c.id === selectedId
                      ? "bg-blue-50 border-blue-500"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      TYPE_BADGE[c.correction.type] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {c.correction.type}
                    </span>
                    <span className="text-xs text-gray-400">{c.correction.publisher}</span>
                    <span className="text-xs text-gray-300 ml-auto">{c.correction.date.slice(5)}</span>
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2 leading-snug">{c.correction.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    원본 후보 {c.original_candidates.length}개
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 우측: 상세 패널 */}
        <div className={`
          flex-1 overflow-y-auto
          ${!selected ? "hidden md:flex md:items-center md:justify-center" : "block"}
        `}>
          {selected ? (
            <DetailPanel c={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <p className="text-sm text-gray-400">목록에서 사례를 선택하세요</p>
          )}
        </div>
      </div>

      {/* 수집 진행 배너 */}
      {collectState !== "idle" && (
        <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-t text-sm ${
          collectState === "error"   ? "bg-red-50 border-red-200 text-red-700" :
          collectState === "done"    ? "bg-green-50 border-green-200 text-green-700" :
          "bg-gray-50 border-gray-200 text-gray-600"
        }`}>
          {collectState === "running" && (
            <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          {collectState === "done"  && <span className="flex-shrink-0">✓</span>}
          {collectState === "error" && <span className="flex-shrink-0">✕</span>}
          <span className="flex-1 truncate text-xs font-mono">{collectLog}</span>
          {collectState === "done" && (
            <button
              onClick={() => { router.refresh(); setCollectState("idle"); }}
              className="flex-shrink-0 px-2.5 py-1 rounded bg-green-700 text-white text-xs hover:bg-green-800 transition-colors"
            >
              새로고침
            </button>
          )}
          <button
            onClick={() => setCollectState("idle")}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
