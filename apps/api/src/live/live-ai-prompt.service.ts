import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { prisma } from "@offergo/db";

export const WPF_LIVE_PROMPT_KEYS = {
  transcriptionCallSystem: "wpf.transcription.call.system",
  transcriptionMicSystem: "wpf.transcription.mic.system",
  answerEmployeeInstruction: "wpf.answer.employee_instruction",
  answerTemplate: "wpf.answer.template",
  answerLengthShort: "wpf.answer.length.short",
  answerLengthDetailed: "wpf.answer.length.detailed",
  answerModeAuto: "wpf.answer.mode.auto",
  answerModeManual: "wpf.answer.mode.manual",
  answerModeScreenshot: "wpf.answer.mode.screenshot",
  answerLiveCoding: "wpf.answer.live_coding",
  answerContextEmpty: "wpf.answer.context.empty",
  answerPreviousAnswersSection: "wpf.answer.previous_answers.section",
} as const;

@Injectable()
export class LiveAiPromptService {
  async getContent(key: string) {
    const prompt = await prisma.liveAiPrompt.findUnique({
      where: { key },
      select: { content: true },
    });

    if (!prompt) {
      throw new InternalServerErrorException(
        `Live AI prompt "${key}" is not configured.`,
      );
    }

    return prompt.content;
  }

  async getContentMap(keys: string[]) {
    const uniqueKeys = Array.from(new Set(keys));
    const prompts = await prisma.liveAiPrompt.findMany({
      where: {
        key: {
          in: uniqueKeys,
        },
      },
      select: {
        key: true,
        content: true,
      },
    });
    const contentByKey = new Map(
      prompts.map((prompt) => [prompt.key, prompt.content]),
    );
    const missingKeys = uniqueKeys.filter((key) => !contentByKey.has(key));

    if (missingKeys.length > 0) {
      throw new InternalServerErrorException(
        `Live AI prompts are not configured: ${missingKeys.join(", ")}.`,
      );
    }

    return contentByKey;
  }
}
