import { EmptyState, SectionCard } from "@offergo/ui";

export function FoundationPlaceholder({
  title,
  summary,
  status = "Scaffolded",
  next,
}: {
  title: string;
  summary: string;
  status?: string;
  next: string[];
}) {
  return (
    <SectionCard title={title} subtitle={summary}>
      <div className="foundation-placeholder__body">
        <span className="ui-pill">{status}</span>
        <EmptyState
          title="Product logic intentionally deferred"
          description="This route exists to anchor navigation, auth boundaries, and future module ownership. The business flow will be added later."
        />
        <div className="foundation-next-list">
          <strong>Next implementation slice</strong>
          <ul className="ui-list">
            {next.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}
