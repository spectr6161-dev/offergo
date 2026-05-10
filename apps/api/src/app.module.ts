import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller";
import { MobileAuthController } from "./auth/mobile-auth.controller";
import { HealthController } from "./health.controller";
import { BillingController } from "./billing/billing.controller";
import { DashboardController } from "./dashboard/dashboard.controller";
import { LegalController } from "./legal/legal.controller";
import { LegalRetentionService } from "./legal/legal-retention.service";
import { StorageController } from "./storage.controller";
import { AdminController } from "./admin/admin.controller";
import { ApiAuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { ResumeAnalysisController } from "./workflows/resume-analysis.controller";
import { ResumesController } from "./resumes/resumes.controller";
import { EmployersController } from "./employers/employers.controller";
import { VacanciesController } from "./vacancies/vacancies.controller";
import {
  AutoResponsesController,
  CoverMaterialsController,
} from "./cover-materials/cover-materials.controller";
import { WorkflowController } from "./workflows/workflow.controller";
import { WorkflowService } from "./workflows/workflow.service";
import { DesktopAuthController } from "./live/desktop-auth.controller";
import { DesktopAuthService } from "./live/desktop-auth.service";
import { LiveController } from "./live/live.controller";
import { LiveSessionService } from "./live/live-session.service";
import { LiveSessionCoordinator } from "./live/live-session-coordinator.service";
import { LiveAiPromptService } from "./live/live-ai-prompt.service";
import { GeminiLiveService } from "./live/gemini-live.service";
import { LiveAnswerGenerationService } from "./live/live-answer-generation.service";
import { LiveWebSocketGateway } from "./live/live-websocket.gateway";

@Module({
  controllers: [
    AuthController,
    MobileAuthController,
    BillingController,
    HealthController,
    LegalController,
    StorageController,
    AdminController,
    AutoResponsesController,
    CoverMaterialsController,
    DashboardController,
    DesktopAuthController,
    EmployersController,
    VacanciesController,
    LiveController,
    ResumeAnalysisController,
    ResumesController,
    WorkflowController,
  ],
  providers: [
    ApiAuthGuard,
    RolesGuard,
    WorkflowService,
    DesktopAuthService,
    LiveAiPromptService,
    GeminiLiveService,
    LiveAnswerGenerationService,
    LegalRetentionService,
    LiveSessionCoordinator,
    LiveSessionService,
    LiveWebSocketGateway,
  ],
})
export class AppModule {}
