// bussola_web/src/utils/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  service: "bussola_web";
  timestamp: string;
  context?: Record<string, unknown>;
}

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel = (import.meta.env.VITE_LOG_LEVEL ?? (import.meta.env.DEV ? "debug" : "warn")) as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[configuredLevel];
}

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "authorization"]);

function sanitize(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    clean[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return clean;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    service: "bussola_web",
    timestamp: new Date().toISOString(),
    context: sanitize(context),
  };

  const fn =
    level === "error" ? console.error
    : level === "warn" ? console.warn
    : level === "debug" ? console.debug
    : console.info;

  fn(JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
