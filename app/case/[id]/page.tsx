import casesData from "@/data/cases.json";
import type { Case } from "@/types/case";
import Link from "next/link";
import { notFound } from "next/navigation";

const cases = casesData as Case[];

const confidenceLabel: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};
const confidenceColor: Record<string, string> = {
  high: "text-green-700 bg-green-50",
  medium: "text-amber-700 bg-amber-50",
  low: "text-gray-500 bg-gray-100",
};

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = cases.find((x) => x.id === id);
  if (!c) notFound();

  const clue = c.original_clue;
  const clueIndex = clue ? c.correction.body.indexOf(clue) : -1;
  const bodyBefore =
    clueIndex >= 0 ? c.correction.body.slice(0, clueIndex) : c.correction.body;
  const bodyAfter =
    clueIndex >= 0 ? c.correction.body.slice(clueIndex + clue.length) : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← 목록
          </Link>
          <span className="text-gray-200">|</span>
          <span className="text-sm text-gray-500">
            {c.correction.publisher} · {c.correction.date}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 정정문 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
              {c.correction.type}
            </span>
          </div>
          <h1 className="text-base font-bold text-gray-900 mb-3">
            {c.correction.title}
          </h1>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {clueIndex >= 0 ? (
              <>
                {bodyBefore}
                <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic">
                  {clue}
                </mark>
                {bodyAfter}
              </>
            ) : (
              c.correction.body
            )}
          </div>
          <a
            href={c.correction.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-blue-600 hover:underline"
          >
            네이버 뉴스 원문 →
          </a>
        </section>

        {/* 원본 후보 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            원본 기사 후보 {c.original_candidates.length}개
          </h2>
          {c.original_candidates.length === 0 ? (
            <div className="bg-white rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-400 text-center">
              원본 기사를 특정하지 못했습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {c.original_candidates.map((cand, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {cand.title}
                    </p>
                    <span
                      className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                        confidenceColor[cand.confidence]
                      }`}
                    >
                      일치도 {confidenceLabel[cand.confidence]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{cand.date}</p>
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">
                    {cand.snippet}
                  </p>
                  <div className="flex items-center gap-3">
                    <a
                      href={cand.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      원문 보기 →
                    </a>
                    <Link
                      href={`/case/${c.id}/compare?candidate=${i}`}
                      className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-full transition-colors"
                    >
                      이 기사와 비교
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
