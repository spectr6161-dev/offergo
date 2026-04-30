import { aiTextModels } from "@offergo/ai";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

import { WorkflowDebuggerClient } from "./workflow-debugger-client";
import type { WorkflowRunsResponse } from "./workflow-debugger-client";

export const dynamic = "force-dynamic";

export default async function AdminWorkflowsPage() {
  let initialRuns: WorkflowRunsResponse["items"] = [];
  let initialError: string | null = null;

  try {
    const response = await apiFetch<WorkflowRunsResponse>(
      "/api/v1/admin/workflows",
    );
    initialRuns = response.items;
  } catch (error) {
    initialError = getApiErrorMessage(error);
  }

  return (
    <WorkflowDebuggerClient
      initialError={initialError}
      initialRuns={initialRuns}
      modelOptions={[...aiTextModels]}
    />
  );
}
