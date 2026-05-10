import { proxyResumeLibrary } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    action: string[];
    resumeId: string;
  }>;
};

function isBuilderPhotoAction(action: string[]) {
  return action.length === 2 && action[0] === "builder" && action[1] === "photo";
}

function isBuilderExportAction(action: string[]) {
  return action.length === 2 && action[0] === "builder" && action[1] === "export";
}

function notFoundResponse() {
  return new Response("Not found", { status: 404 });
}

export async function GET(request: Request, context: RouteContext) {
  const { action, resumeId } = await context.params;

  if (isBuilderPhotoAction(action)) {
    return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder/photo`, {
      headers: request.headers,
    });
  }

  if (isBuilderExportAction(action)) {
    const { search } = new URL(request.url);

    return proxyResumeLibrary(
      `/api/v1/resumes/${resumeId}/builder/export${search}`,
    );
  }

  return notFoundResponse();
}

export async function HEAD(request: Request, context: RouteContext) {
  const { action, resumeId } = await context.params;

  if (isBuilderPhotoAction(action)) {
    return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder/photo`, {
      headers: request.headers,
      method: "HEAD",
    });
  }

  return notFoundResponse();
}

export async function POST(request: Request, context: RouteContext) {
  const { action, resumeId } = await context.params;

  if (isBuilderPhotoAction(action)) {
    return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder/photo`, {
      method: "POST",
      headers: {
        "content-type":
          request.headers.get("content-type") ?? "multipart/form-data",
      },
      body: await request.arrayBuffer(),
    });
  }

  return notFoundResponse();
}

export async function PATCH(request: Request, context: RouteContext) {
  const { action, resumeId } = await context.params;

  if (isBuilderPhotoAction(action)) {
    return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder/photo`, {
      method: "PATCH",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
      body: await request.text(),
    });
  }

  return notFoundResponse();
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { action, resumeId } = await context.params;

  if (isBuilderPhotoAction(action)) {
    return proxyResumeLibrary(`/api/v1/resumes/${resumeId}/builder/photo`, {
      method: "DELETE",
    });
  }

  return notFoundResponse();
}
