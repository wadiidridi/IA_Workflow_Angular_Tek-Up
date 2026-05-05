import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Run, RunCreate } from '../models';

@Injectable({
  providedIn: 'root'
})
export class RunService {
  private readonly api = inject(ApiService);

  startRun(payload: RunCreate) {
    return this.api.startRun(payload);
  }

  getRuns(params?: {
    workflowId?: string;
    status?: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    page?: number;
    limit?: number;
  }) {
    return this.api.getRuns(params);
  }

  getRun(id: string) {
    return this.api.getRun(id);
  }

  streamRunProgress(runId: string): EventSource {
    return this.api.streamRunProgress(runId);
  }
}
