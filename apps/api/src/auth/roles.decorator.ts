import { SetMetadata } from "@nestjs/common";
import { type AppRole } from "@offergo/shared";

export const ROLES_KEY = "offergo.roles";
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
