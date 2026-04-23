import { Stack, Typography } from "@mui/material";
import { requireUser } from "@offergo/auth/server";
import { PageFrame, SectionCard } from "@offergo/ui";
import { SignOutButton } from "@/components/sign-out-button";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <PageFrame title="Settings" description="Minimal authenticated route proving access control and account surface wiring.">
      <SectionCard title="Account" subtitle="Basic session and identity information.">
        <Stack spacing={1}>
          <Typography variant="body2">Name: {user.name}</Typography>
          <Typography variant="body2">Email: {user.email}</Typography>
          <Typography variant="body2">Roles: {user.roles.join(", ")}</Typography>
          <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
            <SignOutButton />
          </Stack>
        </Stack>
      </SectionCard>
    </PageFrame>
  );
}
