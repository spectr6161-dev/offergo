import { notFound } from "next/navigation";
import type { ResumeBuilderContent } from "@offergo/shared";

import { ResumeBuilderView } from "@/components/resume-builder/resume-builder-view";
import type {
  ResumeBuilderPhotoFile,
  ResumeBuilderPhotoSettings,
} from "@/components/resume-builder/resume-photo-control";
import { ResumeDocumentEditor } from "@/components/resume-library/resume-document-editor";
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

export default async function ResumeDocumentPage(
  props: PageProps<"/resumes/[resumeId]">
) {
  const { resumeId } = await props.params;

  try {
    const [response, user] = await Promise.all([
      apiFetch<ResumeResponse>(`/api/v1/resumes/${resumeId}`),
      requireUser(),
    ]);
    const currentVersion = response.item.currentVersion;

    if (currentVersion?.source === "builder") {
      const builderResponse = await apiFetch<BuilderResumeResponse>(
        `/api/v1/resumes/${resumeId}/builder`,
      );

      return (
        <ResumeBuilderView
          content={builderResponse.content}
          photoFile={builderResponse.photoFile}
          photoSettings={builderResponse.photoSettings}
          resumeId={response.item.id}
          userEmail={user.email}
        />
      );
    }

    return <ResumeDocumentEditor resume={response.item} />;
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      notFound();
    }

    throw error;
  }
}
