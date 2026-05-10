import { proxyResumeLibrary } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return proxyResumeLibrary("/api/v1/resumes/builder-drafts", {
    method: "POST",
  });
}
