import { proxyResumeAnalysisJson } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyResumeAnalysisJson("/api/v1/resume-analysis/saved");
}
