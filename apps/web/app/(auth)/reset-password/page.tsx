import { Suspense } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Card sx={{ width: "100%", maxWidth: 460 }}>
      <CardContent>
        <Stack spacing={3}>
          <div>
            <Typography variant="h4">Choose a new password</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This page expects a `token` query parameter from Better Auth.
            </Typography>
          </div>
          <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading reset form...</Typography>}>
            <ResetPasswordForm />
          </Suspense>
        </Stack>
      </CardContent>
    </Card>
  );
}
