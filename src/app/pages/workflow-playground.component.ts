import { Component, OnInit, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WorkflowService } from '../services/workflow.service';
import { RunService } from '../services/run.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { Workflow, WorkflowNode, Run } from '../models';

type NodeStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

interface NodeStatusMap {
  [nodeId: string]: NodeStatus;
}

@Component({
  selector: 'app-workflow-playground',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PageHeadingComponent],
  template: `
    <app-page-heading
      eyebrow="Playground"
      title="{{ workflow()?.name || 'Exécution du workflow' }}"
      description="Lancez votre workflow et visualisez l'exécution en temps réel avec les statuts de chaque agent."
    ></app-page-heading>

    <section class="playground-toolbar">
      <button (click)="goBack()" class="btn-secondary">← Retour</button>
      <div class="run-status">
        <span *ngIf="currentRun() as run" [ngClass]="'status status-' + run.status.toLowerCase()">
          {{ run.status }}
        </span>
        <span *ngIf="currentRun()?.durationMs as duration" class="duration">{{ duration }}ms</span>
      </div>
    </section>

    <section class="playground-container">
      <!-- Left: Graph -->
      <main class="graph-area">
        <div class="graph-toolbar">
          <div class="graph-info">
            <span>{{ workflow()?.nodes?.length || 0 }} agents</span>
            <span>{{ workflow()?.edges?.length || 0 }} liaisons</span>
          </div>
        </div>

        <svg class="execution-graph" #executionGraph>
          <!-- Edges -->
          <g class="edges">
            <path 
              *ngFor="let edge of workflow()?.edges || []"
              [attr.d]="generateEdgePath(edge)"
              class="edge-line"
              stroke="#0b82f7"
              stroke-width="2.5"
              fill="none"
            />
          </g>
        </svg>

        <!-- Nodes with status -->
        <div class="nodes-execution">
          <div 
            *ngFor="let node of workflow()?.nodes || []"
            class="exec-node"
            [class.status-pending]="nodeStatus()[node.id] === 'PENDING'"
            [class.status-running]="nodeStatus()[node.id] === 'RUNNING'"
            [class.status-success]="nodeStatus()[node.id] === 'SUCCESS'"
            [class.status-failed]="nodeStatus()[node.id] === 'FAILED'"
            [class.status-skipped]="nodeStatus()[node.id] === 'SKIPPED'"
            [style.left.px]="node.position.x"
            [style.top.px]="node.position.y"
          >
            <div class="node-body">
              <div class="node-status-icon">
                <span *ngIf="nodeStatus()[node.id] === 'PENDING'">⏳</span>
                <span *ngIf="nodeStatus()[node.id] === 'RUNNING'">⚙️</span>
                <span *ngIf="nodeStatus()[node.id] === 'SUCCESS'">✓</span>
                <span *ngIf="nodeStatus()[node.id] === 'FAILED'">✕</span>
                <span *ngIf="nodeStatus()[node.id] === 'SKIPPED'">⊘</span>
              </div>
              <div class="node-content">
                <strong>{{ node.label }}</strong>
                <small>{{ nodeStatus()[node.id] || 'PENDING' }}</small>
              </div>
            </div>
            
            <!-- Handles -->
            <div class="handle handle-left"></div>
            <div class="handle handle-right"></div>
          </div>
        </div>

        <div class="canvas-grid"></div>
      </main>

      <!-- Right: Control & Logs -->
      <aside class="control-panel">
        <!-- Execution Controls -->
        <div class="panel-section control-section">
          <h3>Lancer l'exécution</h3>
          
          <textarea
            placeholder="Entrez votre prompt ou contenu à traiter..."
            [value]="prompt()"
            (input)="onPromptInput($event)"
            [disabled]="running()"
            rows="6"
            class="prompt-input"
          ></textarea>

          <div class="char-count">{{ prompt().length }} / 50,000</div>

          <button 
            (click)="executeWorkflow()"
            [disabled]="running() || !prompt().trim() || !workflow()"
            class="btn-run full-width"
          >
            <span *ngIf="running()" class="spin-icon">&#9696;</span>
            {{ runButtonLabel() }}
          </button>
        </div>

        <!-- Steps -->
        <div class="panel-section steps-section">
          <h4>Étapes ({{ steps().length }})</h4>
          <div class="steps-list">
            <div *ngFor="let step of steps()" [ngClass]="'step step-' + step.status.toLowerCase()">
              <span class="step-label">{{ step.nodeId }}</span>
              <span class="step-status">{{ step.status }}</span>
              <span class="step-duration" *ngIf="step.durationMs">{{ step.durationMs }}ms</span>
            </div>
            <div *ngIf="steps().length === 0" class="empty-list">Aucune étape exécutée</div>
          </div>
        </div>

        <!-- Logs -->
        <div class="panel-section logs-section flex-1">
          <h4>Logs</h4>
          <div class="logs-output">
            <div *ngFor="let log of logs()" class="log-line">{{ log }}</div>
            <div *ngIf="logs().length === 0" class="empty-logs">En attente d'exécution...</div>
            <div #logsEnd></div>
          </div>
        </div>
      </aside>
    </section>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .playground-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid rgba(186, 230, 253, 0.12);
      background: rgba(9, 20, 35, 0.78);
      backdrop-filter: blur(16px);
    }

    .run-status {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .status {
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .status-pending { background: rgba(156, 163, 175, 0.18); color: #d1d5db; }
    .status-running { background: rgba(59, 130, 246, 0.18); color: #93c5fd; animation: pulse 1s infinite; }
    .status-success { background: rgba(22, 163, 74, 0.18); color: #86efac; }
    .status-failed { background: rgba(239, 68, 68, 0.18); color: #fecaca; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .duration {
      font-size: 0.8rem;
      color: #9fb0c2;
    }

    button {
      padding: 0.6rem 1rem;
      border-radius: 0.6rem;
      border: none;
      background: rgba(59, 130, 246, 0.18);
      color: #bfdbfe;
      cursor: pointer;
      font-weight: 700;
    }

    .btn-run {
      background: linear-gradient(135deg, #2dd4bf, #facc15);
      color: #07111f;
      font-size: 1rem;
      padding: 0.85rem 1rem;
      border-radius: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .btn-run:not(:disabled):hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .btn-run:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @keyframes spin-anim {
      to { transform: rotate(360deg); }
    }

    .spin-icon {
      display: inline-block;
      animation: spin-anim 0.8s linear infinite;
    }

    .btn-secondary {
      background: rgba(107, 114, 128, 0.18);
      color: #d1d5db;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .playground-container {
      display: grid;
      grid-template-columns: 1fr 320px;
      height: calc(100vh - 180px);
      gap: 1px;
      background: rgba(15, 23, 42, 0.5);
    }

    .graph-area {
      position: relative;
      background: linear-gradient(135deg, rgba(9,20,35,0.9) 0%, rgba(15,23,42,0.8) 100%);
      border-right: 1px solid rgba(186, 230, 253, 0.12);
      overflow: hidden;
    }

    .graph-toolbar {
      position: absolute;
      top: 1rem;
      left: 1rem;
      z-index: 100;
      background: rgba(9, 20, 35, 0.95);
      padding: 0.75rem 1rem;
      border-radius: 0.6rem;
      border: 1px solid rgba(186, 230, 253, 0.12);
    }

    .graph-info {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #cbd5e1;
    }

    .canvas-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(186, 230, 253, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(186, 230, 253, 0.05) 1px, transparent 1px);
      background-size: 30px 30px;
      pointer-events: none;
    }

    .execution-graph {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
    }

    .edge-line {
      filter: drop-shadow(0 0 4px rgba(11, 130, 247, 0.3));
    }

    .nodes-execution {
      position: relative;
      width: 100%;
      height: 100%;
      z-index: 10;
    }

    .exec-node {
      position: absolute;
      min-width: 220px;
      background: rgba(15, 23, 42, 0.95);
      border-radius: 0.8rem;
      padding: 0.75rem;
      box-shadow: 0 10px 40px rgba(2, 6, 23, 0.6);
      transition: all 0.3s;
    }

    .exec-node.status-pending {
      border: 2px solid rgba(156, 163, 175, 0.3);
    }

    .exec-node.status-running {
      border: 2px solid rgba(59, 130, 246, 0.8);
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    }

    .exec-node.status-success {
      border: 2px solid rgba(34, 197, 94, 0.8);
      background: rgba(20, 83, 37, 0.2);
    }

    .exec-node.status-failed {
      border: 2px solid rgba(239, 68, 68, 0.8);
      background: rgba(127, 29, 29, 0.2);
    }

    .exec-node.status-skipped {
      border: 2px solid rgba(107, 114, 128, 0.3);
      opacity: 0.6;
    }

    .node-body {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .node-status-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .node-content {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }

    .node-content strong {
      color: #f8fafc;
      font-size: 0.95rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node-content small {
      color: #9fb0c2;
      font-size: 0.75rem;
    }

    .handle {
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #0b82f7;
      border: 2px solid #07111f;
      top: 50%;
      transform: translateY(-50%);
    }

    .handle-left {
      left: -8px;
    }

    .handle-right {
      right: -8px;
    }

    .control-panel {
      background: rgba(9, 20, 35, 0.78);
      border: 1px solid rgba(186, 230, 253, 0.12);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .panel-section {
      padding: 1rem;
      border-bottom: 1px solid rgba(186, 230, 253, 0.12);
    }

    .panel-section h3, .panel-section h4 {
      margin: 0 0 0.75rem 0;
      color: #f8fafc;
      font-size: 0.95rem;
    }

    .prompt-input {
      width: 100%;
      padding: 0.75rem;
      border-radius: 0.5rem;
      background: rgba(186, 230, 253, 0.08);
      border: 1px solid rgba(186, 230, 253, 0.16);
      color: #e5eef8;
      font-family: 'Monaco', monospace;
      resize: none;
    }

    .char-count {
      font-size: 0.7rem;
      color: #9fb0c2;
      margin-top: 0.25rem;
      margin-bottom: 0.75rem;
    }

    .full-width {
      width: 100%;
    }

    .steps-section, .logs-section {
      flex-shrink: 0;
    }

    .logs-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .steps-list, .logs-output {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      max-height: 250px;
      overflow-y: auto;
    }

    .logs-section .logs-output {
      flex: 1;
      max-height: none;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 0.5rem;
      padding: 0.6rem;
      border: 1px solid rgba(186, 230, 253, 0.12);
      font-family: 'Monaco', monospace;
      font-size: 0.75rem;
    }

    .step {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      border-radius: 0.4rem;
      background: rgba(186, 230, 253, 0.08);
      border: 1px solid rgba(186, 230, 253, 0.12);
      font-size: 0.8rem;
    }

    .step-label {
      color: #f8fafc;
      font-weight: 600;
    }

    .step-status, .step-duration {
      font-size: 0.7rem;
      color: #9fb0c2;
    }

    .step-pending { border-color: rgba(156, 163, 175, 0.3); }
    .step-running { border-color: rgba(59, 130, 246, 0.5); background: rgba(59, 130, 246, 0.1); }
    .step-success { border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.1); }
    .step-failed { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1); }

    .empty-list, .empty-logs {
      padding: 0.75rem;
      text-align: center;
      color: #9fb0c2;
      font-size: 0.8rem;
    }

    .log-line {
      color: #cbd5e1;
      font-size: 0.7rem;
      word-break: break-word;
    }

    .control-section {
      flex-shrink: 0;
    }

    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(186, 230, 253, 0.05);
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(186, 230, 253, 0.2);
      border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(186, 230, 253, 0.3);
    }

    @media (max-width: 860px) {
      .playground-container {
        grid-template-columns: 1fr;
        grid-template-rows: 60vh auto;
        height: auto;
      }

      .graph-area {
        height: 60vh;
        border-right: none;
        border-bottom: 1px solid rgba(186, 230, 253, 0.12);
      }

      .control-panel {
        max-height: 60vh;
        overflow-y: auto;
      }
    }

    @media (max-width: 480px) {
      .playground-container {
        grid-template-rows: 50vh auto;
      }

      .graph-area {
        height: 50vh;
      }

      .playground-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
      }

      .graph-toolbar {
        font-size: 0.75rem;
        padding: 0.5rem 0.75rem;
      }

      .control-panel {
        max-height: 75vh;
      }
    }
  `]
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
  steps = signal<any[]>([]);
  logs = signal<string[]>([]);
  nodeStatusMap = signal<NodeStatusMap>({});
  eventSource: EventSource | null = null;

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
    this.eventSource?.close();

    const workflowId = this.workflowId;
    const promptText = this.prompt();

    this.runService.startRun({ workflowId: workflowId!, prompt: promptText }).subscribe({
      next: (run: Run) => {
        this.currentRun.set(run);
        this.addLog(`[START] Exécution lancée...`);
        setTimeout(() => {
          this.simulateExecution();
        }, 500);
      },
      error: (err: any) => {
        this.running.set(false);
        this.addLog(`[ERROR] ${err.message || 'Erreur lors de l\'exécution'}`);
      }
    });
  }

  private simulateExecution() {
    // Simuler l'exécution de chaque nœud
    const nodes = this.workflow()?.nodes || [];
    let delay = 1000;

    nodes.forEach((node, index) => {
      setTimeout(() => {
        this.updateNodeStatus(node.id, 'RUNNING');
        this.addLog(`[START] ${node.label}`);

        setTimeout(() => {
          this.updateNodeStatus(node.id, 'SUCCESS');
          this.addLog(`[DONE] ${node.label} (${Math.random() * 500 + 200 | 0}ms)`);
          
          this.steps.set([...this.steps(), {
            id: node.id,
            nodeId: node.id,
            status: 'SUCCESS',
            durationMs: Math.random() * 500 + 200 | 0
          }]);

          if (index === nodes.length - 1) {
            setTimeout(() => {
              this.running.set(false);
              this.addLog(`[COMPLETE] Exécution terminée`);
            }, 500);
          }
        }, 800);
      }, delay);

      delay += 2000;
    });
  }

  private updateNodeStatus(nodeId: string, status: NodeStatus) {
    this.nodeStatusMap.update((current) => ({ ...current, [nodeId]: status }));
  }

  private addLog(message: string) {
    this.logs.set([...this.logs(), message]);
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
