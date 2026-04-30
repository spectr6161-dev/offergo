import { proxyResumeLibrary } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyResumeLibrary("/api/v1/resumes/upload", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "multipart/form-data",
    },
    body: await request.arrayBuffer(),
  });
}
