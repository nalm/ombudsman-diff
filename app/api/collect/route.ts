import { collectData } from "../../../scripts/collect.mjs";
import { writeFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Pro; Hobby는 10s에서 timeout됨

export async function POST() {
  const encoder = new TextEncoder();

  // collectData를 직접 호출해 subprocess 없이 수집
  // → webpack이 cheerio 등 의존성을 번들에 포함하므로 Vercel에서도 동작
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: string) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ line })}\n\n`)
        );

      try {
        const cases = await collectData(send);

        // 로컬 환경: data/cases.json 갱신 (서버 사이드 초기 데이터 업데이트)
        if (!process.env.VERCEL) {
          await writeFile(
            join(process.cwd(), "data", "cases.json"),
            JSON.stringify(cases, null, 2),
            "utf-8"
          );
        }

        send(`__CASES__:${JSON.stringify(cases)}`);
        send("__DONE__");
      } catch (e) {
        send(`__ERROR__: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
