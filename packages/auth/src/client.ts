import { createAuthClient } from "better-auth/react";

const authBaseURL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  fetchOptions: {
    credentials: "include",
  },
});
