import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_ORIGIN = process.env.CLOUDDOC_BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

export async function GET() {
  const cookieStore = await cookies();
  const upstream = await fetch(`${BACKEND_ORIGIN}/api/events/stream`, {
    cache: "no-store",
    headers: {
      accept: "text/event-stream",
      cookie: cookieStore.toString(),
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
