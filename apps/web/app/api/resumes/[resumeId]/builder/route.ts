import { proxyResumeLibrary } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    resumeId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder`);
}

export async function PUT(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder`, {
    method: "PUT",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder/finalize`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
