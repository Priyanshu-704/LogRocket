export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface IssueLocation {
  line?: number;
  column?: number;
  fileName?: string;
  selector?: string;
  outerHTML?: string;
}

export interface AISuggestion {
  explanation: string;
  fixCode: string;
  referenceUrl: string;
}

export interface Issue {
  id: string;
  category: string;
  type: string;
  severity: Severity;
  title: string;
  message: string;
  timestamp: number;
  location?: IssueLocation;
  metadata?: Record<string, any>;
  aiSuggestion?: AISuggestion;
}

export interface TelemetryEvent {
  name: string;
  payload: Record<string, any>;
  timestamp: number;
}

export interface Report {
  projectId: string;
  environment: string;
  timestamp: number;
  sdkVersion: string;
  url: string;
  userAgent: string;
  issues: Issue[];
  events: TelemetryEvent[];
  metrics: Record<string, any>;
}

export interface AnalyzerConfig {
  projectId: string;
  apiKey?: string;
  endpoint?: string;
  environment?: 'development' | 'production' | 'staging';
  debug?: boolean;
  sampleRate?: number;
  collectors?: {
    dom?: boolean;
    css?: boolean;
    errors?: boolean;
    network?: boolean;
    performance?: boolean;
    'static-code'?: boolean;
    security?: boolean;
  };
  rules?: Record<string, boolean | { enabled?: boolean; severity?: Severity }>;
}

export interface Plugin {
  name: string;
  analyze(analyzer: any): void;
  destroy?(): void;
}
