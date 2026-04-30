import { proxyResumeLibrary } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return proxyResumeLibrary(`/api/v1/resumes${url.search}`);
}

export async function POST(request: Request) {
  return proxyResumeLibrary("/api/v1/resumes", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
