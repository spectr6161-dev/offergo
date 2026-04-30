import { proxyResumeLibrary } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    resumeId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/content`, {
    method: "PUT",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
