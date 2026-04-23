import { Suspense } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import { VerifyEmailPanel } from "./verify-email-panel";

export default function VerifyEmailPage() {
  return (
    <Card sx={{ width: "100%", maxWidth: 460 }}>
      <CardContent>
        <Stack spacing={3}>
          <div>
            <Typography variant="h4">Verify email</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Open the link from your inbox or resend the verification email from here.
            </Typography>
          </div>
          <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading verification panel...</Typography>}>
            <VerifyEmailPanel />
          </Suspense>
        </Stack>
      </CardContent>
    </Card>
  );
}
