import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WorkflowService } from '../services/workflow.service';
import { AgentService } from '../services/agent.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { Agent, Workflow, WorkflowEdge, WorkflowNode } from '../models';

@Component({
  selector: 'app-workflow-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PageHeadingComponent],
  template: `
    <app-page-heading
      eyebrow="Workflow Editor"
      title="{{ workflowName() || 'Nouveau workflow' }}"
      description="Ajoutez des agents, deplacez les noeuds et reliez-les comme dans la version React."
    ></app-page-heading>

    <section class="editor-toolbar">
      <button class="btn-secondary" (click)="goBack()">Retour</button>
      <div class="toolbar-center">
        <input
          type="text"
          class="workflow-name-input"
          [value]="workflowName()"
          (input)="workflowName.set(getEventValue($event))"
          placeholder="Nom du workflow"
        />
        <span class="badge" *ngIf="workflowId !== 'new'">v{{ workflow()?.version || 1 }}</span>
      </div>
      <div class="toolbar-right">
        <button class="btn-secondary mobile-panel-btn" type="button" (click)="showLeftPanel.set(!showLeftPanel())">☰ Agents</button>
        <button class="btn-secondary mobile-panel-btn" type="button" (click)="showRightPanel.set(!showRightPanel())" *ngIf="selectedNode()">⚙ Config</button>
        <button class="btn-secondary" (click)="validateWorkflow()">Valider</button>
        <button class="btn-primary" (click)="saveWorkflow()" [disabled]="saving()">
          {{ saving() ? 'Sauvegarde...' : 'Save' }}
        </button>
        <button
          class="btn-run"
          *ngIf="workflowId && workflowId !== 'new'"
          (click)="runWorkflow()"
          [disabled]="nodes().length === 0 || saving() || runningWorkflow()"
        >
          {{ runningWorkflow() ? 'Run...' : 'Run' }}
        </button>
      </div>
    </section>

    <section class="workspace">
      <aside class="panel left-panel" [class.mobile-visible]="showLeftPanel()">
        <h3>Agent Palette</h3>
        <input
          type="text"
          class="search-input"
          placeholder="Search agents..."
          [value]="agentSearch()"
          (input)="agentSearch.set(getEventValue($event))"
        />

        <div class="agent-list">
          <button
            *ngFor="let agent of filteredAgents()"
            class="agent-item"
            (click)="addAgentNode(agent)"
          >
            <strong>{{ agent.name }}</strong>
            <small>{{ agent.family }} · v{{ agent.version }}</small>
          </button>
        </div>
      </aside>

      <main class="canvas-panel">
        <div class="canvas-header">
          <span>{{ nodes().length }} nodes</span>
          <span>{{ edges().length }} links</span>
          <span *ngIf="connectingFrom()">Lien: selectionnez une entree bleue...</span>
          <span *ngIf="selectedEdgeId()">Fleche selectionnee: double-cliquez pour supprimer</span>
        </div>

        <div class="canvas" (click)="cancelConnection()">
          <div class="canvas-inner">
          <svg class="edge-layer">
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6"></path>
              </marker>
              <marker id="arrow-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#0ea5e9"></path>
              </marker>
            </defs>
            <ng-container *ngFor="let edge of edgePaths(); trackBy: trackEdge">
              <path
                [attr.d]="edge.path"
                class="edge-hit-path"
                (click)="selectEdge(edge.id); $event.stopPropagation()"
                (dblclick)="removeEdgeById(edge.id); $event.stopPropagation()"
              ></path>
              <path
                [attr.d]="edge.path"
                class="edge-path"
                [class.selected]="selectedEdgeId() === edge.id"
                [attr.stroke-dasharray]="'8 5'"
                [attr.stroke]="selectedEdgeId() === edge.id ? '#0ea5e9' : '#3b82f6'"
                [attr.stroke-width]="selectedEdgeId() === edge.id ? '2.5' : '2'"
                fill="none"
                [attr.marker-end]="selectedEdgeId() === edge.id ? 'url(#arrow-selected)' : 'url(#arrow)'"
              ></path>
            </ng-container>
          </svg>

          <svg class="temp-edge-layer" *ngIf="tempEdgePath()">
            <path [attr.d]="tempEdgePath()" class="temp-edge-path" [attr.stroke-dasharray]="'6 5'" marker-end="url(#arrow)"></path>
          </svg>

          <div
            *ngFor="let node of nodes(); trackBy: trackNode"
            class="node"
            [class.selected]="selectedNode()?.id === node.id"
            [class.connecting]="connectingFrom() === node.id"
            [style.left.px]="node.position.x"
            [style.top.px]="node.position.y"
            (click)="selectNode(node); $event.stopPropagation()"
          >
            <button type="button" class="handle input" (click)="completeConnection(node.id, $event)" (mouseup)="completeConnectionDrag(node.id, $event)" title="Relacher pour connecter"></button>
            <div class="node-body" (mousedown)="startDrag(node.id, $event)">
              <div class="node-title">{{ node.label }}</div>
              <div class="node-subtitle">{{ getAgentLabel(node.agentId) }}</div>
              <div class="node-meta">On error: {{ node.errorPolicy.toLowerCase() }}</div>
            </div>
            <button type="button" class="handle output" (click)="startConnection(node.id, $event)" (mousedown)="startConnectionDrag(node.id, $event)" title="Glisser pour connecter"></button>
            <button type="button" class="remove-node" (click)="removeNode(node.id); $event.stopPropagation()">×</button>
          </div>
          </div><!-- /canvas-inner -->
        </div>
      </main>

      <aside class="panel right-panel" [class.mobile-visible]="showRightPanel()" *ngIf="selectedNode() as node">
        <h3>Node Config</h3>

        <label>
          Label
          <input type="text" [value]="node.label" (input)="setNodeLabel(node, $event)" />
        </label>

        <label>
          Error policy
          <select [ngModel]="node.errorPolicy" (ngModelChange)="setNodeErrorPolicy(node, $event)">
            <option value="STOP">STOP</option>
            <option value="CONTINUE">CONTINUE</option>
          </select>
        </label>

        <label>
          Max retries
          <input type="number" [value]="node.maxRetries ?? 0" (input)="setNodeMaxRetries(node, $event)" />
        </label>

        <div class="hint">
          Tip: cliquez sur la sortie verte d'un noeud puis l'entree bleue d'un autre pour creer une liaison.
        </div>

        <div class="manual-link" *ngIf="nodes().length > 1">
          <label>
            Lier ce noeud vers
            <select [value]="manualLinkTargetId()" (change)="manualLinkTargetId.set(getEventValue($event))">
              <option value="">Choisir la cible...</option>
              <option *ngFor="let candidate of nodes()" [value]="candidate.id" [disabled]="candidate.id === node.id">
                {{ candidate.label }}
              </option>
            </select>
          </label>
          <button type="button" class="btn-secondary" (click)="connectSelectedToTarget()" [disabled]="!manualLinkTargetId()">
            Ajouter la liaison
          </button>
        </div>
      </aside>

      <aside class="panel right-panel" *ngIf="selectedEdge() as edge">
        <h3>Edge Config</h3>
        <label>
          Source
          <select [ngModel]="edge.source" (ngModelChange)="updateSelectedEdgeSource($event)">
            <option *ngFor="let candidate of nodes()" [value]="candidate.id">{{ candidate.label }}</option>
          </select>
        </label>

        <label>
          Cible
          <select [ngModel]="edge.target" (ngModelChange)="updateSelectedEdgeTarget($event)">
            <option *ngFor="let candidate of nodes()" [value]="candidate.id">{{ candidate.label }}</option>
          </select>
        </label>

        <div class="hint">Cliquez une fleche puis modifiez sa source ou sa cible.</div>
        <button type="button" class="btn-secondary" (click)="removeEdgeById(edge.id)">Supprimer cette fleche</button>
      </aside>
    </section>

    <div *ngIf="validationResult()" class="modal-overlay" (click)="validationResult.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>Validation</h3>
        <p *ngIf="validationResult()?.valid" class="success">Workflow valide</p>
        <ul *ngIf="!validationResult()?.valid" class="errors">
          <li *ngFor="let error of validationResult()?.errors">{{ error }}</li>
        </ul>
        <button class="btn-primary" (click)="validationResult.set(null)">Fermer</button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .editor-toolbar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.9rem;
      }

      .toolbar-center {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .toolbar-right {
        display: flex;
        gap: 0.5rem;
      }

      .workflow-name-input {
        width: 100%;
        max-width: 430px;
      }

      .badge {
        background: #f1f5f9;
        color: #334155;
        border-radius: 999px;
        font-size: 0.75rem;
        padding: 0.2rem 0.6rem;
      }

      .workspace {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr) 280px;
        gap: 0.9rem;
      }

      .panel {
        border: 1px solid #e2e8f0;
        border-radius: 0.8rem;
        background: #ffffff;
        padding: 0.8rem;
      }

      .panel h3 {
        margin: 0 0 0.7rem;
        font-size: 0.95rem;
      }

      .left-panel {
        max-height: calc(100vh - 220px);
        overflow: auto;
      }

      .agent-list {
        display: grid;
        gap: 0.45rem;
      }

      .agent-item {
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        border-radius: 0.6rem;
        padding: 0.55rem;
        text-align: left;
        display: grid;
        gap: 0.1rem;
      }

      .agent-item strong {
        font-size: 0.86rem;
        color: #0f172a;
      }

      .agent-item small {
        color: #475569;
      }

      .canvas-panel {
        border: 1px solid #e2e8f0;
        border-radius: 0.8rem;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .canvas-header {
        height: 38px;
        border-bottom: 1px solid #e2e8f0;
        padding: 0 0.7rem;
        display: flex;
        gap: 1rem;
        align-items: center;
        font-size: 0.78rem;
        color: #475569;
      }

      .canvas {
        position: relative;
        flex: 1;
        height: calc(100vh - 280px);
        min-height: 480px;
        overflow: scroll;
        overflow-x: scroll;
        overflow-y: scroll;
        background-image: radial-gradient(#cbd5e1 0.8px, transparent 0.8px);
        background-size: 26px 26px;
        background-color: #f8fafc;
        cursor: default;
        /* Scrollbar styling */
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
      }

      .canvas::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .canvas::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 4px;
      }

      .canvas::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 4px;
      }

      .canvas::-webkit-scrollbar-thumb:hover {
        background: #64748b;
      }

      .canvas::-webkit-scrollbar-corner {
        background: #f1f5f9;
      }

      .canvas-inner {
        position: relative;
        min-width: 2400px;
        min-height: 1600px;
        width: 2400px;
        height: 1600px;
      }

      .edge-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 2400px;
        height: 1600px;
        pointer-events: auto;
        overflow: visible;
      }

      .edge-hit-path {
        fill: none;
        stroke: transparent;
        stroke-width: 14;
        pointer-events: stroke;
        cursor: pointer;
      }

      .edge-path {
        fill: none;
        stroke: #3b82f6;
        stroke-width: 2;
        pointer-events: none;
        transition: stroke 0.15s ease, stroke-width 0.15s ease;
      }

      .edge-path.selected {
        stroke: #0ea5e9;
        stroke-width: 2.5;
        filter: drop-shadow(0 0 4px rgba(14, 165, 233, 0.55));
      }

      .temp-edge-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 2400px;
        height: 1600px;
        pointer-events: none;
      }

      .temp-edge-path {
        fill: none;
        stroke: #10b981;
        stroke-width: 2.5;
        stroke-dasharray: 4 6;
        opacity: 0.7;
      }

      .node {
        position: absolute;
        width: 230px;
        min-height: 84px;
        overflow: visible;
        border-radius: 0.75rem;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }

      .node.selected {
        border-color: #0ea5e9;
      }

      .node.connecting {
        border-color: #22c55e;
      }

      .node-body {
        padding: 0.75rem;
        cursor: grab;
      }

      .node-body:active {
        cursor: grabbing;
      }

      .node-title {
        font-weight: 700;
        font-size: 1.02rem;
        color: #0f172a;
      }

      .node-subtitle {
        margin-top: 0.25rem;
        color: #334155;
        font-size: 0.83rem;
      }

      .node-meta {
        margin-top: 0.4rem;
        color: #64748b;
        font-size: 0.8rem;
      }

      .handle {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 5;
        width: 14px;
        height: 14px;
        min-width: 14px;
        min-height: 14px;
        padding: 0;
        border-radius: 50%;
        border: 2px solid #ffffff;
        cursor: pointer;
      }

      .handle.input {
        left: -8px;
        background: #3b82f6;
      }

      .handle.output {
        right: -8px;
        background: #22c55e;
      }

      .remove-node {
        position: absolute;
        top: -9px;
        right: -9px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid #fff;
        background: #ef4444;
        color: #fff;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 900;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        z-index: 10;
        transition: background 0.15s ease, transform 0.15s ease;
      }

      .remove-node:hover {
        background: #dc2626;
        transform: scale(1.15);
      }

      .right-panel {
        display: grid;
        gap: 0.6rem;
        align-content: start;
      }

      label {
        display: grid;
        gap: 0.25rem;
        font-size: 0.84rem;
        color: #334155;
      }

      input,
      select,
      .search-input {
        width: 100%;
        min-height: 38px;
        border-radius: 0.55rem;
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #0f172a;
        padding: 0.45rem 0.6rem;
      }

      button {
        border: none;
        border-radius: 0.55rem;
        padding: 0.5rem 0.78rem;
        font-weight: 600;
        cursor: pointer;
      }

      .mobile-panel-btn {
        display: none;
      }

      @media (max-width: 1100px) {
        .mobile-panel-btn {
          display: inline-flex;
        }
      }

      .btn-primary {
        background: #0f172a;
        color: #f8fafc;
      }

      .btn-secondary {
        background: #e2e8f0;
        color: #0f172a;
      }

      .btn-run {
        background: #dcfce7;
        color: #166534;
      }

      .hint {
        margin-top: 0.35rem;
        border: 1px dashed #cbd5e1;
        border-radius: 0.55rem;
        padding: 0.55rem;
        font-size: 0.78rem;
        color: #475569;
      }

      .manual-link {
        margin-top: 0.65rem;
        border-top: 1px solid #e2e8f0;
        padding-top: 0.65rem;
        display: grid;
        gap: 0.55rem;
      }

      .modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(7, 17, 31, 0.72);
        backdrop-filter: blur(6px);
        display: grid;
        align-items: start;
        justify-items: center;
        padding-top: 12vh;
        padding-left: 1rem;
        padding-right: 1rem;
        padding-bottom: 1rem;
      }

      .modal {
        width: min(480px, 90vw);
        border-radius: 1.1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        padding: 1.75rem;
        box-shadow: 0 32px 80px rgba(7, 17, 31, 0.45);
        animation: modal-in 0.22s ease both;
      }

      @keyframes modal-in {
        from { opacity: 0; transform: scale(0.94) translateY(-12px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }

      .modal h3 {
        margin: 0 0 1rem;
        font-size: 1.1rem;
        color: #0f172a;
      }

      .errors {
        margin: 0.75rem 0;
        padding-left: 1.1rem;
        color: #991b1b;
        display: grid;
        gap: 0.35rem;
      }

      .success {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.85rem 1rem;
        border-radius: 0.75rem;
        background: rgba(22, 163, 74, 0.1);
        border: 1px solid rgba(22, 163, 74, 0.28);
        color: #166534;
        font-weight: 600;
        margin-bottom: 1rem;
      }

      .success::before {
        content: '\\2713';
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        background: #22c55e;
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 900;
        flex-shrink: 0;
      }

      @media (max-width: 1100px) {
        .workspace {
          grid-template-columns: 220px minmax(0, 1fr);
        }

        .right-panel {
          display: none;
        }

        .right-panel.mobile-visible {
          display: grid;
          position: fixed;
          inset: 0 0 0 auto;
          width: min(300px, 90vw);
          z-index: 200;
          background: #fff;
          padding: 1rem;
          overflow-y: auto;
          box-shadow: -8px 0 40px rgba(0,0,0,0.2);
        }
      }

      @media (max-width: 700px) {
        .workspace {
          grid-template-columns: 1fr;
        }

        .left-panel {
          display: none;
        }

        .left-panel.mobile-visible {
          display: flex;
          flex-direction: column;
          position: fixed;
          inset: 0 auto 0 0;
          width: min(280px, 90vw);
          z-index: 200;
          background: #fff;
          padding: 1rem;
          overflow-y: auto;
          box-shadow: 8px 0 40px rgba(0,0,0,0.2);
        }

        .canvas {
          min-height: calc(100vh - 200px);
          height: calc(100vh - 200px);
        }

        .editor-toolbar {
          flex-wrap: wrap;
        }

        .toolbar-right {
          flex: 1;
          justify-content: flex-end;
        }

        .workflow-name-input {
          max-width: 100%;
        }

        .canvas-header {
          font-size: 0.72rem;
          gap: 0.5rem;
        }
      }
    `
  ]
})
export class WorkflowEditorComponent implements OnInit {
  private workflowService = inject(WorkflowService);
  private agentService = inject(AgentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  workflowId = this.route.snapshot.paramMap.get('id');
  workflow = signal<Workflow | null>(null);
  nodes = signal<WorkflowNode[]>([]);
  edges = signal<WorkflowEdge[]>([]);
  agents = signal<Agent[]>([]);
  agentSearch = signal('');
  workflowName = signal('');
  selectedNode = signal<WorkflowNode | null>(null);
  saving = signal(false);
  runningWorkflow = signal(false);
  validationResult = signal<{ valid: boolean; errors: string[] } | null>(null);
  connectingFrom = signal<string | null>(null);
  manualLinkTargetId = signal('');
  selectedEdgeId = signal<string | null>(null);
  tempEdgePath = signal<string | null>(null);
  showLeftPanel = signal(false);
  showRightPanel = signal(false);
  private dragLinkSourceNodeId: string | null = null;

  private draggingNodeId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  filteredAgents = computed(() => {
    const query = this.agentSearch().toLowerCase().trim();
    return this.agents().filter((a) => `${a.name} ${a.family}`.toLowerCase().includes(query));
  });

  selectedEdge = computed(() => this.edges().find((edge) => edge.id === this.selectedEdgeId()) ?? null);

  edgePaths = computed(() => {
    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    return this.edges()
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return null;
        }

        // Node width is 230px, handles are offset by ±8px
        const x1 = source.position.x + 230 + 8;  // Output handle (right side)
        const y1 = source.position.y + 42;        // Vertical center
        const x2 = target.position.x - 8;         // Input handle (left side)
        const y2 = target.position.y + 42;        // Vertical center
        const dx = Math.max(60, Math.abs(x2 - x1) * 0.35);

        return {
          id: edge.id,
          path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
        };
      })
      .filter((item): item is { id: string; path: string } => !!item);
  });

  ngOnInit() {
    this.agentService.getAgents({ limit: 200 }).subscribe({
      next: (response) => this.agents.set(response.data ?? []),
      error: (err) => console.error('Failed to load agents:', err)
    });

    if (this.workflowId && this.workflowId !== 'new') {
      this.workflowService.getWorkflow(this.workflowId).subscribe({
        next: (wf: Workflow) => {
          this.workflow.set(wf);
          this.nodes.set(wf.nodes ?? []);
          this.edges.set(wf.edges ?? []);
          this.workflowName.set(wf.name);
        },
        error: (err) => console.error('Failed to load workflow:', err)
      });
      return;
    }

    this.workflowName.set('Nouveau workflow');
  }

  getEventValue(event: Event): string {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    return target?.value ?? '';
  }

  getAgentLabel(agentId: string): string {
    const agent = this.agents().find((item) => item.id === agentId);
    return agent ? `${agent.family}.${agent.name}` : agentId;
  }

  trackNode(_: number, node: WorkflowNode) {
    return node.id;
  }

  trackEdge(_: number, edge: { id: string; path: string }) {
    return edge.id;
  }

  addAgentNode(agent: Agent) {
    const index = this.nodes().length;
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}-${index}`,
      agentId: agent.id,
      label: agent.name,
      position: { x: 80 + (index % 3) * 270, y: 80 + Math.floor(index / 3) * 140 },
      config: {},
      mappingIn: {},
      mappingOut: {},
      errorPolicy: 'STOP',
      maxRetries: 0,
      backoffMs: 1000
    };

    this.nodes.update((prev) => [...prev, newNode]);
    this.selectedNode.set(newNode);
  }

  selectNode(node: WorkflowNode) {
    this.selectedNode.set(node);
    this.selectedEdgeId.set(null);
    this.manualLinkTargetId.set('');
  }

  selectEdge(edgeId: string) {
    this.selectedEdgeId.set(edgeId);
    this.selectedNode.set(null);
    this.manualLinkTargetId.set('');
  }

  removeNode(nodeId: string) {
    this.nodes.update((prev) => prev.filter((n) => n.id !== nodeId));
    this.edges.update((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (this.selectedEdge() && (this.selectedEdge()!.source === nodeId || this.selectedEdge()!.target === nodeId)) {
      this.selectedEdgeId.set(null);
    }
    if (this.selectedNode()?.id === nodeId) {
      this.selectedNode.set(null);
    }
    if (this.connectingFrom() === nodeId) {
      this.connectingFrom.set(null);
    }
  }

  startConnection(nodeId: string, event: MouseEvent) {
    event.stopPropagation();
    this.connectingFrom.set(nodeId);
  }

  completeConnection(targetNodeId: string, event: MouseEvent) {
    event.stopPropagation();
    const sourceNodeId = this.connectingFrom();
    if (!sourceNodeId || sourceNodeId === targetNodeId) {
      this.connectingFrom.set(null);
      return;
    }

    this.createConnection(sourceNodeId, targetNodeId);
    this.connectingFrom.set(null);
  }

  connectSelectedToTarget() {
    const sourceNodeId = this.selectedNode()?.id;
    const targetNodeId = this.manualLinkTargetId();
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return;
    }

    this.createConnection(sourceNodeId, targetNodeId);
    this.manualLinkTargetId.set('');
  }

  private createConnection(sourceNodeId: string, targetNodeId: string) {
    const edge: WorkflowEdge = {
      id: `edge-${Date.now()}`,
      source: sourceNodeId,
      target: targetNodeId
    };

    const nextEdges = [...this.edges(), edge];
    if (this.hasCycle(this.nodes(), nextEdges)) {
      this.validationResult.set({ valid: false, errors: ['Cette liaison cree une boucle.'] });
      this.connectingFrom.set(null);
      return;
    }

    const duplicate = this.edges().some((item) => item.source === sourceNodeId && item.target === targetNodeId);
    if (!duplicate) {
      this.edges.set(nextEdges);
    }
  }

  cancelConnection() {
    this.connectingFrom.set(null);
    this.selectedEdgeId.set(null);
  }

  removeEdgeById(edgeId: string) {
    this.edges.update((prev) => prev.filter((e) => e.id !== edgeId));
    if (this.selectedEdgeId() === edgeId) {
      this.selectedEdgeId.set(null);
    }
  }

  updateSelectedEdgeSource(sourceId: string) {
    const edge = this.selectedEdge();
    if (!edge || !sourceId || sourceId === edge.source) {
      return;
    }
    this.updateSelectedEdge(sourceId, edge.target);
  }

  updateSelectedEdgeTarget(targetId: string) {
    const edge = this.selectedEdge();
    if (!edge || !targetId || targetId === edge.target) {
      return;
    }
    this.updateSelectedEdge(edge.source, targetId);
  }

  private updateSelectedEdge(sourceId: string, targetId: string) {
    const edge = this.selectedEdge();
    if (!edge || sourceId === targetId) {
      this.validationResult.set({ valid: false, errors: ['Une fleche ne peut pas relier un noeud a lui-meme.'] });
      return;
    }

    const duplicate = this.edges().some((item) => item.id !== edge.id && item.source === sourceId && item.target === targetId);
    if (duplicate) {
      this.validationResult.set({ valid: false, errors: ['Cette fleche existe deja.'] });
      return;
    }

    const nextEdges = this.edges().map((item) =>
      item.id === edge.id
        ? { ...item, source: sourceId, target: targetId }
        : item
    );

    if (this.hasCycle(this.nodes(), nextEdges)) {
      this.validationResult.set({ valid: false, errors: ['Cette modification cree une boucle.'] });
      return;
    }

    this.edges.set(nextEdges);
  }

  setNodeLabel(node: WorkflowNode, event: Event) {
    const nextLabel = this.getEventValue(event);
    this.nodes.update((prev) => prev.map((item) => (item.id === node.id ? { ...item, label: nextLabel } : item)));
    this.refreshSelectedNode(node.id);
  }

  setNodeErrorPolicy(node: WorkflowNode, value: string) {
    const nextPolicy = value === 'CONTINUE' ? 'CONTINUE' : 'STOP';
    this.nodes.update((prev) => prev.map((item) => (item.id === node.id ? { ...item, errorPolicy: nextPolicy } : item)));
    this.refreshSelectedNode(node.id);
  }

  setNodeMaxRetries(node: WorkflowNode, event: Event) {
    const parsed = Number.parseInt(this.getEventValue(event), 10);
    const nextRetries = Number.isFinite(parsed) ? parsed : 0;
    this.nodes.update((prev) => prev.map((item) => (item.id === node.id ? { ...item, maxRetries: nextRetries } : item)));
    this.refreshSelectedNode(node.id);
  }

  private refreshSelectedNode(nodeId: string) {
    const updated = this.nodes().find((item) => item.id === nodeId) ?? null;
    if (updated) {
      this.selectedNode.set(updated);
    }
  }

  startDrag(nodeId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const node = this.nodes().find((item) => item.id === nodeId);
    if (!node) {
      return;
    }

    this.draggingNodeId = nodeId;
    this.dragOffsetX = event.clientX - node.position.x;
    this.dragOffsetY = event.clientY - node.position.y;
  }

  private handleNodeDrag(event: MouseEvent) {
    if (!this.draggingNodeId) {
      return;
    }

    const draggedNodeId = this.draggingNodeId;

    const x = Math.max(10, event.clientX - this.dragOffsetX);
    const y = Math.max(10, event.clientY - this.dragOffsetY - 130);

    this.nodes.update((prev) =>
      prev.map((node) =>
        node.id === draggedNodeId
          ? { ...node, position: { x, y } }
          : node
      )
    );

    if (this.selectedNode()?.id === draggedNodeId) {
      this.refreshSelectedNode(draggedNodeId);
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp() {
    this.draggingNodeId = null;
    this.dragLinkSourceNodeId = null;
    this.tempEdgePath.set(null);
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') {
      return;
    }

    const edgeId = this.selectedEdgeId();
    if (!edgeId) {
      return;
    }

    event.preventDefault();
    this.removeEdgeById(edgeId);
  }

  startConnectionDrag(nodeId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragLinkSourceNodeId = nodeId;
    this.updateTempEdgePath(event.clientX, event.clientY);
  }

  completeConnectionDrag(nodeId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (this.dragLinkSourceNodeId && this.dragLinkSourceNodeId !== nodeId) {
      this.createConnection(this.dragLinkSourceNodeId, nodeId);
    }

    this.dragLinkSourceNodeId = null;
    this.tempEdgePath.set(null);
  }

  private updateTempEdgePath(clientX: number, clientY: number) {
    if (!this.dragLinkSourceNodeId) {
      this.tempEdgePath.set(null);
      return;
    }

    const sourceNode = this.nodes().find((n) => n.id === this.dragLinkSourceNodeId);
    if (!sourceNode) {
      this.tempEdgePath.set(null);
      return;
    }

    const canvasEl = document.querySelector('.canvas') as HTMLElement;
    if (!canvasEl) {
      return;
    }

    const canvasRect = canvasEl.getBoundingClientRect();
    const x1 = sourceNode.position.x + 230 + 8;  // Output handle offset
    const y1 = sourceNode.position.y + 42;        // Vertical center
    const x2 = clientX - canvasRect.left;
    const y2 = clientY - canvasRect.top;

    const dx = Math.max(60, Math.abs(x2 - x1) * 0.35);
    const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    this.tempEdgePath.set(path);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent) {
    if (this.draggingNodeId) {
      this.handleNodeDrag(event);
    }

    if (this.dragLinkSourceNodeId) {
      this.updateTempEdgePath(event.clientX, event.clientY);
    }
  }

  saveWorkflow() {
    const workflowName = this.workflowName().trim();
    if (!workflowName) {
      this.validationResult.set({ valid: false, errors: ['Le nom du workflow est obligatoire.'] });
      return;
    }

    this.saving.set(true);
    const data = {
      name: workflowName,
      nodes: this.nodes(),
      edges: this.edges()
    };

    if (this.workflowId && this.workflowId !== 'new') {
      this.workflowService.updateWorkflow(this.workflowId, data).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/workflows']);
        },
        error: (err: any) => {
          console.error('Save failed:', err);
          this.saving.set(false);
        }
      });
      return;
    }

    this.workflowService.createWorkflow(data).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/workflows']);
      },
      error: (err: any) => {
        console.error('Save failed:', err);
        this.saving.set(false);
      }
    });
  }

  validateWorkflow() {
    const errors: string[] = [];

    if (!this.workflowName().trim()) {
      errors.push('Le nom du workflow est obligatoire.');
    }

    if (this.nodes().length === 0) {
      errors.push('Ajoutez au moins un noeud.');
    }

    const nodeIds = new Set(this.nodes().map((node) => node.id));
    for (const edge of this.edges()) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        errors.push('Une liaison pointe vers un noeud inexistant.');
        break;
      }
    }

    if (this.hasCycle(this.nodes(), this.edges())) {
      errors.push('Le workflow contient une boucle.');
    }

    this.validationResult.set({ valid: errors.length === 0, errors });
  }

  runWorkflow() {
    if (!this.workflowId || this.workflowId === 'new') {
      return;
    }

    const workflowName = this.workflowName().trim();
    if (!workflowName) {
      this.validationResult.set({ valid: false, errors: ['Le nom du workflow est obligatoire.'] });
      return;
    }

    if (this.nodes().length === 0) {
      this.validationResult.set({ valid: false, errors: ['Ajoutez au moins un noeud avant execution.'] });
      return;
    }

    if (this.hasCycle(this.nodes(), this.edges())) {
      this.validationResult.set({ valid: false, errors: ['Le workflow contient une boucle.'] });
      return;
    }

    this.runningWorkflow.set(true);
    const data = {
      name: workflowName,
      nodes: this.nodes(),
      edges: this.edges()
    };

    this.workflowService.updateWorkflow(this.workflowId, data).subscribe({
      next: () => {
        this.runningWorkflow.set(false);
        this.router.navigate(['/workflows', this.workflowId, 'run']);
      },
      error: (err: any) => {
        console.error('Run pre-save failed:', err);
        this.runningWorkflow.set(false);
        this.validationResult.set({ valid: false, errors: ['Impossible de sauvegarder avant execution.'] });
      }
    });
  }

  hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const adjacency = new Map<string, string[]>();
    nodes.forEach((node) => adjacency.set(node.id, []));
    edges.forEach((edge) => {
      const list = adjacency.get(edge.source);
      if (list) {
        list.push(edge.target);
      }
    });

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string): boolean => {
      visited.add(id);
      stack.add(id);

      for (const next of adjacency.get(id) ?? []) {
        if (!visited.has(next) && dfs(next)) {
          return true;
        }

        if (stack.has(next)) {
          return true;
        }
      }

      stack.delete(id);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id) && dfs(node.id)) {
        return true;
      }
    }

    return false;
  }

  goBack() {
    this.router.navigate(['/workflows']);
  }
}
