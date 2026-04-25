"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  BotIcon,
  EraserIcon,
  FileAudioIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  PlayIcon,
  ScrollTextIcon,
  Volume2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ModelOption = {
  id: string;
  name: string;
  description?: string;
  tier: string;
};

type PlaygroundMetadata = {
  status: "ready" | "loading" | "success" | "error";
  mode: string;
  model: string;
  latencyMs?: number;
  error?: unknown;
};

type JsonResult = Record<string, unknown> | null;

type AiPlaygroundClientProps = {
  textModels: ModelOption[];
  imageModels: ModelOption[];
  speechModels: ModelOption[];
  voices: string[];
};

export function AiPlaygroundClient({
  textModels,
  imageModels,
  speechModels,
  voices,
}: AiPlaygroundClientProps) {
  const [mode, setMode] = useState("chat");
  const [textModel, setTextModel] = useState(textModels[0]?.id ?? "");
  const [imageModel, setImageModel] = useState(imageModels[0]?.id ?? "");
  const [speechModel, setSpeechModel] = useState(speechModels[0]?.id ?? "");
  const [voice, setVoice] = useState(voices[0] ?? "Kore");
  const [temperature, setTemperature] = useState("0.4");
  const [chatInput, setChatInput] = useState("");
  const [generatePrompt, setGeneratePrompt] = useState(
    "Сформулируй короткий технический план для AI feature flag.",
  );
  const [objectPrompt, setObjectPrompt] = useState(
    "Разбери идею AI playground для админки и верни краткую оценку.",
  );
  const [imagePrompt, setImagePrompt] = useState(
    "Minimal SaaS admin console for AI testing, dark accents, clean interface",
  );
  const [speechText, setSpeechText] = useState(
    "Проверка генерации речи через Gemini TTS.",
  );
  const [sttPrompt, setSttPrompt] = useState(
    "Transcribe this audio. Return only transcript text.",
  );
  const [plainOutput, setPlainOutput] = useState("");
  const [jsonOutput, setJsonOutput] = useState<JsonResult>(null);
  const [imageOutput, setImageOutput] = useState("");
  const [audioOutput, setAudioOutput] = useState("");
  const [metadata, setMetadata] = useState<PlaygroundMetadata>({
    status: "ready",
    mode: "chat",
    model: textModel,
  });

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/admin/ai-playground/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            modelId: textModel,
            temperature: parseTemperature(temperature),
          },
        }),
      }),
    [temperature, textModel],
  );
  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    transport: chatTransport,
    experimental_throttle: 50,
  });

  useEffect(() => {
    if (status === "ready") {
      setMetadata((previous) =>
        previous.mode === "Chat" && previous.status === "loading"
          ? { ...previous, status: "success" }
          : previous,
      );
      return;
    }

    if (status === "error") {
      setMetadata((previous) =>
        previous.mode === "Chat"
          ? {
              ...previous,
              status: "error",
              error: error?.message ?? "Ошибка chat stream.",
            }
          : previous,
      );
    }
  }, [error, status]);

  async function postJson<T>(
    path: string,
    body: Record<string, unknown>,
    nextMetadata: Omit<PlaygroundMetadata, "status">,
  ) {
    setMetadata({ ...nextMetadata, status: "loading" });

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as T & {
      error?: unknown;
      latencyMs?: number;
    };

    if (!response.ok) {
      setMetadata({
        ...nextMetadata,
        status: "error",
        latencyMs: data.latencyMs,
        error: data.error ?? "Ошибка запроса.",
      });
      throw new Error(formatUnknownError(data.error ?? "Ошибка запроса."));
    }

    setMetadata({
      ...nextMetadata,
      status: "success",
      latencyMs: data.latencyMs,
    });

    return data;
  }

  async function runGenerate() {
    const result = await postJson<{ text: string }>(
      "/api/admin/ai-playground/generate",
      {
        prompt: generatePrompt,
        modelId: textModel,
        temperature: parseTemperature(temperature),
      },
      { mode: "Text", model: textModel },
    );
    setPlainOutput(result.text);
    setJsonOutput(null);
  }

  async function runObject() {
    const result = await postJson<{ object: Record<string, unknown> }>(
      "/api/admin/ai-playground/object",
      {
        prompt: objectPrompt,
        modelId: textModel,
        temperature: parseTemperature(temperature),
      },
      { mode: "Object", model: textModel },
    );
    setJsonOutput(result.object);
    setPlainOutput("");
  }

  async function runImage() {
    const result = await postJson<{ dataUrl: string }>(
      "/api/admin/ai-playground/image",
      {
        prompt: imagePrompt,
        modelId: imageModel,
        aspectRatio: "1:1",
      },
      { mode: "Image", model: imageModel },
    );
    setImageOutput(result.dataUrl);
  }

  async function runTts() {
    const result = await postJson<{ dataUrl: string }>(
      "/api/admin/ai-playground/tts",
      {
        text: speechText,
        modelId: speechModel,
        voice,
      },
      { mode: "TTS", model: speechModel },
    );
    setAudioOutput(result.dataUrl);
  }

  async function runStt(file: File | null) {
    if (!file) {
      setMetadata({
        status: "error",
        mode: "STT",
        model: textModel,
        error: "Выберите audio-файл.",
      });
      return;
    }

    setMetadata({ status: "loading", mode: "STT", model: textModel });
    const formData = new FormData();
    formData.set("file", file);
    formData.set("modelId", textModel);
    formData.set("prompt", sttPrompt);

    const response = await fetch("/api/admin/ai-playground/stt", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json()) as {
      text?: string;
      error?: unknown;
      latencyMs?: number;
    };

    if (!response.ok) {
      setMetadata({
        status: "error",
        mode: "STT",
        model: textModel,
        latencyMs: data.latencyMs,
        error: data.error ?? "Ошибка STT.",
      });
      return;
    }

    setPlainOutput(data.text ?? "");
    setJsonOutput(null);
    setMetadata({
      status: "success",
      mode: "STT",
      model: textModel,
      latencyMs: data.latencyMs,
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BotIcon className="size-5" />
            <h1 className="font-semibold text-2xl tracking-tight">
              AI Playground
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Админская консоль для проверки Gemini через packages/ai.
          </p>
        </div>
        <Badge variant="secondary">admin-only</Badge>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-h-[720px] overflow-hidden">
          <Tabs
            className="flex h-full flex-col"
            onValueChange={setMode}
            value={mode}
          >
            <CardHeader className="gap-4">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="chat">
                  <MessageSquareTextIcon className="size-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="generate">
                  <ScrollTextIcon className="size-4" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="object">JSON</TabsTrigger>
                <TabsTrigger value="image">
                  <ImageIcon className="size-4" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="tts">
                  <Volume2Icon className="size-4" />
                  TTS
                </TabsTrigger>
                <TabsTrigger value="stt">
                  <FileAudioIcon className="size-4" />
                  STT
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col">
              <TabsContent
                className="mt-0 flex min-h-0 flex-1 flex-col"
                value="chat"
              >
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border">
                  <Conversation className="min-h-0 flex-1">
                    <ConversationContent>
                      {messages.length === 0 ? (
                        <ConversationEmptyState
                          description="Отправьте первый запрос."
                          icon={<BotIcon className="size-6" />}
                          title="Чат пуст"
                        />
                      ) : (
                        messages.map((message) => (
                          <Message from={message.role} key={message.id}>
                            <MessageContent>
                              {message.parts.map((part, index) =>
                                part.type === "text" ? (
                                  <MessageResponse
                                    key={`${message.id}-${index}`}
                                  >
                                    {part.text}
                                  </MessageResponse>
                                ) : null,
                              )}
                            </MessageContent>
                          </Message>
                        ))
                      )}
                      {(status === "submitted" || status === "streaming") && (
                        <Message from="assistant">
                          <MessageContent>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Loader />
                              Генерация
                            </div>
                          </MessageContent>
                        </Message>
                      )}
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>

                  <div className="border-t p-3">
                    <PromptInput
                      onSubmit={(message) => {
                        if (!message.text.trim()) {
                          return;
                        }

                        void sendMessage({ text: message.text });
                        setChatInput("");
                        setMetadata({
                          status: "loading",
                          mode: "Chat",
                          model: textModel,
                        });
                      }}
                    >
                      <PromptInputBody>
                        <PromptInputTextarea
                          disabled={
                            status === "submitted" || status === "streaming"
                          }
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="Введите запрос"
                          value={chatInput}
                        />
                      </PromptInputBody>
                      <PromptInputFooter>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <span>{textModel}</span>
                          {error ? (
                            <span className="text-destructive">error</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {status === "streaming" ? (
                            <Button
                              onClick={stop}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Stop
                            </Button>
                          ) : null}
                          <PromptInputSubmit status={status} />
                        </div>
                      </PromptInputFooter>
                    </PromptInput>
                    <div className="mt-2 flex justify-end">
                      <Button
                        onClick={() => setMessages([])}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <EraserIcon className="size-4" />
                        Очистить
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent className="mt-0 grid gap-4" value="generate">
                <RunPanel
                  icon={<PlayIcon className="size-4" />}
                  isLoading={
                    metadata.status === "loading" && metadata.mode === "Text"
                  }
                  label="Сгенерировать"
                  onRun={runGenerate}
                  title="Text generate"
                >
                  <Textarea
                    className="min-h-40"
                    onChange={(event) => setGeneratePrompt(event.target.value)}
                    value={generatePrompt}
                  />
                </RunPanel>
                <OutputPanel
                  jsonOutput={jsonOutput}
                  plainOutput={plainOutput}
                />
              </TabsContent>

              <TabsContent className="mt-0 grid gap-4" value="object">
                <RunPanel
                  icon={<PlayIcon className="size-4" />}
                  isLoading={
                    metadata.status === "loading" && metadata.mode === "Object"
                  }
                  label="Получить JSON"
                  onRun={runObject}
                  title="Structured output"
                >
                  <Textarea
                    className="min-h-40"
                    onChange={(event) => setObjectPrompt(event.target.value)}
                    value={objectPrompt}
                  />
                </RunPanel>
                <OutputPanel
                  jsonOutput={jsonOutput}
                  plainOutput={plainOutput}
                />
              </TabsContent>

              <TabsContent className="mt-0 grid gap-4" value="image">
                <RunPanel
                  icon={<ImageIcon className="size-4" />}
                  isLoading={
                    metadata.status === "loading" && metadata.mode === "Image"
                  }
                  label="Создать изображение"
                  onRun={runImage}
                  title="Image generation"
                >
                  <Textarea
                    className="min-h-32"
                    onChange={(event) => setImagePrompt(event.target.value)}
                    value={imagePrompt}
                  />
                </RunPanel>
                {imageOutput ? (
                  <div className="overflow-hidden rounded-lg border bg-muted/30 p-3">
                    <img
                      alt="AI generated result"
                      className="mx-auto max-h-[520px] rounded-md object-contain"
                      src={imageOutput}
                    />
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent className="mt-0 grid gap-4" value="tts">
                <RunPanel
                  icon={<Volume2Icon className="size-4" />}
                  isLoading={
                    metadata.status === "loading" && metadata.mode === "TTS"
                  }
                  label="Сгенерировать речь"
                  onRun={runTts}
                  title="Text to speech"
                >
                  <Textarea
                    className="min-h-32"
                    onChange={(event) => setSpeechText(event.target.value)}
                    value={speechText}
                  />
                </RunPanel>
                {audioOutput ? (
                  <audio className="w-full" controls src={audioOutput}>
                    <track kind="captions" />
                  </audio>
                ) : null}
              </TabsContent>

              <TabsContent className="mt-0 grid gap-4" value="stt">
                <Card>
                  <CardHeader>
                    <CardTitle>Speech to text</CardTitle>
                    <CardDescription>
                      Audio до 20 MB, inline Gemini input.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <Textarea
                      className="min-h-24"
                      onChange={(event) => setSttPrompt(event.target.value)}
                      value={sttPrompt}
                    />
                    <Input
                      accept="audio/*"
                      onChange={(event) => {
                        void runStt(event.target.files?.[0] ?? null);
                      }}
                      type="file"
                    />
                  </CardContent>
                </Card>
                <OutputPanel
                  jsonOutput={jsonOutput}
                  plainOutput={plainOutput}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Параметры</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ModelSelect
                label="Text model"
                models={textModels}
                onValueChange={setTextModel}
                value={textModel}
              />
              <ModelSelect
                label="Image model"
                models={imageModels}
                onValueChange={setImageModel}
                value={imageModel}
              />
              <ModelSelect
                label="TTS model"
                models={speechModels}
                onValueChange={setSpeechModel}
                value={speechModel}
              />
              <div className="grid gap-2">
                <Label>Voice</Label>
                <Select onValueChange={setVoice} value={voice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  max="2"
                  min="0"
                  onChange={(event) => setTemperature(event.target.value)}
                  step="0.1"
                  type="number"
                  value={temperature}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow label="Mode" value={metadata.mode} />
              <MetaRow label="Model" value={metadata.model} />
              <MetaRow label="Status" value={metadata.status} />
              <MetaRow
                label="Latency"
                value={
                  typeof metadata.latencyMs === "number"
                    ? `${metadata.latencyMs} ms`
                    : "—"
                }
              />
              {metadata.error ? (
                <>
                  <Separator />
                  <Alert variant="destructive">
                    <AlertDescription>
                      {formatUnknownError(metadata.error)}
                    </AlertDescription>
                  </Alert>
                </>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ModelSelect({
  label,
  models,
  value,
  onValueChange,
}: {
  label: string;
  models: ModelOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center gap-2">
                <span>{model.name}</span>
                <Badge className="text-[10px]" variant="secondary">
                  {model.tier}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RunPanel({
  title,
  label,
  icon,
  isLoading,
  onRun,
  children,
}: {
  title: string;
  label: string;
  icon: React.ReactNode;
  isLoading: boolean;
  onRun: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [localError, setLocalError] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {children}
        {localError ? (
          <Alert variant="destructive">
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          disabled={isLoading}
          onClick={() => {
            setLocalError("");
            void onRun().catch((error: unknown) => {
              setLocalError(
                error instanceof Error ? error.message : "Ошибка запроса.",
              );
            });
          }}
          type="button"
        >
          {isLoading ? <Loader2Icon className="size-4 animate-spin" /> : icon}
          {label}
        </Button>
      </CardContent>
    </Card>
  );
}

function OutputPanel({
  plainOutput,
  jsonOutput,
}: {
  plainOutput: string;
  jsonOutput: JsonResult;
}) {
  if (jsonOutput) {
    return (
      <CodeBlock
        code={JSON.stringify(jsonOutput, null, 2)}
        language="json"
        showLineNumbers
      >
        <CodeBlockCopyButton />
      </CodeBlock>
    );
  }

  if (plainOutput) {
    return (
      <Card>
        <CardContent className="pt-6">
          <MessageResponse>{plainOutput}</MessageResponse>
        </CardContent>
      </Card>
    );
  }

  return null;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-56 truncate font-medium">{value}</span>
    </div>
  );
}

function parseTemperature(value: string) {
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.min(2, parsed));
}

function formatUnknownError(error: unknown) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return JSON.stringify(error, null, 2);
}
