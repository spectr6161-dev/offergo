import { AutoResponsesClient } from "@/components/cover-materials/auto-responses-client";
import type { BillingSubscriptionSummary } from "@/components/pricing-section";
import type { ResumeLibraryResume } from "@/components/resume-library/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

type ResumeLibraryResponse = {
  items: ResumeLibraryResume[];
};

type AutoResponseSettings = {
  defaultResumeId: string | null;
  updatedAt: string;
};

type IndividualResponseArtifact = {
  id: string;
  resumeId: string;
  resumeTitle: string;
  vacancyText: string;
  source?: string | null;
  vacancyUrl?: string | null;
  vacancyTitle?: string | null;
  employerName?: string | null;
  decision: "matched" | "mismatch";
  coverLetter: string | null;
  summary: string;
  createdAt: string;
};

type IndividualResponsesResponse = {
  items: IndividualResponseArtifact[];
};

async function getAutoResponsesPageData() {
  const [resumes, history, settings, subscription] = await Promise.all([
    apiFetch<ResumeLibraryResponse>("/api/v1/resumes?scope=active"),
    apiFetch<IndividualResponsesResponse>(
      "/api/v1/cover-materials/individual-responses?source=hh_browser_copilot",
    ),
    apiFetch<AutoResponseSettings>(
      "/api/v1/cover-materials/auto-responses/settings",
    ),
    apiFetch<BillingSubscriptionSummary>("/api/v1/billing/subscription"),
  ]);

  return {
    history: history.items,
    resumes: resumes.items,
    settings,
    subscription,
  };
}

export default async function AutoResponsesPage() {
  try {
    const data = await getAutoResponsesPageData();

    return <AutoResponsesClient {...data} />;
  } catch (error) {
    return (
      <main className="flex min-h-[calc(100vh-var(--header-height))] w-full px-4 py-6 md:px-6 lg:px-8">
        <Alert className="w-full" variant="destructive">
          <AlertTitle>Не удалось загрузить автоотклики</AlertTitle>
          <AlertDescription>{getApiErrorMessage(error)}</AlertDescription>
        </Alert>
      </main>
    );
  }
}
