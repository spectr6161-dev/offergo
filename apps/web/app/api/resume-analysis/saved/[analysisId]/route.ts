import { proxyResumeAnalysisJson } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await params;

  return proxyResumeAnalysisJson(`/api/v1/resume-analysis/saved/${analysisId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await params;

  return proxyResumeAnalysisJson(`/api/v1/resume-analysis/saved/${analysisId}`, {
    method: "PATCH",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await params;

  return proxyResumeAnalysisJson(`/api/v1/resume-analysis/saved/${analysisId}`, {
    method: "DELETE",
  });
}
