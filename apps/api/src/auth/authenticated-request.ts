import type { Request } from "express";
import type {
  AuthenticatedAppUser,
  ResolvedSession,
} from "@offergo/auth/session";

export type AuthenticatedRequest = Request & {
  auth?: {
    session: ResolvedSession;
    user: AuthenticatedAppUser;
  };
};
