import { notFound } from "next/navigation";

import { PdfResumeViewer } from "@/components/resume-library/pdf-resume-viewer";
import type { ResumeLibraryResume } from "@/components/resume-library/types";
import { apiFetch, getApiErrorStatus } from "@/lib/api";

type ResumeResponse = {
  item: ResumeLibraryResume;
};

export default async function ResumePdfPage(
  props: PageProps<"/resumes/[resumeId]/pdf">
) {
  const { resumeId } = await props.params;

  try {
    const response = await apiFetch<ResumeResponse>(`/api/v1/resumes/${resumeId}`);
    const resume = response.item;
    const servedFile = resume.exportFile ?? resume.originalFile;

    if (servedFile?.mimeType !== "application/pdf") {
      notFound();
    }

    return <PdfResumeViewer resumeId={resume.id} title={resume.title} />;
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      notFound();
    }

    throw error;
  }
}
