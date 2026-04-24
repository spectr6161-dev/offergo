import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller";
import { HealthController } from "./health.controller";
import { BillingController } from "./billing/billing.controller";
import { StorageController } from "./storage.controller";
import { AdminController } from "./admin/admin.controller";
import { ApiAuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";

@Module({
  controllers: [
    AuthController,
    BillingController,
    HealthController,
    StorageController,
    AdminController,
  ],
  providers: [ApiAuthGuard, RolesGuard],
})
export class AppModule {}
