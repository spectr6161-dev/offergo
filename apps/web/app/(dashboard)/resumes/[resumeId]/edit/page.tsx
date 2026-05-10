import { notFound } from "next/navigation";

import { ResumeCreateWizard } from "@/components/resume-create-wizard";
import type { ResumeLibraryResume } from "@/components/resume-library/types";
import { apiFetch, getApiErrorStatus } from "@/lib/api";

type ResumeResponse = {
  item: ResumeLibraryResume;
};

export default async function ResumeBuilderEditPage(
  props: PageProps<"/resumes/[resumeId]/edit">
) {
  const { resumeId } = await props.params;

  try {
    const response = await apiFetch<ResumeResponse>(
      `/api/v1/resumes/${resumeId}/builder`,
    );

    if (response.item.currentVersion?.source !== "builder") {
      notFound();
    }

    return <ResumeCreateWizard resumeId={resumeId} />;
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      notFound();
    }

    throw error;
  }
}
