import casesData from "@/data/cases.json";
import type { Case } from "@/types/case";
import { notFound } from "next/navigation";
import Link from "next/link";
import { diffWords } from "diff";
import CompareView from "@/components/CompareView";

const cases = casesData as Case[];

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { candidate: candidateParam } = await searchParams;

  const c = cases.find((x) => x.id === id);
  if (!c) notFound();

  const candidateIndex =
    candidateParam !== undefined ? parseInt(String(candidateParam), 10) : 0;
  const candidate = c.original_candidates[candidateIndex];
  if (!candidate) notFound();

  const diffParts = diffWords(candidate.snippet, c.correction.body);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
          <Link
            href={`/case/${id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← 사례 상세
          </Link>
          <span className="text-gray-200">|</span>
          <span className="text-sm text-gray-500">
            {c.correction.publisher} · {c.correction.type}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-base font-bold text-gray-900 mb-1">
          {c.correction.title}
        </h1>
        <p className="text-xs text-gray-400 mb-5">
          비교 대상: {candidate.title} ({candidate.date})
        </p>

        <CompareView
          original={{
            title: candidate.title,
            date: candidate.date,
            url: candidate.url,
            text: candidate.snippet,
          }}
          correction={{
            title: c.correction.title,
            body: c.correction.body,
            url: c.correction.url,
          }}
          diffParts={diffParts}
        />
      </main>
    </div>
  );
}
