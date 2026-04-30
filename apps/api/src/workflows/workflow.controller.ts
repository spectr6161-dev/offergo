import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { z } from "zod";

import { ApiAuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { WorkflowService } from "./workflow.service";

const startResumeAnalysisWorkflowSchema = z.object({
  text: z.string().max(20_000).optional(),
  modelId: z.string().min(1).max(120).optional(),
});

@ApiTags("admin-workflows")
@ApiBearerAuth("bearer")
@ApiCookieAuth("session")
@UseGuards(ApiAuthGuard, RolesGuard)
@Roles("admin")
@Controller("admin/workflows")
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Post("resume-analysis")
  async startResumeAnalysisWorkflow(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = startResumeAnalysisWorkflowSchema.parse(body);
    return this.workflows.startResumeAnalysisWorkflow(user.id, parsed);
  }

  @Get()
  async listRuns() {
    return this.workflows.listRuns();
  }

  @Get(":runId")
  async getRun(@Param("runId") runId: string) {
    return this.workflows.getRunSnapshot(runId);
  }

  @Sse(":runId/events")
  streamRunEvents(@Param("runId") runId: string) {
    return this.workflows.streamRunEvents(runId);
  }
}
