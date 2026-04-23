import { Card, CardContent, Stack, Typography } from "@mui/material";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <Card sx={{ width: "100%", maxWidth: 460 }}>
      <CardContent>
        <Stack spacing={3}>
          <div>
            <Typography variant="h4">Create account</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Start with the product workspace and unlock billing later.
            </Typography>
          </div>
          <RegisterForm />
        </Stack>
      </CardContent>
    </Card>
  );
}
