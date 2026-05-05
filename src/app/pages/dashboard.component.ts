import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiService } from '../services/kpi.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { StatCardComponent } from '../components/stat-card.component';
import { KpiData } from '../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent, StatCardComponent],
  template: `
    <app-page-heading
      eyebrow="Dashboard"
      title="Vue globale des workflows IA"
      description="Suivez les executions, la reussite, les latences et les agents les plus utilises."
    ></app-page-heading>

    <section *ngIf="loading()" class="status-panel">Chargement des indicateurs...</section>
    <section *ngIf="error()" class="status-panel error">{{ error() }}</section>

    <section *ngIf="!loading() && !error()" class="stats-grid">
      <app-stat-card label="Executions" [value]="kpis()?.totalRuns ?? 0" description="Nombre total de runs"></app-stat-card>
      <app-stat-card label="Taux de reussite" [value]="successRateLabel" description="Runs termines en succes"></app-stat-card>
      <app-stat-card label="Duree moyenne" [value]="durationLabel(kpis()?.duration?.avg)" description="Temps moyen d'execution"></app-stat-card>
      <app-stat-card label="P95" [value]="durationLabel(kpis()?.duration?.p95)" description="95e percentile" [accent]="true"></app-stat-card>
    </section>

    <section class="board-grid" *ngIf="!loading() && !error()">
      <div class="panel card-panel">
        <div class="panel-header">
          <h3>Top agents</h3>
          <span>{{ kpis()?.topAgents?.length ?? 0 }} agents mesures</span>
        </div>
        <ul class="metric-list">
          <li *ngFor="let agent of kpis()?.topAgents ?? []">
            <span>{{ agent.name }} <small>{{ agent.family }}</small></span>
            <strong>{{ agent.usage_count }} usages</strong>
          </li>
          <li *ngIf="(kpis()?.topAgents?.length ?? 0) === 0">
            <span>Aucun run agent pour le moment</span>
            <strong>0</strong>
          </li>
        </ul>
      </div>

      <div class="panel card-panel">
        <div class="panel-header">
          <h3>Erreurs par famille</h3>
          <span>RunStep FAILED</span>
        </div>
        <ul class="metric-list">
          <li *ngFor="let item of kpis()?.errorsByFamily ?? []">
            <span>{{ item.family }}</span>
            <strong>{{ item.error_count }}</strong>
          </li>
          <li *ngIf="(kpis()?.errorsByFamily?.length ?? 0) === 0">
            <span>Aucune erreur detectee</span>
            <strong>0</strong>
          </li>
        </ul>
      </div>
    </section>
  `,
  styles: [
    `
      .status-panel {
        padding: 1.5rem;
        border-radius: 1rem;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.12);
        color: #cbd5e1;
      }

      .status-panel.error {
        border-color: rgba(239, 68, 68, 0.2);
        color: #fecaca;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1.25rem;
        margin-bottom: 1.25rem;
      }

      .board-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.25rem;
      }

      .card-panel {
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 1rem;
        padding: 1.5rem;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin-bottom: 1.25rem;
      }

      .panel-header h3 {
        margin: 0;
        font-size: 1.1rem;
      }

      .panel-header span,
      .metric-list small {
        color: #94a3b8;
      }

      .metric-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.75rem;
      }

      .metric-list li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        padding: 1rem;
        border-radius: 0.75rem;
        background: rgba(148, 163, 184, 0.06);
      }

      .metric-list span {
        display: grid;
      }

      .metric-list strong {
        color: #f8fafc;
        white-space: nowrap;
      }

      @media (max-width: 960px) {
        .stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .board-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 540px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class DashboardComponent implements OnInit {
  protected readonly kpis = signal<KpiData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly kpiService = inject(KpiService);

  protected get successRateLabel(): string {
    return `${Math.round((this.kpis()?.successRate ?? 0) * 100)}%`;
  }

  protected durationLabel(value?: number): string {
    if (!value) {
      return '0 ms';
    }
    return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
  }

  ngOnInit(): void {
    this.kpiService.getKpis().subscribe({
      next: (data) => {
        this.kpis.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les indicateurs.');
        this.loading.set(false);
      }
    });
  }
}
