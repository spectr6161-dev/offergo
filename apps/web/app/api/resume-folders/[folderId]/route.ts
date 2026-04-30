import { proxyResumeLibrary } from "../../resumes/_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    folderId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resume-folders/${folderId}`, {
    method: "PATCH",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  return proxyResumeLibrary(`/api/v1/resume-folders/${folderId}`, {
    method: "DELETE",
  });
}
