import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Agent, Run, Workflow } from '../models';
import { AgentService } from './agent.service';
import { RunService } from './run.service';
import { WorkflowService } from './workflow.service';

@Injectable({ providedIn: 'root' })
export class AppDataService {
  private readonly workflowService = inject(WorkflowService);
  private readonly agentService = inject(AgentService);
  private readonly runService = inject(RunService);

  readonly workflows = signal<Workflow[]>([]);
  readonly agents = signal<Agent[]>([]);
  readonly runs = signal<Run[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loaded = signal(false);

  readonly activeAgents = computed(() => this.agents().filter((agent) => agent.active));
  readonly recentRuns = computed(() => this.runs().slice(0, 50));

  loadAll(force = false): void {
    if (this.loading() || (this.loaded() && !force)) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      workflows: this.workflowService.getWorkflows({ limit: 100 }),
      agents: this.agentService.getAgents({ active: true, limit: 100, sort: 'name', order: 'asc' }),
      runs: this.runService.getRuns({ limit: 50 })
    }).subscribe({
      next: ({ workflows, agents, runs }) => {
        this.workflows.set(workflows.data);
        this.agents.set(agents.data);
        this.runs.set(runs.data);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les donnees initiales.');
        this.loading.set(false);
      }
    });
  }

  refreshWorkflows(): void {
    this.workflowService.getWorkflows({ limit: 100 }).subscribe({
      next: (response) => this.workflows.set(response.data)
    });
  }

  refreshRuns(): void {
    this.runService.getRuns({ limit: 50 }).subscribe({
      next: (response) => this.runs.set(response.data)
    });
  }

  upsertWorkflow(workflow: Workflow): void {
    this.workflows.update((items) => [workflow, ...items.filter((item) => item.id !== workflow.id)]);
  }

  removeWorkflow(id: string): void {
    this.workflows.update((items) => items.filter((workflow) => workflow.id !== id));
  }

  reset(): void {
    this.workflows.set([]);
    this.agents.set([]);
    this.runs.set([]);
    this.loaded.set(false);
    this.loading.set(false);
    this.error.set(null);
  }
}
