import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { WorkflowCardComponent } from '../components/workflow-card.component';

@Component({
  selector: 'app-workflows',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent, WorkflowCardComponent],
  template: `
    <app-page-heading
      eyebrow="Workflows"
      title="Concevez et suivez vos processus automatisés"
      description="Enregistrez, planifiez et analysez chaque workflow avec des vues intuitives."
    ></app-page-heading>

    <section *ngIf="loading" class="status-panel">Chargement des workflows...</section>
    <section *ngIf="error" class="status-panel error">{{ error }}</section>

    <section *ngIf="!loading && !error" class="workflow-grid">
      <app-workflow-card
        *ngFor="let workflow of workflows"
        [name]="workflow.name"
        [status]="workflow.status"
        [statusClass]="workflow.statusClass"
        [description]="workflow.description"
        [updated]="workflow.updated"
        [tasks]="workflow.tasks"
      ></app-workflow-card>
    </section>

    <section *ngIf="!loading && !error" class="data-panel">
      <h3>Récapitulatif des workflows</h3>
      <div class="summary-grid">
        <div>
          <span>Total</span>
          <strong>{{ workflows.length }} workflows</strong>
        </div>
        <div>
          <span>Automatisés</span>
          <strong>{{ automatedCount }}</strong>
        </div>
        <div>
          <span>En erreur</span>
          <strong>{{ errorCount }}</strong>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .status-panel {
        padding: 1.5rem;
        border-radius: 1.25rem;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.12);
        color: #cbd5e1;
        margin-bottom: 1rem;
      }

      .status-panel.error {
        border-color: rgba(239, 68, 68, 0.2);
        color: #fecaca;
      }

      .workflow-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .data-panel {
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.10);
        border-radius: 1.4rem;
        padding: 1.5rem;
      }

      .data-panel h3 {
        margin: 0 0 1rem;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .summary-grid div {
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(148, 163, 184, 0.06);
      }

      .summary-grid span {
        color: #94a3b8;
        display: block;
        margin-bottom: 0.45rem;
      }

      .summary-grid strong {
        font-size: 1.5rem;
        display: block;
        color: #f8fafc;
      }

      @media (max-width: 960px) {
        .workflow-grid,
        .summary-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class WorkflowsComponent implements OnInit {
  protected workflows: Array<any> = [];
  protected loading = true;
  protected error: string | null = null;

  private readonly api = inject(ApiService);

  get automatedCount(): number {
    return this.workflows.filter((workflow) => workflow.status?.toLowerCase() === 'success' || workflow.status?.toLowerCase() === 'actif').length;
  }

  get errorCount(): number {
    return this.workflows.filter((workflow) => workflow.status?.toLowerCase().includes('error') || workflow.status?.toLowerCase() === 'failed').length;
  }

  ngOnInit(): void {
    this.api.getWorkflows().subscribe({
      next: (response: any) => {
        const payload = response?.data ?? response;
        const list = Array.isArray(payload) ? payload : payload?.data ?? [];
        this.workflows = list.map((workflow: any) => ({
          name: workflow.name || 'Workflow inconnu',
          status: workflow.status || 'DRAFT',
          statusClass: this.getStatusClass(workflow.status),
          description: workflow.description || 'Workflow importé depuis l’API.',
          updated: workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString('fr-FR') : '—',
          tasks: workflow.nodes?.length ?? 0
        }));
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger la liste des workflows.';
        this.loading = false;
      }
    });
  }

  private getStatusClass(status: string): string {
    if (!status) {
      return 'paused';
    }
    const normalized = status.toLowerCase();
    if (normalized === 'success' || normalized === 'actif') {
      return 'active';
    }
    if (normalized === 'failed' || normalized === 'erreur') {
      return 'error';
    }
    return 'paused';
  }
}
