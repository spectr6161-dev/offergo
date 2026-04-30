import { proxyResumeLibrary } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    resumeId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}`);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}`, {
    method: "PATCH",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}`, {
    method: "DELETE",
  });
}
