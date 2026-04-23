import { createAuthClient } from "better-auth/react";
import { env } from "@offergo/shared";

export const authClient = createAuthClient({
  baseURL: env.BETTER_AUTH_URL,
});
