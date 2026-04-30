import { proxyResumeLibrary } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    resumeId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/source-file`, {
    headers: request.headers,
  });
}

export async function HEAD(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/source-file`, {
    headers: request.headers,
    method: "HEAD",
  });
}
