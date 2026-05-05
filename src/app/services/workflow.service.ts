import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Workflow, WorkflowCreate } from '../models';

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private readonly api = inject(ApiService);

  getWorkflows(params?: {
    search?: string;
    status?: 'DRAFT' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    page?: number;
    limit?: number;
  }) {
    return this.api.getWorkflows(params);
  }

  getWorkflow(id: string) {
    return this.api.getWorkflow(id);
  }

  createWorkflow(workflow: WorkflowCreate) {
    return this.api.createWorkflow(workflow);
  }

  updateWorkflow(id: string, workflow: WorkflowCreate) {
    return this.api.updateWorkflow(id, workflow);
  }

  deleteWorkflow(id: string) {
    return this.api.deleteWorkflow(id);
  }

  validateWorkflow(id: string) {
    return this.api.validateWorkflow(id);
  }
}
