import { NextResponse } from "next/server";
import { env } from "@offergo/shared";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "offergo-web",
    automationEnabled: env.ENABLE_PLAYWRIGHT_AUTOMATION,
    billingProvider: "platega",
    storageProvider: "s3-compatible",
    timestamp: new Date().toISOString(),
  });
}
