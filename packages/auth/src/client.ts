import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

const authBaseURL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [genericOAuthClient()],
  fetchOptions: {
    credentials: "include",
  },
});
