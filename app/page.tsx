import { readFileSync } from "fs";
import { join } from "path";
import type { Case } from "@/types/case";
import { CaseExplorer } from "@/components/CaseExplorer";

// 요청마다 파일을 새로 읽어 collect 후 router.refresh()로 즉시 반영
export const dynamic = "force-dynamic";

export default function HomePage() {
  let allCases: Case[] = [];
  try {
    const raw = readFileSync(join(process.cwd(), "data", "cases.json"), "utf-8");
    allCases = JSON.parse(raw) as Case[];
  } catch {
    allCases = [];
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  return <CaseExplorer cases={allCases} todayStr={todayStr} />;
}
