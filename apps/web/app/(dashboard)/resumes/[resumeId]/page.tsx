import { notFound } from "next/navigation";

import { ResumeDocumentEditor } from "@/components/resume-library/resume-document-editor";
import type { ResumeLibraryResume } from "@/components/resume-library/types";
import { apiFetch, getApiErrorStatus } from "@/lib/api";

type ResumeResponse = {
  item: ResumeLibraryResume;
};

export default async function ResumeDocumentPage(
  props: PageProps<"/resumes/[resumeId]">
) {
  const { resumeId } = await props.params;

  try {
    const response = await apiFetch<ResumeResponse>(`/api/v1/resumes/${resumeId}`);

    return <ResumeDocumentEditor resume={response.item} />;
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      notFound();
    }

    throw error;
  }
}
