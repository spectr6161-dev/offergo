import { PageFrame } from "@offergo/ui";
import { FoundationPlaceholder } from "@/components/foundation-placeholder";

export default function ResumePage() {
  return (
    <PageFrame title="Resume" description="Placeholder route for resume upload, analysis, and rewrite flows.">
      <FoundationPlaceholder
        title="Resume module"
        summary="Storage adapter, AI package, queue contracts, and Prisma models are in place. UI flow and orchestration remain intentionally unimplemented."
        next={["Upload flow to storage", "Resume parsing and analysis jobs", "Version history and diff UI"]}
      />
    </PageFrame>
  );
}
