import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller";
import { HealthController } from "./health.controller";
import { BillingController } from "./billing/billing.controller";
import { StorageController } from "./storage.controller";
import { AdminController } from "./admin/admin.controller";
import { ApiAuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { ResumeAnalysisController } from "./workflows/resume-analysis.controller";
import { ResumesController } from "./resumes/resumes.controller";
import { EmployersController } from "./employers/employers.controller";
import { WorkflowController } from "./workflows/workflow.controller";
import { WorkflowService } from "./workflows/workflow.service";

@Module({
  controllers: [
    AuthController,
    BillingController,
    HealthController,
    StorageController,
    AdminController,
    EmployersController,
    ResumeAnalysisController,
    ResumesController,
    WorkflowController,
  ],
  providers: [ApiAuthGuard, RolesGuard, WorkflowService],
})
export class AppModule {}
