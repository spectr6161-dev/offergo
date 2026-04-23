import { PageFrame } from "@offergo/ui";
import { FoundationPlaceholder } from "@/components/foundation-placeholder";

export default function TrainerPage() {
  return (
    <PageFrame title="Trainer" description="Placeholder route for AI coach sessions and follow-up polling.">
      <FoundationPlaceholder
        title="AI trainer"
        summary="Gemini adapter and BullMQ contracts are scaffolded. Session UX and polling are intentionally postponed."
        next={["Trainer session creation", "Queue-backed follow-up generation", "Client polling for session progress"]}
      />
    </PageFrame>
  );
}
