// User & Auth Models
export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Agent Models
export interface Agent {
  id: string;
  name: string;
  family: string;
  version: string;
  schemaIn: Record<string, unknown>;
  schemaOut: Record<string, unknown>;
  endpointUrl: string;
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCreate {
  name: string;
  family: string;
  version: string;
  schemaIn: Record<string, unknown>;
  schemaOut: Record<string, unknown>;
  endpointUrl: string;
  secrets?: Record<string, unknown>;
  tags?: string[];
}

// Workflow Models
export interface WorkflowNode {
  id: string;
  agentId: string;
  label: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
  mappingIn?: Record<string, unknown>;
  mappingOut?: Record<string, unknown>;
  errorPolicy: 'STOP' | 'CONTINUE';
  maxRetries?: number;
  backoffMs?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, unknown>;
  version: number;
  status: 'DRAFT' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCreate {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, unknown>;
}

// Run Models
export interface RunStep {
  id: string;
  runId: string;
  nodeId: string;
  agentId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  durationMs?: number;
  logs: string[];
  inputPreview?: Record<string, unknown>;
  outputPreview?: Record<string, unknown>;
  errorPolicy: 'STOP' | 'CONTINUE';
  maxRetries: number;
  retryCount: number;
}

export interface Run {
  id: string;
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  prompt: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  metrics?: Record<string, unknown>;
  error?: string;
  triggeredBy: string;
  workflow?: { name: string };
  steps?: RunStep[];
}

export interface RunCreate {
  workflowId: string;
  prompt: string;
}

// KPI Models
export interface KpiData {
  totalRuns: number;
  successRuns: number;
  successRate: number;
  duration: { avg: number; p50: number; p95: number; max: number };
  errorsByFamily: Array<{ family: string; error_count: number }>;
  topAgents: Array<{ id: string; name: string; family: string; usage_count: number; success_count: number; successRate: number }>;
  durationDistribution: Array<{ bucket: string; count: number }>;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Validation Result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
