import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@offergo/billing";

export async function POST(request: Request) {
  const payload = await request.json();

  try {
    const callback = await handleProviderWebhook(payload, request.headers);
    return NextResponse.json({
      ok: true,
      transactionId: callback.id,
      status: callback.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 400 },
    );
  }
}
