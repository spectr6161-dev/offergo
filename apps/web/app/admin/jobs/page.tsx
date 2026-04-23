import { PageFrame, SectionCard } from "@offergo/ui";
import { JobsGrid } from "@/components/admin/jobs-grid";

const rows = [
  {
    id: "resume-analysis-seed",
    queue: "resume.analysis",
    status: "queued",
    attempts: 0,
  },
];

export default function AdminJobsPage() {
  return (
    <PageFrame title="Jobs" description="Placeholder MUI X surface for worker operations and queue visibility.">
      <SectionCard title="Job list" subtitle="Static rows for foundation-only scaffolding.">
        <JobsGrid rows={rows} />
      </SectionCard>
    </PageFrame>
  );
}
