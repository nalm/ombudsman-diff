import casesData from "@/data/cases.json";
import type { Case } from "@/types/case";
import { CaseExplorer } from "@/components/CaseExplorer";

// 요청 시마다 today 계산
export const dynamic = "force-dynamic";

export default function HomePage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  return <CaseExplorer cases={casesData as Case[]} todayStr={todayStr} />;
}
