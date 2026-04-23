import { Card, CardContent, Stack, Typography } from "@mui/material";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <Card sx={{ width: "100%", maxWidth: 460 }}>
      <CardContent>
        <Stack spacing={3}>
          <div>
            <Typography variant="h4">Reset password</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Request a reset link via the configured SMTP transport.
            </Typography>
          </div>
          <ForgotPasswordForm />
        </Stack>
      </CardContent>
    </Card>
  );
}
