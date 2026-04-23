import { GoogleGenAI } from "@google/genai";
import { env } from "@offergo/shared";
import { z } from "zod";

const resumeInputSchema = z.object({
  resumeId: z.string().optional(),
  userId: z.string().optional(),
  text: z.string().min(1),
});

const trainerInputSchema = z.object({
  trainerSessionId: z.string().optional(),
  userId: z.string().optional(),
  prompt: z.string().min(1),
});

function getClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
  });
}

async function generateText(prompt: string) {
  const client = getClient();
  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL_TEXT,
    contents: prompt,
  });

  return response.text ?? "";
}

export async function analyzeResume(input: unknown) {
  const parsed = resumeInputSchema.parse(input);
  const prompt = [
    "You are a resume reviewer for technical candidates.",
    "Return a concise JSON-like text summary with strengths, risks, and next edits.",
    parsed.text,
  ].join("\n\n");

  const output = await generateText(prompt);
  return {
    kind: "resume.analysis",
    output,
  };
}

export async function rewriteResume(input: unknown) {
  const parsed = resumeInputSchema.parse(input);
  const prompt = [
    "Rewrite the following resume text for a stronger technical job application.",
    "Keep the facts intact and improve clarity and impact.",
    parsed.text,
  ].join("\n\n");

  const output = await generateText(prompt);
  return {
    kind: "resume.rewrite",
    output,
  };
}

export async function evaluateAnswer(input: unknown) {
  const parsed = trainerInputSchema.parse(input);
  const prompt = [
    "Evaluate the following interview answer from a technical candidate.",
    "Return strengths, gaps, and a suggested stronger answer outline.",
    parsed.prompt,
  ].join("\n\n");

  const output = await generateText(prompt);
  return {
    kind: "answer.evaluate",
    output,
  };
}

export async function runTrainerTurn(input: unknown) {
  const parsed = trainerInputSchema.parse(input);
  const prompt = [
    "You are an interview trainer for software engineers.",
    "Read the previous user answer and produce the next coaching message and follow-up question.",
    parsed.prompt,
  ].join("\n\n");

  const output = await generateText(prompt);
  return {
    kind: "trainer.turn",
    output,
  };
}
