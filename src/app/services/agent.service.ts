import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Agent, AgentCreate } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private readonly api = inject(ApiService);

  getAgents(params?: {
    search?: string;
    family?: string;
    active?: boolean;
    sort?: 'name' | 'family' | 'createdAt' | 'version';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    return this.api.getAgents(params);
  }

  getAgent(id: string) {
    return this.api.getAgent(id);
  }

  createAgent(agent: AgentCreate) {
    return this.api.createAgent(agent);
  }

  updateAgent(id: string, agent: AgentCreate) {
    return this.api.updateAgent(id, agent);
  }

  deleteAgent(id: string) {
    return this.api.deleteAgent(id);
  }
}
