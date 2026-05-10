import { proxyApi } from "../../../_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    vacancyId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { vacancyId } = await context.params;

  return proxyApi(`/api/v1/admin/vacancies/${vacancyId}`, {
    method: "PATCH",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { vacancyId } = await context.params;

  return proxyApi(`/api/v1/admin/vacancies/${vacancyId}`, {
    method: "DELETE",
  });
}
