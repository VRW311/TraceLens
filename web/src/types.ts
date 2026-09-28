export interface Event {
  line: number;
  time: number;
  timestamp: string;
  level: string;
  service: string;
  event: string;
  trace: string;
  duration: number | null;
  status: number | null;
  message: string;
}
export interface Report {
  ok: boolean;
  error: string;
  accepted: number;
  rejected: number;
  services: string[];
  diagnostics: { line: number; reason: string }[];
  start: number | null;
  end: number | null;
  findings: { title: string; detail: string; lines: number[] }[];
}
export interface Query {
  service: string;
  level: string;
  search: string;
  trace: string;
  from: string;
  to: string;
  offset: number;
  limit: number;
}
export interface Result {
  summary: {
    events: number;
    errors: number;
    warnings: number;
    traces: number;
    failed: number;
    requests: number;
    p95: number | null;
  };
  rows: Event[];
  bucketWidth: number;
  buckets: { start: number; count: number; errors: number }[];
}
