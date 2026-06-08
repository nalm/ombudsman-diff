import { spawn } from "child_process";
import { join } from "path";
import { readFile } from "fs/promises";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Pro; Hobby는 10s에서 timeout됨

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (line: string) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ line })}\n\n`)
        );

      // join()으로 런타임에 경로를 구성해 Turbopack 정적 분석 회피
      const scriptPath = join(process.cwd(), "scripts", "collect.mjs");

      // process.execPath: 현재 Node.js 바이너리의 절대 경로 — PATH 의존성 없음
      // NODE_OPTIONS 제거: Next.js dev 서버가 주입하는 --require/--loader 훅이
      //   순수 ESM 스크립트와 충돌해 exit code 1을 유발하므로 반드시 제거
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { NODE_OPTIONS: _no, ...childEnv } = process.env;
      const child = spawn(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        env: childEnv,
      });

      child.stdout.on("data", (buf: Buffer) => {
        for (const line of buf.toString().replace(/\r/g, "").split("\n")) {
          if (line.trim()) send(line);
        }
      });

      let stderrBuf = "";
      child.stderr.on("data", (buf: Buffer) => {
        const text = buf.toString().trim();
        stderrBuf += text + "\n";
        send("[ERR] " + text);
      });

      child.on("close", async (code: number | null) => {
        if (code === 0) {
          // 수집 결과를 클라이언트에 스트리밍 (Vercel 파일시스템 우회)
          try {
            const outPath = process.env.VERCEL
              ? "/tmp/cases.json"
              : join(process.cwd(), "data", "cases.json");
            const json = await readFile(outPath, "utf-8");
            send(`__CASES__:${json}`);
          } catch { /* 무시 — 클라이언트 측 데이터 반영만 실패 */ }
          send("__DONE__");
        } else {
          // stderr 내용이 있으면 실제 오류 메시지 사용, 없으면 종료 코드 표시
          const detail = stderrBuf.trim() || `종료 코드 ${code}`;
          send(`__ERROR__: ${detail}`);
        }
        controller.close();
      });

      child.on("error", (err: Error) => {
        send(`__ERROR__: ${err.message}`);
        controller.close();
      });
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
