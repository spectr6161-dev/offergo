"use client";

import { useEffect, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  Loader2Icon,
  PlayIcon,
  SkipForwardIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  WorkflowNodeSnapshot as BaseWorkflowNodeSnapshot,
  WorkflowNodeStatus,
  WorkflowRunSnapshot as BaseWorkflowRunSnapshot,
  WorkflowRunStatus,
} from "@/lib/workflow-types";
import { cn } from "@/lib/utils";

type WorkflowNodeKey = string;

type WorkflowNodeDebug = {
  kind: "deterministic" | "llm";
  description: string;
  goal: string;
  reads: string[];
  writes: string[];
  prompt?: {
    system: string;
    user: string;
    userTemplate?: string;
    modelId: string;
    temperature?: number;
    outputSchemaName: string;
    modelPolicy: "selected_model" | "cheap" | "pro";
  };
  expectedOutput: string;
  debugHints: string[];
};

export type WorkflowNodeSnapshot = Omit<
  BaseWorkflowNodeSnapshot,
  "debug" | "key"
> & {
  key: WorkflowNodeKey;
  debug?: WorkflowNodeDebug;
};

export type WorkflowRunSnapshot = Omit<
  BaseWorkflowRunSnapshot,
  "nodes" | "type"
> & {
  type: "resume_analysis_v1" | "resume_analysis_demo";
  nodes: WorkflowNodeSnapshot[];
};

export type WorkflowRunsResponse = {
  items: WorkflowRunSnapshot[];
};

type ModelOption = {
  id: string;
  name: string;
  tier: string;
};

type WorkflowNodeData = {
  snapshot: WorkflowNodeSnapshot;
  isCurrent: boolean;
  isNext: boolean;
} & Record<string, unknown>;

type WorkflowFlowNode = Node<WorkflowNodeData, "workflowNode">;

const statusLabels: Record<WorkflowNodeStatus | WorkflowRunStatus, string> = {
  pending: "Ожидает",
  running: "Выполняется",
  success: "Успех",
  error: "Ошибка",
  skipped: "Пропущен",
};

const statusIcons: Record<WorkflowNodeStatus, React.ReactNode> = {
  pending: <ClockIcon />,
  running: <Loader2Icon className="animate-spin" />,
  success: <CheckCircle2Icon />,
  error: <AlertCircleIcon />,
  skipped: <SkipForwardIcon />,
};

const statusBadgeVariant: Record<
  WorkflowNodeStatus | WorkflowRunStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  pending: "outline",
  running: "secondary",
  success: "default",
  error: "destructive",
  skipped: "outline",
};

const fallbackNodeDebug: Partial<Record<WorkflowNodeKey, WorkflowNodeDebug>> = {
  upload_resume: {
    kind: "deterministic",
    description:
      "Фиксирует источник входного резюме и базовые технические параметры документа.",
    goal: "Понять, какой input попал в workflow и можно ли запускать дальнейшие шаги.",
    reads: ["WorkflowRun.input.text", "WorkflowRun.input.source"],
    writes: ["upload_resume.output.source", "upload_resume.output.chars"],
    expectedOutput: "JSON с source, количеством символов и mimeType.",
    debugHints: [
      "Для старых запусков debug metadata может быть восстановлена из UI fallback.",
    ],
  },
  parse_file: {
    kind: "deterministic",
    description:
      "В v1 принимает готовый TXT/admin input и нормализует его как plain text.",
    goal: "Получить чистый текст резюме без потери кириллицы.",
    reads: ["upload_resume.output", "WorkflowRun.input.text"],
    writes: ["parse_file.output.plainText", "parse_file.output.chars"],
    expectedOutput: "JSON с plainText, chars и encoding=utf-8.",
    debugHints: ["Если текст битый, проблема возникла до LLM-ноды."],
  },
  llm_analyze: {
    kind: "llm",
    description:
      "Отправляет текст резюме в выбранную LLM и получает первичный список проблем.",
    goal: "Проверить prompt, модель и результат LLM-анализа.",
    reads: ["parse_file.output.plainText", "WorkflowRun.input.modelId"],
    writes: ["llm_analyze.output.analysis", "llm_analyze.output.usage"],
    prompt: {
      system:
        "Ты эксперт по анализу резюме, найму, ATS и карьерному позиционированию.",
      user: "Prompt snapshot появится после запуска новой версии workflow.",
      modelId: "selected_model",
      outputSchemaName: "PlainTextResumeAnalysis",
      modelPolicy: "selected_model",
    },
    expectedOutput: "JSON с analysis, modelId, finishReason, usage и warnings.",
    debugHints: ["Для точного prompt snapshot запустите workflow заново."],
  },
  final_result: {
    kind: "deterministic",
    description:
      "Собирает финальный результат workflow из output предыдущих нод.",
    goal: "Зафиксировать финальный объект, отображаемый в debugger.",
    reads: ["llm_analyze.output.analysis"],
    writes: ["WorkflowRun.finalResult", "WorkflowRun.output"],
    expectedOutput: "JSON с analysis и completedAt.",
    debugHints: ["Если finalResult пустой, проверьте output LLM-ноды."],
  },
};

const nodeTypes = {
  workflowNode: WorkflowNodeCard,
};

function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const { snapshot, isCurrent, isNext } = data;

  return (
    <Card
      className={cn(
        "w-56 border bg-background shadow-sm transition",
        selected && "ring-2 ring-foreground",
        isCurrent && "border-blue-500 shadow-blue-500/15 ring-2 ring-blue-500",
        snapshot.status === "success" && "border-emerald-500/70",
        snapshot.status === "error" &&
          "border-destructive ring-2 ring-destructive",
        snapshot.status === "skipped" && "opacity-55",
        isNext && snapshot.status === "pending" && "border-dashed",
      )}
      size="sm"
    >
      <Handle className="opacity-0" position={Position.Left} type="target" />
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border [&_svg]:size-4",
                snapshot.status === "running" && "text-blue-600",
                snapshot.status === "success" && "text-emerald-600",
                snapshot.status === "error" && "text-destructive",
              )}
            >
              {statusIcons[snapshot.status]}
            </span>
            <CardTitle className="text-sm">{snapshot.label}</CardTitle>
          </div>
          <Badge variant={statusBadgeVariant[snapshot.status]}>
            {statusLabels[snapshot.status]}
          </Badge>
        </div>
        <CardDescription className="font-mono text-xs">
          {snapshot.key}
        </CardDescription>
      </CardHeader>
      <Handle className="opacity-0" position={Position.Right} type="source" />
    </Card>
  );
}

function upsertRun(runs: WorkflowRunSnapshot[], nextRun: WorkflowRunSnapshot) {
  const index = runs.findIndex((run) => run.id === nextRun.id);

  if (index === -1) {
    return [nextRun, ...runs];
  }

  return runs.map((run) => (run.id === nextRun.id ? nextRun : run));
}

function formatJson(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Нет данных";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function getNodeDebug(node: WorkflowNodeSnapshot | null) {
  if (!node) {
    return null;
  }

  return node.debug ?? fallbackNodeDebug[node.key];
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "-";
}

function formatDuration(value?: number | null) {
  if (typeof value !== "number") {
    return "-";
  }

  if (value < 1_000) {
    return `${value} ms`;
  }

  return `${(value / 1_000).toFixed(2)} s`;
}

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">Нет данных</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
          key={item}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function readErrorMessage(body: unknown) {
  if (typeof body === "string") {
    return body;
  }

  if (body && typeof body === "object") {
    if (
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }

    if ("error" in body) {
      const error = (body as { error?: unknown }).error;

      if (typeof error === "string") {
        return error;
      }

      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        return (error as { message: string }).message;
      }
    }
  }

  return "Запрос не выполнен.";
}

async function readResponseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildFlowNodes(run: WorkflowRunSnapshot | null): WorkflowFlowNode[] {
  if (!run) {
    return [];
  }

  return run.nodes.map((node, index) => ({
    id: node.key,
    type: "workflowNode",
    position: {
      x: index * 280,
      y: index % 2 === 0 ? 40 : 145,
    },
    data: {
      snapshot: node,
      isCurrent: run.currentNodeKey === node.key,
      isNext: run.nextNodeKey === node.key,
    },
  }));
}

function buildFlowEdges(run: WorkflowRunSnapshot | null): Edge[] {
  if (!run) {
    return [];
  }

  return run.nodes.slice(0, -1).map((node, index) => {
    const target = run.nodes[index + 1];
    const failed = node.status === "error" || target.status === "skipped";
    const active = node.status === "running" || target.status === "running";

    return {
      id: `${node.key}-${target.key}`,
      source: node.key,
      target: target.key,
      animated: active,
      style: {
        stroke: failed ? "var(--destructive)" : active ? "#2563eb" : "#94a3b8",
        strokeWidth: active ? 2.5 : 1.5,
      },
    };
  });
}

function getSelectedNode(
  run: WorkflowRunSnapshot | null,
  selectedNodeKey: WorkflowNodeKey | null,
) {
  if (!run || !selectedNodeKey) {
    return null;
  }

  return run.nodes.find((node) => node.key === selectedNodeKey) ?? null;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
      {formatJson(value)}
    </pre>
  );
}

function WorkflowGraph({
  edges,
  nodes,
  onNodeSelect,
  runId,
  runUpdatedAt,
}: {
  edges: Edge[];
  nodes: WorkflowFlowNode[];
  onNodeSelect: (nodeKey: WorkflowNodeKey) => void;
  runId: string;
  runUpdatedAt: string;
}) {
  const nodesInitialized = useNodesInitialized();
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      void fitView({
        duration: 180,
        maxZoom: 1,
        minZoom: 0.55,
        padding: 0.18,
      });
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [fitView, nodes.length, nodesInitialized, runId, runUpdatedAt]);

  return (
    <ReactFlow
      defaultViewport={{ x: 40, y: 80, zoom: 0.8 }}
      edges={edges}
      elementsSelectable
      fitView
      fitViewOptions={{
        maxZoom: 1,
        minZoom: 0.55,
        padding: 0.18,
      }}
      nodes={nodes}
      nodesConnectable={false}
      nodesDraggable={false}
      nodeTypes={nodeTypes}
      onNodeClick={(_event, node) => {
        onNodeSelect(node.id as WorkflowNodeKey);
      }}
      panOnScroll
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable={false} zoomable={false} />
    </ReactFlow>
  );
}

export function WorkflowDebuggerClient({
  initialRuns,
  initialError,
  modelOptions,
}: {
  initialRuns: WorkflowRunSnapshot[];
  initialError: string | null;
  modelOptions: ModelOption[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [activeRun, setActiveRun] = useState<WorkflowRunSnapshot | null>(
    initialRuns[0] ?? null,
  );
  const [selectedNodeKey, setSelectedNodeKey] =
    useState<WorkflowNodeKey | null>(initialRuns[0]?.nodes[0]?.key ?? null);
  const [text, setText] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(
    modelOptions[0]?.id ?? "gemini-3.1-pro-preview",
  );
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!liveRunId) {
      return;
    }

    const source = new EventSource(`/api/admin/workflows/${liveRunId}/events`);
    let receivedTerminalEvent = false;
    const updateRun = (event: MessageEvent<string>) => {
      const nextRun = JSON.parse(event.data) as WorkflowRunSnapshot;

      setActiveRun(nextRun);
      setRuns((currentRuns) => upsertRun(currentRuns, nextRun));

      if (nextRun.status === "success" || nextRun.status === "error") {
        receivedTerminalEvent = true;
        source.close();
        setLiveRunId(null);
      }
    };

    source.addEventListener("snapshot", updateRun);
    source.addEventListener("run_update", updateRun);
    source.addEventListener("node_update", updateRun);
    source.addEventListener("done", updateRun);
    source.addEventListener("error", updateRun);
    source.onerror = (event) => {
      const data = (event as MessageEvent<string>).data;

      if (typeof data === "string" && data) {
        updateRun(event as MessageEvent<string>);
        return;
      }

      if (!receivedTerminalEvent) {
        setError("SSE-поток workflow отключён.");
      }
      source.close();
      setLiveRunId(null);
    };

    return () => {
      source.close();
    };
  }, [liveRunId, activeRun?.status]);

  const selectedNode = getSelectedNode(activeRun, selectedNodeKey);
  const selectedNodeDebug = getNodeDebug(selectedNode);
  const flowNodes = buildFlowNodes(activeRun);
  const flowEdges = buildFlowEdges(activeRun);

  async function startWorkflow() {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/workflows/resume-analysis", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim() || undefined,
          modelId: selectedModelId,
        }),
      });
      const body = await readResponseJson(response);

      if (!response.ok) {
        throw new Error(readErrorMessage(body));
      }

      const nextRun = body as WorkflowRunSnapshot;
      setActiveRun(nextRun);
      setSelectedNodeKey(nextRun.nodes[0]?.key ?? null);
      setRuns((currentRuns) => upsertRun(currentRuns, nextRun));
      setLiveRunId(nextRun.id);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Workflow не запущен.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function openRun(runId: string) {
    setError(null);

    try {
      const response = await fetch(`/api/admin/workflows/${runId}`);
      const body = await readResponseJson(response);

      if (!response.ok) {
        throw new Error(readErrorMessage(body));
      }

      const nextRun = body as WorkflowRunSnapshot;
      setActiveRun(nextRun);
      setSelectedNodeKey(nextRun.nodes[0]?.key ?? null);
      setRuns((currentRuns) => upsertRun(currentRuns, nextRun));
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Workflow не загружен.",
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Workflow Debugger
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">read-only</Badge>
            {activeRun ? (
              <Badge variant={statusBadgeVariant[activeRun.status]}>
                {statusLabels[activeRun.status]}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button disabled={isStarting} onClick={startWorkflow}>
          {isStarting ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
          Запустить
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5" size="sm">
          <CardContent className="flex items-center gap-2 text-destructive">
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <Card className="min-h-0" size="sm">
          <CardHeader>
            <CardTitle>Запуск</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Select defaultValue="resume_analysis_v1" disabled>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="resume_analysis_v1">
                    resume_analysis_v1
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select onValueChange={setSelectedModelId} value={selectedModelId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="LLM model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {modelOptions.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} · {model.tier}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Textarea
              className="min-h-48 resize-none font-mono text-xs"
              onChange={(event) => setText(event.target.value)}
              placeholder="TXT резюме. Если пусто, используется demo input."
              value={text}
            />
            <div className="grid gap-2">
              <div className="text-sm font-medium">Последние запуски</div>
              <div className="grid max-h-[26rem] gap-2 overflow-auto pr-1">
                {runs.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Запусков пока нет
                  </div>
                ) : (
                  runs.map((run) => (
                    <button
                      className={cn(
                        "grid gap-1 rounded-lg border p-3 text-left text-sm transition hover:bg-muted/50",
                        activeRun?.id === run.id && "border-foreground",
                      )}
                      key={run.id}
                      onClick={() => void openRun(run.id)}
                      type="button"
                    >
                      <span className="truncate font-mono text-xs">
                        {run.id}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <Badge variant={statusBadgeVariant[run.status]}>
                          {statusLabels[run.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString("ru-RU")}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[36rem]" size="sm">
          <CardHeader>
            <CardTitle>Граф выполнения</CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)] min-h-[32rem]">
            {activeRun ? (
              <ReactFlowProvider>
                <WorkflowGraph
                  edges={flowEdges}
                  nodes={flowNodes}
                  onNodeSelect={setSelectedNodeKey}
                  runId={activeRun.id}
                  runUpdatedAt={activeRun.updatedAt}
                />
              </ReactFlowProvider>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Запустите workflow
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0" size="sm">
          <CardHeader>
            <CardTitle>Результат</CardTitle>
            <CardDescription>
              {activeRun?.id ? `Run ${activeRun.id}` : "Нет активного запуска"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Текущая нода</div>
                <div className="mt-1 font-mono text-xs">
                  {activeRun?.currentNodeKey ?? "-"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Следующая</div>
                <div className="mt-1 font-mono text-xs">
                  {activeRun?.nextNodeKey ?? "-"}
                </div>
              </div>
            </div>
            <JsonBlock value={activeRun?.finalResult ?? activeRun?.error} />
          </CardContent>
        </Card>
      </div>

      <Sheet
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedNodeKey(null);
          }
        }}
        open={Boolean(selectedNode)}
      >
        <SheetContent className="w-full gap-0 overflow-hidden sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selectedNode?.label ?? "Node"}</SheetTitle>
            <SheetDescription>
              {selectedNode?.key ?? "-"} ·{" "}
              {selectedNode ? statusLabels[selectedNode.status] : "-"}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto p-4 pt-0">
            <Tabs defaultValue="overview">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="input">
                  <FileTextIcon />
                  Input
                </TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="error">Error</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
              </TabsList>
              <TabsContent className="grid gap-4" value="overview">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {selectedNodeDebug?.kind ?? "unknown"}
                  </Badge>
                  {selectedNode ? (
                    <Badge variant={statusBadgeVariant[selectedNode.status]}>
                      {statusLabels[selectedNode.status]}
                    </Badge>
                  ) : null}
                </div>
                <DetailRow
                  label="Описание"
                  value={selectedNodeDebug?.description ?? "Нет описания"}
                />
                <DetailRow
                  label="Цель"
                  value={selectedNodeDebug?.goal ?? "Нет цели"}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow
                    label="Started"
                    value={formatDateTime(selectedNode?.startedAt)}
                  />
                  <DetailRow
                    label="Finished"
                    value={formatDateTime(selectedNode?.finishedAt)}
                  />
                  <DetailRow
                    label="Duration"
                    value={formatDuration(selectedNode?.durationMs)}
                  />
                  <DetailRow label="Order" value={selectedNode?.order ?? "-"} />
                </div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Reads</div>
                    <TextList items={selectedNodeDebug?.reads ?? []} />
                  </div>
                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Writes</div>
                    <TextList items={selectedNodeDebug?.writes ?? []} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Debug notes</div>
                  <TextList items={selectedNodeDebug?.debugHints ?? []} />
                </div>
              </TabsContent>
              <TabsContent value="input">
                <JsonBlock value={selectedNode?.input} />
              </TabsContent>
              <TabsContent value="output">
                <JsonBlock value={selectedNode?.output} />
              </TabsContent>
              <TabsContent className="grid gap-4" value="prompt">
                {selectedNodeDebug?.kind === "llm" &&
                selectedNodeDebug.prompt ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailRow
                        label="Model"
                        value={selectedNodeDebug.prompt.modelId}
                      />
                      <DetailRow
                        label="Temperature"
                        value={selectedNodeDebug.prompt.temperature ?? "-"}
                      />
                      <DetailRow
                        label="Model policy"
                        value={selectedNodeDebug.prompt.modelPolicy}
                      />
                      <DetailRow
                        label="Schema"
                        value={selectedNodeDebug.prompt.outputSchemaName}
                      />
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm font-medium">System prompt</div>
                      <JsonBlock value={selectedNodeDebug.prompt.system} />
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm font-medium">User prompt</div>
                      <JsonBlock value={selectedNodeDebug.prompt.user} />
                    </div>
                    {selectedNodeDebug.prompt.userTemplate ? (
                      <div className="grid gap-2">
                        <div className="text-sm font-medium">User template</div>
                        <JsonBlock
                          value={selectedNodeDebug.prompt.userTemplate}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Эта нода не вызывает LLM. Логика описана во вкладке
                    Overview.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="error">
                <JsonBlock value={selectedNode?.error} />
              </TabsContent>
              <TabsContent className="grid gap-4" value="schema">
                <DetailRow
                  label="Expected output"
                  value={selectedNodeDebug?.expectedOutput ?? "Нет описания"}
                />
                <DetailRow
                  label="Output schema"
                  value={
                    selectedNodeDebug?.prompt?.outputSchemaName ??
                    "Deterministic JSON contract"
                  }
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
