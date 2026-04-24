import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

type ConsoleMethod = "debug" | "info" | "log" | "warn" | "error";
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type OriginalConsoleMethods = Record<ConsoleMethod, (...args: unknown[]) => void>;

type LoggerState = {
  consoleInstalled?: boolean;
  processHooksInstalled?: boolean;
  originalConsole?: OriginalConsoleMethods;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../../../");
const logsDir = path.join(workspaceRoot, "logs");
const serverLogFilePath = path.join(logsDir, "server.log");
const stateKey = Symbol.for("offergo.serverLoggerState");

const globalState = globalThis as typeof globalThis & {
  [stateKey]?: LoggerState;
};

function getLoggerState(): LoggerState {
  if (!globalState[stateKey]) {
    globalState[stateKey] = {};
  }

  return globalState[stateKey];
}

function ensureLogDirectory() {
  mkdirSync(logsDir, {
    recursive: true,
  });
}

function formatArg(arg: unknown) {
  if (arg instanceof Error) {
    return arg.stack ?? `${arg.name}: ${arg.message}`;
  }

  if (typeof arg === "string") {
    return arg;
  }

  return inspect(arg, {
    depth: 6,
    breakLength: Infinity,
    colors: false,
    compact: true,
  });
}

function formatLine(service: string, level: LogLevel, args: unknown[]) {
  return `${new Date().toISOString()} [${service}] [${level}] ${args.map(formatArg).join(" ")}\n`;
}

function appendLine(service: string, level: LogLevel, args: unknown[]) {
  ensureLogDirectory();
  appendFileSync(serverLogFilePath, formatLine(service, level, args), "utf8");
}

function getOriginalConsoleMethods(): OriginalConsoleMethods {
  const state = getLoggerState();

  if (!state.originalConsole) {
    state.originalConsole = {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
  }

  return state.originalConsole;
}

function installConsoleCapture(service: string) {
  const state = getLoggerState();

  if (state.consoleInstalled) {
    return;
  }

  const originalConsole = getOriginalConsoleMethods();

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    appendLine(service, "DEBUG", args);
  };

  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    appendLine(service, "INFO", args);
  };

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    appendLine(service, "INFO", args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    appendLine(service, "WARN", args);
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    appendLine(service, "ERROR", args);
  };

  state.consoleInstalled = true;
}

function installProcessHooks(service: string) {
  const state = getLoggerState();

  if (state.processHooksInstalled) {
    return;
  }

  process.on("warning", (warning) => {
    appendLine(service, "WARN", ["[process] warning", warning]);
  });

  process.on("unhandledRejection", (reason) => {
    appendLine(service, "ERROR", ["[process] unhandledRejection", reason]);
  });

  process.on("uncaughtException", (error) => {
    appendLine(service, "ERROR", ["[process] uncaughtException", error]);
  });

  process.on("beforeExit", (code) => {
    appendLine(service, "INFO", [`[process] beforeExit code=${code}`]);
  });

  process.on("SIGINT", () => {
    appendLine(service, "WARN", ["[process] received SIGINT"]);
  });

  process.on("SIGTERM", () => {
    appendLine(service, "WARN", ["[process] received SIGTERM"]);
  });

  state.processHooksInstalled = true;
}

export type ServerLogger = {
  filePath: string;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export function getServerLogFilePath() {
  ensureLogDirectory();
  return serverLogFilePath;
}

export function createServerLogger(options: {
  service: string;
  resetFile?: boolean;
  captureConsole?: boolean;
}): ServerLogger {
  const { service, resetFile = false, captureConsole = false } = options;
  const originalConsole = getOriginalConsoleMethods();

  ensureLogDirectory();

  if (resetFile) {
    writeFileSync(serverLogFilePath, "", "utf8");
  }

  if (captureConsole) {
    installConsoleCapture(service);
    installProcessHooks(service);
  }

  const emit = (
    level: LogLevel,
    method: ConsoleMethod,
    args: unknown[],
  ) => {
    originalConsole[method](...args);
    appendLine(service, level, args);
  };

  appendLine(service, "INFO", [
    resetFile
      ? `[logger] reset log file at ${serverLogFilePath}`
      : `[logger] attached to ${serverLogFilePath}`,
  ]);

  return {
    filePath: serverLogFilePath,
    debug: (...args: unknown[]) => {
      emit("DEBUG", "debug", args);
    },
    info: (...args: unknown[]) => {
      emit("INFO", "log", args);
    },
    warn: (...args: unknown[]) => {
      emit("WARN", "warn", args);
    },
    error: (...args: unknown[]) => {
      emit("ERROR", "error", args);
    },
  };
}
