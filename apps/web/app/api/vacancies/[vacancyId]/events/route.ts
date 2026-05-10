import { proxyApi } from "../../../_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    vacancyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { vacancyId } = await context.params;

  return proxyApi(`/api/v1/vacancies/${vacancyId}/events`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
