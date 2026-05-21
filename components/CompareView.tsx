"use client";

import { useState } from "react";
import type { Change } from "diff";

interface Props {
  original: { title: string; date: string; url: string; text: string };
  correction: { title: string; body: string; url: string };
  diffParts: Change[];
}

function DiffText({
  parts,
  side,
}: {
  parts: Change[];
  side: "original" | "correction";
}) {
  return (
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (side === "original") {
          if (part.added) return null;
          if (part.removed)
            return (
              <mark
                key={i}
                className="bg-red-100 text-red-800 line-through not-italic"
              >
                {part.value}
              </mark>
            );
        } else {
          if (part.removed) return null;
          if (part.added)
            return (
              <mark key={i} className="bg-green-100 text-green-800 not-italic">
                {part.value}
              </mark>
            );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
}

export default function CompareView({ original, correction, diffParts }: Props) {
  const [tab, setTab] = useState<"original" | "correction">("original");
  const hasDiff = diffParts.some((p) => p.added || p.removed);

  return (
    <div>
      {/* 모바일 탭 */}
      <div className="flex sm:hidden border-b border-gray-200 mb-4">
        {(["original", "correction"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "original" ? "원본 기사" : "정정문"}
          </button>
        ))}
      </div>

      {/* 데스크톱 2단 / 모바일 단일 패널 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 원본 */}
        <div className={tab === "correction" ? "hidden sm:block" : ""}>
          <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                원본 기사
              </span>
              <span className="text-xs text-gray-400">{original.date}</span>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-3">
              {original.title}
            </p>
            {hasDiff ? (
              <DiffText parts={diffParts} side="original" />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {original.text}
              </p>
            )}
            <div className="mt-auto pt-3 space-y-1">
              <a
                href={original.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline"
              >
                원문 전체 보기 →
              </a>
              <p className="text-xs text-gray-400">
                ※ 저작권 보호를 위해 발췌문만 표시합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 정정문 */}
        <div className={tab === "original" ? "hidden sm:block" : ""}>
          <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                정정문
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-3">
              {correction.title}
            </p>
            {hasDiff ? (
              <DiffText parts={diffParts} side="correction" />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {correction.body}
              </p>
            )}
            <div className="mt-auto pt-3">
              <a
                href={correction.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline"
              >
                원문 보기 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
