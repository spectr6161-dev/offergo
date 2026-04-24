import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAnyRole } from "@offergo/auth/session";
import { type AppRole } from "@offergo/shared";
import type { AuthenticatedRequest } from "./authenticated-request";
import { ROLES_KEY } from "./roles.decorator";

const reflector = new Reflector();

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const requiredRoles = reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.auth?.user;

    if (!user || !hasAnyRole(user, requiredRoles)) {
      throw new ForbiddenException("Insufficient role for this endpoint.");
    }

    return true;
  }
}
