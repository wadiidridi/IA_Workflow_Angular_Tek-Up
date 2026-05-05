import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService } from './auth.service';
import {
  Agent, AgentCreate, Workflow, WorkflowCreate, Run, RunCreate,
  KpiData, ValidationResult, PaginatedResponse, User
} from '../models';

const API_BASE = '/api';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private getAuthHeaders() {
    const token = this.auth.tokenValue;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
  }

  private buildParams(query: Record<string, unknown> = {}) {
    return Object.entries(query).reduce((params, [key, value]) => {
      if (value === undefined || value === null) {
        return params;
      }

      if (Array.isArray(value)) {
        return value.reduce((inner, item) => inner.append(key, String(item)), params);
      }

      return params.append(key, String(value));
    }, new HttpParams());
  }

  // ==================== AUTH ====================
  login(credentials: { email: string; password: string }) {
    return this.http.post<{ user: User; token: string }>(`${API_BASE}/auth/login`, credentials);
  }

  register(payload: { email: string; password: string }) {
    return this.http.post<{ user: User; token: string }>(`${API_BASE}/auth/register`, payload);
  }

  getCurrentUser() {
    return this.http.get<User>(`${API_BASE}/auth/me`, { headers: this.getAuthHeaders() });
  }

  // ==================== AGENTS ====================
  getAgents(params?: {
    search?: string;
    family?: string;
    active?: boolean;
    sort?: 'name' | 'family' | 'createdAt' | 'version';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const query = {
      ...params,
      status: params?.active === undefined ? undefined : (params.active ? 'active' : 'inactive'),
      sortBy: params?.sort
    };
    delete (query as Record<string, unknown>)['active'];
    delete (query as Record<string, unknown>)['sort'];

    return this.http.get<PaginatedResponse<Agent>>(`${API_BASE}/agents`, {
      headers: this.getAuthHeaders(),
      params: this.buildParams(query)
    });
  }

  getAgent(id: string) {
    return this.http.get<Agent>(`${API_BASE}/agents/${id}`, { headers: this.getAuthHeaders() });
  }

  createAgent(payload: AgentCreate) {
    return this.http.post<Agent>(`${API_BASE}/agents`, payload, { headers: this.getAuthHeaders() });
  }

  updateAgent(id: string, payload: AgentCreate) {
    return this.http.put<Agent>(`${API_BASE}/agents/${id}`, payload, { headers: this.getAuthHeaders() });
  }

  deleteAgent(id: string) {
    return this.http.delete(`${API_BASE}/agents/${id}`, { headers: this.getAuthHeaders() });
  }

  // ==================== WORKFLOWS ====================
  getWorkflows(params?: {
    search?: string;
    status?: 'DRAFT' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    page?: number;
    limit?: number;
  }) {
    return this.http.get<PaginatedResponse<Workflow>>(`${API_BASE}/workflows`, {
      headers: this.getAuthHeaders(),
      params: this.buildParams(params)
    });
  }

  getWorkflow(id: string) {
    return this.http.get<Workflow>(`${API_BASE}/workflows/${id}`, { headers: this.getAuthHeaders() });
  }

  createWorkflow(payload: WorkflowCreate) {
    return this.http.post<Workflow>(`${API_BASE}/workflows`, payload, { headers: this.getAuthHeaders() });
  }

  updateWorkflow(id: string, payload: WorkflowCreate) {
    return this.http.put<Workflow>(`${API_BASE}/workflows/${id}`, payload, { headers: this.getAuthHeaders() });
  }

  deleteWorkflow(id: string) {
    return this.http.delete(`${API_BASE}/workflows/${id}`, { headers: this.getAuthHeaders() });
  }

  validateWorkflow(id: string) {
    return this.http.post<ValidationResult>(`${API_BASE}/workflows/${id}/validate`, {}, { headers: this.getAuthHeaders() });
  }

  // ==================== RUNS ====================
  startRun(payload: RunCreate) {
    return this.http.post<Run>(`${API_BASE}/runs`, payload, { headers: this.getAuthHeaders() });
  }

  getRuns(params?: {
    workflowId?: string;
    status?: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    page?: number;
    limit?: number;
  }) {
    return this.http.get<PaginatedResponse<Run>>(`${API_BASE}/runs`, {
      headers: this.getAuthHeaders(),
      params: this.buildParams(params)
    });
  }

  getRun(id: string) {
    return this.http.get<Run>(`${API_BASE}/runs/${id}`, { headers: this.getAuthHeaders() });
  }

  // ==================== REAL-TIME STREAMING ====================
  streamRunProgress(runId: string): EventSource {
    const token = this.auth.tokenValue;
    const url = `${API_BASE}/runs/${runId}/stream?token=${encodeURIComponent(token ?? '')}`;
    return new EventSource(url);
  }

  // ==================== KPIs ====================
  getKpis() {
    return this.http.get<KpiData>(`${API_BASE}/kpis`, { headers: this.getAuthHeaders() });
  }
}
