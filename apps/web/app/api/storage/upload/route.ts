import { NextResponse } from "next/server";
import { auth } from "@offergo/auth/core";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      message: "Storage upload endpoint scaffolded but intentionally left inactive in the foundation phase.",
      acceptedPurpose: ["resume_source", "resume_export", "screenshot", "temp_ai_output"],
    },
    { status: 501 },
  );
}
