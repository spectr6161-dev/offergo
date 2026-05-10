import { notFound } from "next/navigation";
import type { ResumeBuilderContent } from "@offergo/shared";

import { ResumePrintController } from "@/components/resume-builder/resume-print-controller";
import { ResumePrintView } from "@/components/resume-builder/resume-print-view";
import type {
  ResumeBuilderPhotoFile,
  ResumeBuilderPhotoSettings,
} from "@/components/resume-builder/resume-photo-control";
import type { ResumeLibraryResume } from "@/components/resume-library/types";
import { apiFetch, getApiErrorStatus } from "@/lib/api";
import { requireUser } from "@/lib/auth";

type ResumeResponse = {
  item: ResumeLibraryResume;
};

type BuilderResumeResponse = {
  item: ResumeLibraryResume;
  content: ResumeBuilderContent;
  photoFile: ResumeBuilderPhotoFile;
  photoSettings: ResumeBuilderPhotoSettings;
};

export default async function ResumePrintPage(
  props: PageProps<"/resumes/[resumeId]/print">,
) {
  const { resumeId } = await props.params;

  try {
    const user = await requireUser();
    const resumeResponse = await apiFetch<ResumeResponse>(
      `/api/v1/resumes/${resumeId}`,
    );

    if (resumeResponse.item.currentVersion?.source !== "builder") {
      notFound();
    }

    const builderResponse = await apiFetch<BuilderResumeResponse>(
      `/api/v1/resumes/${resumeId}/builder`,
    );

    return (
      <main className="resume-print-page min-h-dvh bg-neutral-100 py-8 print:bg-white print:py-0">
        <div className="mx-auto flex w-fit items-start gap-6 px-4 print:block print:w-auto print:px-0">
          <ResumePrintView
            content={builderResponse.content}
            photoFile={builderResponse.photoFile}
            photoSettings={builderResponse.photoSettings}
            resumeId={resumeResponse.item.id}
            userEmail={user.email}
          />
          <ResumePrintController />
        </div>
      </main>
    );
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      notFound();
    }

    throw error;
  }
}
