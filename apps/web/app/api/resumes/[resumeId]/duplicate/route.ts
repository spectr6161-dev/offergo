import { proxyResumeLibrary } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    resumeId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { resumeId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/duplicate`, {
    method: "POST",
  });
}
