import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WorkflowService } from '../services/workflow.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { Workflow, WorkflowNode } from '../models';

@Component({
  selector: 'app-workflow-builder',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeadingComponent],
  template: `
    <app-page-heading
      eyebrow="Designer Pro"
      title="Vue professionnelle du workflow"
      description="Affiche la topologie de vos agents et les liaisons entre eux dans un format visuel professionnel."
    ></app-page-heading>

    <section class="builder-toolbar">
      <button class="btn-secondary" (click)="goBack()">← Retour aux workflows</button>
      <div class="toolbar-status">
        <span class="tag">Pro View</span>
        <span>{{ workflow()?.nodes?.length || 0 }} nœuds</span>
        <span>{{ workflow()?.edges?.length || 0 }} liaisons</span>
      </div>
    </section>

    <section *ngIf="loading()" class="status-message">Chargement du workflow...</section>
    <section *ngIf="error()" class="status-message error">{{ error() }}</section>

    <section *ngIf="workflow() as wf" class="builder-shell">
      <aside class="builder-sidebar">
        <div class="panel">
          <h3>{{ wf.name }}</h3>
          <p>{{ wf.nodes.length }} nœuds · {{ wf.edges.length }} liaisons · v{{ wf.version }}</p>
          <div class="panel-row"><strong>Status</strong><span>{{ getStatusLabel(wf.status) }}</span></div>
          <div class="panel-row"><strong>Mis à jour</strong><span>{{ wf.updatedAt | date:'d/M/yyyy HH:mm' }}</span></div>
          <div class="panel-row"><strong>Créé par</strong><span>{{ wf.createdBy }}</span></div>
        </div>
        <div class="panel">
          <h4>Liaisons</h4>
          <div *ngIf="wf.edges.length === 0" class="no-data">Aucune liaison définie.</div>
          <div *ngFor="let edge of wf.edges" class="edge-item">{{ edge.source }} → {{ edge.target }}</div>
        </div>
        <div class="panel">
          <h4>Instructions</h4>
          <p>Utilisez cette vue pour analyser les connexions entre agents et vérifier la topologie avant exécution.</p>
        </div>
      </aside>

      <div class="canvas-shell">
        <div class="canvas">
          <svg class="edge-layer" preserveAspectRatio="none">
            <path *ngFor="let edge of edgePaths()" [attr.d]="edge.path" class="edge-path" />
          </svg>

          <div *ngFor="let node of wf.nodes" class="designer-node" [style.left.px]="node.position.x || 0" [style.top.px]="node.position.y || 0">
            <div class="node-header">{{ node.label }}</div>
            <div class="node-meta">Agent ID: {{ node.agentId }}</div>
            <div class="node-footer">{{ node.errorPolicy }} · retry {{ node.maxRetries }}</div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .builder-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin: 1.5rem 0 1rem;
      }
      .btn-secondary {
        border: 1px solid rgba(148, 163, 184, 0.36);
        background: rgba(15, 23, 42, 0.78);
        color: #e2e8f0;
        padding: 0.85rem 1.15rem;
        border-radius: 1rem;
        cursor: pointer;
      }
      .toolbar-status {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        color: #cbd5e1;
        font-size: 0.95rem;
      }
      .tag {
        background: rgba(34, 197, 94, 0.16);
        color: #dcfce7;
        border-radius: 999px;
        padding: 0.4rem 0.75rem;
        font-weight: 700;
      }
      .status-message {
        margin: 2rem 0;
        padding: 1.25rem 1.5rem;
        border-radius: 1rem;
        background: rgba(15, 23, 42, 0.92);
        color: #cbd5e1;
      }
      .status-message.error {
        border: 1px solid rgba(248, 113, 113, 0.28);
        color: #fecaca;
      }
      .builder-shell {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 1.5rem;
      }
      .builder-sidebar {
        display: grid;
        gap: 1rem;
      }
      .panel {
        padding: 1.25rem;
        border-radius: 1.25rem;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(148, 163, 184, 0.14);
      }
      .panel h3,
      .panel h4 {
        margin: 0 0 0.75rem;
        color: #f8fafc;
      }
      .panel p,
      .panel-row,
      .edge-item,
      .no-data {
        color: #cbd5e1;
        margin: 0;
      }
      .panel-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 0;
      }
      .edge-item {
        padding: 0.45rem 0.65rem;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.12);
        margin-bottom: 0.5rem;
      }
      .canvas-shell {
        min-height: 720px;
        background: radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 25%),
          radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.08), transparent 20%),
          rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 1.5rem;
        position: relative;
        overflow: hidden;
      }
      .canvas {
        position: relative;
        min-height: 720px;
        width: 100%;
      }
      .edge-layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .edge-path {
        fill: none;
        stroke: #38bdf8;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.85;
      }
      .edge-path::after {
        content: '';
      }
      .designer-node {
        position: absolute;
        min-width: 220px;
        padding: 1rem;
        border-radius: 1.25rem;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(56, 189, 248, 0.18);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15);
      }
      .node-header {
        font-weight: 800;
        color: #f8fafc;
        margin-bottom: 0.45rem;
      }
      .node-meta,
      .node-footer {
        color: #cbd5e1;
        font-size: 0.84rem;
      }
      .node-footer {
        margin-top: 0.75rem;
      }
      @media (max-width: 980px) {
        .builder-shell {
          grid-template-columns: 1fr;
        }
        .builder-sidebar {
          order: 2;
        }
      }
    `
  ]
})
export class WorkflowBuilderComponent implements OnInit {
  protected readonly workflow = signal<Workflow | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly edgePaths = computed(() => {
    const wf = this.workflow();
    if (!wf) {
      return [];
    }

    const nodeMap = new Map(wf.nodes.map((node) => [node.id, node]));
    return wf.edges
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return null;
        }

        const sourceX = (source.position?.x ?? 0) + 220;
        const sourceY = (source.position?.y ?? 0) + 42;
        const targetX = target.position?.x ?? 0;
        const targetY = (target.position?.y ?? 0) + 42;
        const offset = Math.max(80, Math.abs(targetX - sourceX) / 2);
        const path = `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY} ${targetX - offset} ${targetY} ${targetX} ${targetY}`;
        return { path };
      })
      .filter((item): item is { path: string } => !!item);
  });

  private readonly workflowService = inject(WorkflowService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Workflow introuvable.');
      this.loading.set(false);
      return;
    }

    this.workflowService.getWorkflow(id).subscribe({
      next: (workflow) => {
        this.workflow.set(workflow);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le workflow.');
        this.loading.set(false);
      }
    });
  }

  protected goBack(): void {
    this.router.navigate(['/workflows']);
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Brouillon',
      RUNNING: 'En cours',
      SUCCESS: 'Réussi',
      FAILED: 'Échoué'
    };
    return labels[status] || status;
  }
}
