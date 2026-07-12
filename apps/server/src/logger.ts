const blocked = new Set(["token", "displayToken", "playerTokens", "x", "y", "beta", "gamma"]);

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  event: string;
  [key: string]: unknown;
}

export function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => !blocked.has(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]),
  );
}

export function entry(level: LogEntry["level"], event: string, fields: Record<string, unknown> = {}): LogEntry {
  return { time: new Date().toISOString(), level, event, ...sanitize(fields) };
}

export function log(level: LogEntry["level"], event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test" && process.env.TEST_LOGS !== "1") return;
  const line = JSON.stringify(entry(level, event, fields));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
