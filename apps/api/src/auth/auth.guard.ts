import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import {
  getCurrentSessionFromHeaders,
  getCurrentUserFromSession,
} from "@offergo/auth/session";
import type { AuthenticatedRequest } from "./authenticated-request";

@Injectable()
export class ApiAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headers = fromNodeHeaders(request.headers);
    const session = await getCurrentSessionFromHeaders(headers);

    if (!session) {
      throw new UnauthorizedException("Authentication required.");
    }

    const user = await getCurrentUserFromSession(session);
    request.auth = {
      session,
      user,
    };

    return true;
  }
}
