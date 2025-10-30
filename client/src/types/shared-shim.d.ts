declare module "@shared/schema" {
  export type SystemStatus = { services?: { id: string; status: "ok" | "degraded" | "down" }[] };
  export type ProjectTheme = Record<string, unknown>;
  export type Settings = Record<string, unknown>;
  export type BuildStage = string;
  export type BuildLogEntry = any;
  export type BuildStageTrace = { logs: BuildLogEntry[]; artifacts: any[] };
  export type BuildTrace = { stages: BuildStageTrace[] };
}
