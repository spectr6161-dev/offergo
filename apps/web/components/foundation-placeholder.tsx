import { Chip, Stack, Typography } from "@mui/material";
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
      <Stack spacing={2}>
        <Chip label={status} color="primary" variant="outlined" sx={{ alignSelf: "flex-start" }} />
        <EmptyState
          title="Product logic intentionally deferred"
          description="This route exists to anchor navigation, auth boundaries, and future module ownership. The business flow will be added later."
        />
        <Stack spacing={1}>
          <Typography variant="subtitle2">Next implementation slice</Typography>
          {next.map((item) => (
            <Typography key={item} variant="body2" color="text.secondary">
              - {item}
            </Typography>
          ))}
        </Stack>
      </Stack>
    </SectionCard>
  );
}
