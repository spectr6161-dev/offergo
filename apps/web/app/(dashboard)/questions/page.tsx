import { PageFrame } from "@offergo/ui";
import { FoundationPlaceholder } from "@/components/foundation-placeholder";

export default function QuestionsPage() {
  return (
    <PageFrame title="Questions" description="Placeholder route for the interview question bank and answer review surface.">
      <FoundationPlaceholder
        title="Question bank"
        summary="Prisma models and admin ownership boundaries are scaffolded. Content ingestion and product workflows will be added later."
        next={["Question import pipeline", "Tag and difficulty filters", "Answer review and grading flows"]}
      />
    </PageFrame>
  );
}
