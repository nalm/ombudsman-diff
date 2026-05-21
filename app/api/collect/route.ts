import { spawn } from "child_process";

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

      const child = spawn("node", ["scripts/collect.mjs"], {
        cwd: process.cwd(),
        env: { ...process.env },
      });

      child.stdout.on("data", (buf: Buffer) => {
        for (const line of buf.toString().replace(/\r/g, "").split("\n")) {
          if (line.trim()) send(line);
        }
      });

      child.stderr.on("data", (buf: Buffer) => {
        send("[ERR] " + buf.toString().trim());
      });

      child.on("close", (code: number | null) => {
        send(code === 0 ? "__DONE__" : `__ERROR__: 종료 코드 ${code}`);
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
