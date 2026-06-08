import type { Case } from "../types/case";

/**
 * 데이터 수집 실행. 진행 상황을 log 콜백으로 전달하고 cases 배열을 반환한다.
 * @param log 진행 메시지 콜백 (기본: stdout)
 */
export declare function collectData(
  log?: (line: string) => void
): Promise<Case[]>;
