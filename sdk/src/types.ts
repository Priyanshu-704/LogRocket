export type IssueCategory =
  | 'html'
  | 'css'
  | 'javascript'
  | 'dom'
  | 'performance'
  | 'accessibility'
  | 'seo'
  | 'security'
  | 'code-quality'
  | 'dx';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface IssueLocation {
  line?: number;
  column?: number;
  selector?: string;
  outerHTML?: string;
  fileName?: string;
}

export interface Issue {
  id: string; // Deterministic fingerprint
  category: IssueCategory;
  type: string;
  severity: Severity;
  title: string;
  message: string;
  timestamp: number;
  location?: IssueLocation;
  metadata?: Record<string, any>;
}

export interface RuleConfig {
  enabled: boolean;
  severity?: Severity;
}

export interface AnalyzerConfig {
  projectId: string;
  endpoint?: string;
  environment?: 'development' | 'staging' | 'production';
  debug?: boolean;
  rules?: Record<string, boolean | RuleConfig>;
  collectors?: {
    dom?: boolean;
    css?: boolean;
    errors?: boolean;
    network?: boolean;
    performance?: boolean;
    'static-code'?: boolean;
    security?: boolean;
  };
  sampleRate?: number;
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
  metrics: Record<string, number | string>;
}

export interface Plugin {
  name: string;
  analyze: (analyzer: any) => void;
  destroy?: () => void;
}
