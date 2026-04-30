import { proxyResumeLibrary } from "../resumes/_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyResumeLibrary("/api/v1/resume-folders");
}

export async function POST(request: Request) {
  return proxyResumeLibrary("/api/v1/resume-folders", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
