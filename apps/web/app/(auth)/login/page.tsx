import { Card, CardContent, Stack, Typography } from "@mui/material";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Card sx={{ width: "100%", maxWidth: 460 }}>
      <CardContent>
        <Stack spacing={3}>
          <div>
            <Typography variant="h4">Sign in</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Access the new offerGO workspace.
            </Typography>
          </div>
          <LoginForm />
        </Stack>
      </CardContent>
    </Card>
  );
}
