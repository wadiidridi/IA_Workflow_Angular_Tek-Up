import { Component, OnInit, computed, inject, signal, OnDestroy, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WorkflowService } from '../services/workflow.service';
import { RunService } from '../services/run.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { Workflow, WorkflowNode, Run, RunStep } from '../models';

type NodeStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

interface NodeStatusMap {
  [nodeId: string]: NodeStatus;
}

interface StepView {
  id: string;
  nodeId: string;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  durationMs?: number;
  inputPreview?: unknown;
  outputPreview?: unknown;
  errorMessage?: string;
  logs?: string[];
}

type LogLevel = 'info' | 'success' | 'error' | 'warn';

interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
}

@Component({
  selector: 'app-workflow-playground',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PageHeadingComponent],
  templateUrl: './workflow-playground.component.html',
  styleUrls: ['./workflow-playground.component.scss'],
})
export class WorkflowPlaygroundComponent implements OnInit, OnDestroy {
  private workflowService = inject(WorkflowService);
  private runService = inject(RunService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  workflowId = this.route.snapshot.paramMap.get('id');
  workflow = signal<Workflow | null>(null);
  prompt = signal('');
  running = signal(false);
  currentRun = signal<Run | null>(null);
  steps = signal<StepView[]>([]);
  logs = signal<LogEntry[]>([]);
  nodeStatusMap = signal<NodeStatusMap>({});
  eventSource: EventSource | null = null;
  private finalLogsHydratedForRunId: string | null = null;

  @ViewChild('logsEnd') logsEnd?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      // auto-scroll to bottom whenever logs update
      this.logs();
      setTimeout(() => {
        this.logsEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    });
  }

  nodeStatus = computed(() => {
    const map: NodeStatusMap = {};
    this.workflow()?.nodes.forEach(node => {
      map[node.id] = 'PENDING';
    });
    return { ...map, ...this.nodeStatusMap() };
  });

  ngOnInit() {
    if (this.workflowId) {
      this.workflowService.getWorkflow(this.workflowId).subscribe({
        next: (wf: Workflow) => this.workflow.set(wf),
        error: (err) => this.addLog(`[ERROR] Impossible de charger le workflow: ${err?.message || 'inconnu'}`)
      });
    }
  }

  onPromptInput(event: Event) {
    const target = event.target as HTMLTextAreaElement | null;
    this.prompt.set(target?.value ?? '');
  }

  runButtonLabel(): string {
    if (this.running()) return 'Exécution en cours...';
    if (this.currentRun()) return '↺ Relancer';
    return '▶ Lancer l\'exécution';
  }

  ngOnDestroy() {
    this.eventSource?.close();
  }

  executeWorkflow() {
    if (!this.workflow() || !this.prompt().trim()) return;

    // Reset all state for re-run
    this.running.set(true);
    this.logs.set([]);
    this.steps.set([]);
    this.currentRun.set(null);
    this.nodeStatusMap.set({});
    this.finalLogsHydratedForRunId = null;
    this.eventSource?.close();

    const workflowId = this.workflowId;
    const promptText = this.prompt();

    this.runService.startRun({ workflowId: workflowId!, prompt: promptText }).subscribe({
      next: (run: Run) => {
        this.currentRun.set(run);
        this.addLog('Exécution lancée...', 'info');
        this.startRunStream(run.id);
      },
      error: (err: any) => {
        this.running.set(false);
        this.addLog(err.message || 'Erreur lors de l\'exécution', 'error');
      }
    });
  }

  private startRunStream(runId: string) {
    this.eventSource?.close();
    this.eventSource = this.runService.streamRunProgress(runId);

    this.eventSource.onmessage = (event: MessageEvent<string>) => {
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch {
        this.addLog('Événement de log invalide reçu du serveur.', 'warn');
        return;
      }

      const type = payload?.type as string | undefined;
      const data = (payload?.data || {}) as Record<string, any>;

      if (type === 'init') {
        const run = payload?.run as Run | undefined;
        if (run) {
          this.currentRun.set(run);
          this.running.set(run.status === 'PENDING' || run.status === 'RUNNING');
        }

        const initialSteps = Array.isArray(payload?.steps) ? payload.steps : [];
        const mappedSteps: StepView[] = initialSteps.map((step: any) => ({
          id: step.id,
          nodeId: step.nodeId,
          label: this.findNodeLabel(step.nodeId),
          status: step.status,
          durationMs: step.durationMs,
          inputPreview: step.inputPreview,
          outputPreview: step.outputPreview,
          errorMessage: step.error,
          logs: Array.isArray(step.logs) ? step.logs.map((item: unknown) => String(item)) : []
        }));
        this.steps.set(mappedSteps);

        const initialStatuses: NodeStatusMap = {};
        for (const step of mappedSteps) {
          initialStatuses[step.nodeId] = step.status;
        }
        this.nodeStatusMap.update((current) => ({ ...current, ...initialStatuses }));

        for (const step of initialSteps) {
          const stepLogs = Array.isArray(step?.logs) ? step.logs : [];
          for (const line of stepLogs) {
            this.addLog(`${this.findNodeLabel(step.nodeId)}: ${String(line)}`, 'info');
          }
        }

        if (run && (run.status === 'SUCCESS' || run.status === 'FAILED')) {
          this.syncRunDetails(run.id);
        }
        return;
      }

      if (type === 'step:start') {
        const nodeId = String(data['nodeId'] || '');
        const label = String(data['label'] || this.findNodeLabel(nodeId));
        this.updateNodeStatus(nodeId, 'RUNNING');
        this.upsertStep(nodeId, label, 'RUNNING');
        this.addLog(`${label} démarré`, 'info');
        return;
      }

      if (type === 'step:log') {
        const nodeId = String(data['nodeId'] || '');
        const label = this.findNodeLabel(nodeId);
        const lines = Array.isArray(data['logs']) ? data['logs'] : [];
        this.upsertStep(nodeId, label, this.nodeStatus()[nodeId] || 'RUNNING', undefined, {
          logs: lines.map((line) => String(line))
        });
        for (const line of lines) {
          this.addLog(`${label}: ${String(line)}`, 'info');
        }
        return;
      }

      if (type === 'step:complete') {
        const nodeId = String(data['nodeId'] || '');
        const label = String(data['label'] || this.findNodeLabel(nodeId));
        const durationMs = Number(data['durationMs'] || 0);
        this.updateNodeStatus(nodeId, 'SUCCESS');
        this.upsertStep(nodeId, label, 'SUCCESS', durationMs, {
          outputPreview: data['outputs'],
          logs: []
        });
        this.addLog(`${label} terminé (${durationMs}ms)`, 'success');
        return;
      }

      if (type === 'step:error') {
        const nodeId = String(data['nodeId'] || '');
        const label = String(data['label'] || this.findNodeLabel(nodeId));
        this.updateNodeStatus(nodeId, 'FAILED');
        this.upsertStep(nodeId, label, 'FAILED', undefined, {
          errorMessage: String(data['error'] || 'Erreur inconnue')
        });
        this.addLog(`${label} en échec: ${String(data['error'] || 'Erreur inconnue')}`, 'error');
        return;
      }

      if (type === 'run:complete') {
        const durationMs = Number(data['durationMs'] || 0);
        this.running.set(false);
        this.currentRun.update((run) => (run ? { ...run, status: 'SUCCESS', durationMs } : run));
        this.addLog(`Exécution terminée avec succès (${durationMs}ms)`, 'success');
        this.syncRunDetails(runId);
        this.eventSource?.close();
        this.eventSource = null;
        return;
      }

      if (type === 'run:error') {
        this.running.set(false);
        this.currentRun.update((run) => (run ? { ...run, status: 'FAILED' } : run));
        this.addLog(String(data['error'] || 'Exécution terminée en échec.'), 'error');
        this.syncRunDetails(runId);
        this.eventSource?.close();
        this.eventSource = null;
      }
    };

    this.eventSource.onerror = () => {
      if (this.running()) {
        this.addLog('Connexion temps réel interrompue.', 'warn');
        this.syncRunDetails(runId);
      }
    };
  }

  private syncRunDetails(runId: string) {
    this.runService.getRun(runId).subscribe({
      next: (run: Run) => {
        this.currentRun.set(run);

        const runSteps = run.steps || [];
        const mappedSteps: StepView[] = runSteps.map((step: RunStep) => ({
          id: step.id,
          nodeId: step.nodeId,
          label: this.findNodeLabel(step.nodeId),
          status: step.status,
          durationMs: step.durationMs,
          inputPreview: step.inputPreview,
          outputPreview: step.outputPreview,
          logs: step.logs?.map((line) => String(line)) || []
        }));
        this.steps.set(mappedSteps);

        const finalStatuses: NodeStatusMap = {};
        for (const step of mappedSteps) {
          finalStatuses[step.nodeId] = step.status;
        }
        this.nodeStatusMap.update((current) => ({ ...current, ...finalStatuses }));

        if (this.finalLogsHydratedForRunId !== runId) {
          for (const step of runSteps) {
            const label = this.findNodeLabel(step.nodeId);
            for (const line of step.logs || []) {
              const message = `${label}: ${String(line)}`;
              this.addLog(message, 'info');
            }
          }
          this.finalLogsHydratedForRunId = runId;
        }
      },
      error: () => {
        this.addLog('Impossible de récupérer le détail complet du run.', 'warn');
      }
    });
  }

  private updateNodeStatus(nodeId: string, status: NodeStatus) {
    this.nodeStatusMap.update((current) => ({ ...current, [nodeId]: status }));
  }

  private addLog(message: string, level: LogLevel = 'info') {
    const now = new Date();
    const time = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    this.logs.set([...this.logs(), { time, level, message }]);
  }

  private upsertStep(
    nodeId: string,
    label: string,
    status: StepView['status'],
    durationMs?: number,
    meta?: Partial<Pick<StepView, 'inputPreview' | 'outputPreview' | 'errorMessage' | 'logs'>>
  ) {
    const existing = this.steps();
    const index = existing.findIndex((step) => step.nodeId === nodeId);
    const next: StepView = {
      id: nodeId,
      nodeId,
      label,
      status,
      durationMs,
      inputPreview: meta?.inputPreview,
      outputPreview: meta?.outputPreview,
      errorMessage: meta?.errorMessage,
      logs: meta?.logs ?? []
    };

    if (index >= 0) {
      const copy = [...existing];
      const existingLogs = copy[index].logs ?? [];
      const incomingLogs = next.logs ?? [];
      const mergedLogs = incomingLogs.length > 0 ? [...existingLogs, ...incomingLogs] : existingLogs;
      copy[index] = {
        ...copy[index],
        ...next,
        durationMs: durationMs ?? copy[index].durationMs,
        logs: mergedLogs
      };
      this.steps.set(copy);
      return;
    }

    this.steps.set([...existing, next]);
  }

  prettyJson(value: unknown): string {
    if (value === undefined || value === null) return 'Aucune donnée';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  formatStepLogs(logs?: string[]): string {
    if (!logs || logs.length === 0) return 'Aucun log';
    return logs.join('\n');
  }

  statusLabel(status: StepView['status']): string {
    if (status === 'SUCCESS') return 'Reussi';
    if (status === 'FAILED') return 'Echec';
    if (status === 'RUNNING') return 'En cours';
    if (status === 'SKIPPED') return 'Ignore';
    return 'En attente';
  }

  private findNodeLabel(nodeId: string): string {
    return this.workflow()?.nodes.find((node) => node.id === nodeId)?.label || nodeId;
  }

  generateEdgePath(edge: any): string {
    const sourceNode = this.workflow()?.nodes.find(n => n.id === edge.source);
    const targetNode = this.workflow()?.nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return '';

    const x1 = sourceNode.position.x + 220;
    const y1 = sourceNode.position.y + 40;
    const x2 = targetNode.position.x;
    const y2 = targetNode.position.y + 40;

    const dx = (x2 - x1) * 0.3;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }

  goBack() {
    this.router.navigate(['/workflows']);
  }
}
