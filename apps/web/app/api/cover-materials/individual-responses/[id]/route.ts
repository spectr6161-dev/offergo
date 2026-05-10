import { proxyApi } from "../../../_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return proxyApi(`/api/v1/cover-materials/individual-responses/${id}`, {
    method: "DELETE",
  });
}
