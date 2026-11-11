import { authRequest } from "@/lib/api-client";

export interface WeeklyEntry {
  office: "valencia" | "miami";
  programme_id: string;
  total_material_cost: number;
  kits_delivered_count: number;
  shortage_events_count: number;
  cost_variance_events_count: number;
  currency: "EUR" | "USD";
}

export interface WeeklyReport {
  week_start: string;
  entries: WeeklyEntry[];
}

export interface PipelineRun {
  id: string;
  week_start: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  source_cutoff: string | null;
  events_read: number;
  rows_written: number;
  error_code: string | null;
}

export function getWeeklyReport(week?: string): Promise<WeeklyReport> {
  return authRequest<WeeklyReport>(`/reporting/weekly-office-program-performance${week ? `?week_start=${encodeURIComponent(week)}` : ""}`);
}

export function getLatestPipelineRun(): Promise<PipelineRun> {
  return authRequest<PipelineRun>("/reporting/pipeline-runs/latest");
}

export function triggerPipeline(week?: string): Promise<PipelineRun> {
  return authRequest<PipelineRun>("/reporting/pipeline-runs", {
    method: "POST", body: JSON.stringify({ week_start: week || null }),
  });
}
