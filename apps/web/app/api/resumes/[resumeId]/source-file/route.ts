import { proxyResumeLibrary } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    resumeId: string;
  }>;
};

function buildSourceFilePath(request: Request, resumeId: string) {
  const url = new URL(request.url);
  const disposition = url.searchParams.get("disposition");
  const search = disposition
    ? `?disposition=${encodeURIComponent(disposition)}`
    : "";

  return `/api/v1/resumes/${resumeId}/source-file${search}`;
}

export async function GET(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(buildSourceFilePath(request, resumeId), {
    headers: request.headers,
  });
}

export async function HEAD(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(buildSourceFilePath(request, resumeId), {
    headers: request.headers,
    method: "HEAD",
  });
}
