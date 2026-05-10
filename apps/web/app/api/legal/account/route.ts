import { proxyApi } from "../../_lib/proxy";

export async function DELETE() {
  return proxyApi("/api/v1/legal/account", {
    method: "DELETE",
  });
}
