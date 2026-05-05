import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RunService } from '../services/run.service';
import { AppDataService } from '../services/app-data.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { Run, RunStep } from '../models';

@Component({
  selector: 'app-runs',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent],
  template: `
    <app-page-heading
      eyebrow="Executions"
      title="Resultats des workflows"
      description="Consultez les runs, la progression des agents, les inputs, outputs et logs dans une vue fluide."
    ></app-page-heading>

    <section class="insight-grid">
      <article class="insight-card">
        <span>Total</span>
        <strong>{{ runs().length }}</strong>
        <small>executions chargees</small>
      </article>
      <article class="insight-card success">
        <span>Reussies</span>
        <strong>{{ successRuns() }}</strong>
        <small>runs termines avec succes</small>
      </article>
      <article class="insight-card running">
        <span>En cours</span>
        <strong>{{ activeRuns() }}</strong>
        <small>pending ou running</small>
      </article>
      <article class="insight-card failed">
        <span>Echecs</span>
        <strong>{{ failedRuns() }}</strong>
        <small>runs a analyser</small>
      </article>
    </section>

    <section class="card-panel">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">Historique</span>
          <h2>Executions recentes</h2>
        </div>
        <button type="button" class="btn-small" (click)="loadRuns()" [disabled]="loading()">
          {{ loading() ? 'Chargement...' : 'Actualiser' }}
        </button>
      </div>

      <div *ngIf="loading()" class="status-message shimmer">Chargement des executions...</div>
      <div *ngIf="error()" class="status-message error">{{ error() }}</div>

      <div *ngIf="!loading() && runs().length > 0" class="runs-list">
        <article *ngFor="let run of runs(); trackBy: trackRun" class="run-card" (click)="viewRun(run)">
          <div class="run-main">
            <span class="status" [ngClass]="statusClass(run.status)">{{ getStatusLabel(run.status) }}</span>
            <div>
              <h3>{{ run.workflow?.name || run.workflowId }}</h3>
              <p>{{ compactPrompt(run.prompt) }}</p>
            </div>
          </div>

          <div class="run-meta">
            <span><strong>{{ run.id.substring(0, 8) }}</strong>ID</span>
            <span><strong>{{ durationLabel(run.durationMs) }}</strong>Duree</span>
            <span><strong>{{ run.startedAt | date:'d/M/yyyy' }}</strong>{{ run.startedAt | date:'HH:mm' }}</span>
          </div>

          <button type="button" class="details-button" (click)="viewRun(run); $event.stopPropagation()">
            Voir resultat
          </button>
        </article>
      </div>

      <div *ngIf="!loading() && runs().length === 0" class="empty-state">
        <h3>Aucune execution trouvee</h3>
        <p>Lancez un workflow depuis le studio pour voir les resultats ici.</p>
      </div>
    </section>

    <div *ngIf="selectedRun() as activeRun" class="modal-overlay" (click)="closeDetails()">
      <aside class="result-drawer" (click)="$event.stopPropagation()">
        <div class="drawer-header">
          <div>
            <span class="panel-kicker">Run detail</span>
            <h3>{{ activeRun.workflow?.name || activeRun.workflowId }}</h3>
            <p>{{ activeRun.id }}</p>
          </div>
          <button type="button" class="icon-button" (click)="closeDetails()">x</button>
        </div>

        <div class="result-hero">
          <span class="status" [ngClass]="statusClass(activeRun.status)">{{ getStatusLabel(activeRun.status) }}</span>
          <div>
            <span>Duree</span>
            <strong>{{ activeRun.durationMs ? durationLabel(activeRun.durationMs) : 'En cours' }}</strong>
          </div>
          <div>
            <span>Etapes</span>
            <strong>{{ activeRun.steps?.length ?? 0 }}</strong>
          </div>
        </div>

        <section class="prompt-card">
          <span>Prompt lance</span>
          <p>{{ activeRun.prompt }}</p>
        </section>

        <section *ngIf="activeRun.error" class="error-card">
          <strong>Erreur</strong>
          <p>{{ activeRun.error }}</p>
        </section>

        <section class="timeline" *ngIf="(activeRun.steps?.length ?? 0) > 0">
          <article *ngFor="let step of activeRun.steps ?? []; let index = index; trackBy: trackStep" class="step-card">
            <div class="step-marker">{{ index + 1 }}</div>
            <div class="step-content">
              <div class="step-header">
                <div>
                  <h4>{{ step.nodeId }}</h4>
                  <p>{{ step.agentId }}</p>
                </div>
                <span class="status" [ngClass]="statusClass(step.status)">{{ getStatusLabel(step.status) }}</span>
              </div>

              <div class="io-grid">
                <div class="io-box">
                  <span>Input</span>
                  <pre>{{ prettyJson(step.inputPreview) }}</pre>
                </div>
                <div class="io-box output">
                  <span>Output</span>
                  <pre>{{ prettyJson(step.outputPreview) }}</pre>
                </div>
              </div>

              <div *ngIf="step.logs.length > 0" class="logs-panel">
                <span>Logs</span>
                <ul>
                  <li *ngFor="let log of step.logs">{{ log }}</li>
                </ul>
              </div>
            </div>
          </article>
        </section>

        <div *ngIf="(activeRun.steps?.length ?? 0) === 0" class="status-message">
          Les etapes sont en cours de creation. Cette fenetre se rafraichit automatiquement.
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .insight-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
    }

    .insight-card,
    .card-panel,
    .run-card,
    .result-drawer,
    .prompt-card,
    .error-card,
    .step-card {
      border: 1px solid rgba(186, 230, 253, 0.12);
      background: rgba(9, 20, 35, 0.76);
      box-shadow: 0 24px 70px rgba(2, 6, 23, 0.2);
      backdrop-filter: blur(18px);
    }

    .insight-card {
      position: relative;
      overflow: hidden;
      min-height: 132px;
      display: grid;
      align-content: end;
      gap: 0.15rem;
      padding: 1.2rem;
      border-radius: 1.25rem;
    }

    .insight-card::before {
      content: '';
      position: absolute;
      inset: -35% -20% auto auto;
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: rgba(45, 212, 191, 0.16);
    }

    .insight-card.success::before { background: rgba(52, 211, 153, 0.18); }
    .insight-card.running::before { background: rgba(96, 165, 250, 0.2); }
    .insight-card.failed::before { background: rgba(248, 113, 113, 0.18); }

    .insight-card span,
    .panel-kicker,
    .prompt-card span,
    .io-box span,
    .logs-panel span {
      color: #8fb0c5;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .insight-card strong {
      position: relative;
      color: #f8fafc;
      font-size: 2.25rem;
      line-height: 1;
    }

    .insight-card small {
      position: relative;
      color: #aabacc;
    }

    .card-panel {
      border-radius: 1.35rem;
      padding: 1.35rem;
    }

    .panel-header,
    .run-main,
    .run-meta,
    .drawer-header,
    .result-hero,
    .step-header {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }

    .panel-header {
      margin-bottom: 1.25rem;
    }

    h2,
    h3,
    h4,
    p {
      margin: 0;
    }

    .panel-header h2,
    .drawer-header h3 {
      margin-top: 0.2rem;
      color: #f8fafc;
    }

    .runs-list {
      display: grid;
      gap: 0.85rem;
    }

    .run-card {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.9fr) auto;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      border-radius: 1rem;
      cursor: pointer;
      transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;
    }

    .run-card:hover {
      transform: translateY(-2px);
      border-color: rgba(45, 212, 191, 0.36);
      background: rgba(14, 35, 52, 0.84);
    }

    .run-main {
      justify-content: flex-start;
      min-width: 0;
    }

    .run-main h3 {
      color: #f8fafc;
      font-size: 1rem;
    }

    .run-main p,
    .drawer-header p,
    .step-header p,
    .prompt-card p,
    .error-card p {
      color: #aabacc;
    }

    .run-main p {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .run-meta {
      justify-content: flex-start;
      color: #91a4b7;
    }

    .run-meta span {
      display: grid;
      gap: 0.05rem;
      font-size: 0.78rem;
    }

    .run-meta strong {
      color: #e5eef8;
      font-size: 0.92rem;
    }

    .status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.42rem 0.74rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 900;
      white-space: nowrap;
    }

    .status-pending,
    .status-skipped {
      background: rgba(156, 163, 175, 0.18);
      color: #d1d5db;
    }

    .status-running {
      background: rgba(59, 130, 246, 0.2);
      color: #bfdbfe;
    }

    .status-success {
      background: rgba(22, 163, 74, 0.22);
      color: #bbf7d0;
    }

    .status-failed {
      background: rgba(239, 68, 68, 0.2);
      color: #fecaca;
    }

    .btn-small,
    .details-button,
    .icon-button {
      border: none;
      cursor: pointer;
      font-weight: 900;
    }

    .btn-small,
    .details-button {
      padding: 0.72rem 1rem;
      border-radius: 0.85rem;
      background: rgba(45, 212, 191, 0.13);
      color: #99f6e4;
    }

    .btn-small:disabled {
      opacity: 0.55;
      cursor: wait;
    }

    .details-button {
      background: linear-gradient(135deg, #2dd4bf, #facc15);
      color: #07111f;
    }

    .status-message,
    .empty-state {
      padding: 1.2rem;
      border-radius: 1rem;
      background: rgba(186, 230, 253, 0.08);
      color: #cbd5e1;
      text-align: center;
    }

    .status-message.error,
    .error-card {
      border-color: rgba(248, 113, 113, 0.24);
      background: rgba(127, 29, 29, 0.18);
      color: #fecaca;
    }

    .shimmer {
      overflow: hidden;
      position: relative;
    }

    .shimmer::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
      animation: shimmer 1.4s infinite;
    }

    .empty-state {
      display: grid;
      gap: 0.4rem;
    }

    .empty-state h3 {
      color: #f8fafc;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      justify-content: flex-end;
      background: rgba(2, 6, 23, 0.62);
      backdrop-filter: blur(5px);
    }

    .result-drawer {
      width: min(920px, 100%);
      height: 100vh;
      overflow-y: auto;
      padding: 1.4rem;
      border-radius: 1.4rem 0 0 1.4rem;
      animation: drawer-in 0.28s ease both;
    }

    .drawer-header {
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .icon-button {
      width: 2.35rem;
      height: 2.35rem;
      border-radius: 50%;
      background: rgba(248, 113, 113, 0.14);
      color: #fecaca;
    }

    .result-hero {
      display: grid;
      grid-template-columns: auto repeat(2, minmax(0, 1fr));
      align-items: stretch;
      margin-bottom: 1rem;
      padding: 0.85rem;
      border-radius: 1rem;
      background: rgba(186, 230, 253, 0.07);
    }

    .result-hero > div {
      display: grid;
      gap: 0.12rem;
      padding-inline: 0.75rem;
      border-left: 1px solid rgba(186, 230, 253, 0.12);
    }

    .result-hero span,
    .result-hero div span {
      color: #91a4b7;
      font-size: 0.78rem;
    }

    .result-hero strong {
      color: #f8fafc;
      font-size: 1.2rem;
    }

    .prompt-card,
    .error-card {
      display: grid;
      gap: 0.55rem;
      margin-bottom: 1rem;
      padding: 1rem;
      border-radius: 1rem;
    }

    .timeline {
      display: grid;
      gap: 1rem;
    }

    .step-card {
      position: relative;
      display: grid;
      grid-template-columns: 2.4rem minmax(0, 1fr);
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 1rem;
    }

    .step-marker {
      width: 2.15rem;
      height: 2.15rem;
      display: grid;
      place-items: center;
      border-radius: 0.8rem;
      background: rgba(45, 212, 191, 0.14);
      color: #99f6e4;
      font-weight: 900;
    }

    .step-content {
      display: grid;
      gap: 0.85rem;
      min-width: 0;
    }

    .step-header h4 {
      color: #f8fafc;
    }

    .io-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.8rem;
    }

    .io-box,
    .logs-panel {
      min-width: 0;
      padding: 0.85rem;
      border-radius: 0.9rem;
      background: rgba(2, 6, 23, 0.42);
      border: 1px solid rgba(186, 230, 253, 0.08);
    }

    .io-box.output {
      background: rgba(20, 184, 166, 0.08);
    }

    pre {
      margin: 0.55rem 0 0;
      max-height: 260px;
      overflow: auto;
      color: #dbeafe;
      font-size: 0.82rem;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .logs-panel ul {
      margin: 0.55rem 0 0;
      padding-left: 1.2rem;
      color: #cbd5e1;
    }

    @keyframes shimmer {
      100% { transform: translateX(100%); }
    }

    @keyframes drawer-in {
      from {
        opacity: 0;
        transform: translateX(24px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @media (max-width: 1040px) {
      .insight-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .run-card {
        grid-template-columns: 1fr;
      }

      .details-button {
        width: 100%;
      }
    }

    @media (max-width: 720px) {
      .insight-grid,
      .io-grid,
      .result-hero {
        grid-template-columns: 1fr;
      }

      .panel-header,
      .run-main,
      .run-meta,
      .drawer-header,
      .step-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .result-drawer {
        border-radius: 0;
      }
    }

    @media (max-width: 480px) {
      .insight-card {
        min-height: 100px;
      }

      .insight-card strong {
        font-size: 1.75rem;
      }

      .card-panel {
        padding: 1rem;
      }

      .run-card {
        padding: 0.9rem;
      }

      .result-drawer {
        padding: 1rem;
        width: 100%;
      }

      .step-card {
        grid-template-columns: 1.8rem minmax(0, 1fr);
      }
    }
  `]
})
export class RunsComponent implements OnInit, OnDestroy {
  protected readonly runs = signal<Run[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedRun = signal<Run | null>(null);

  protected readonly successRuns = computed(() => this.runs().filter((run) => run.status === 'SUCCESS').length);
  protected readonly failedRuns = computed(() => this.runs().filter((run) => run.status === 'FAILED').length);
  protected readonly activeRuns = computed(() => this.runs().filter((run) => run.status === 'PENDING' || run.status === 'RUNNING').length);

  private readonly runService = inject(RunService);
  private readonly data = inject(AppDataService);
  private readonly route = inject(ActivatedRoute);
  private pollingId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const cachedRuns = this.data.recentRuns();
    if (cachedRuns.length > 0) {
      this.runs.set(cachedRuns);
      this.loading.set(false);
    }
    this.loadRuns(this.route.snapshot.queryParamMap.get('runId'));
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  protected loadRuns(focusRunId?: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.runService.getRuns({ limit: 50 }).subscribe({
      next: (response) => {
        this.runs.set(response.data);
        this.data.runs.set(response.data);
        this.loading.set(false);
        if (focusRunId) {
          this.openRunById(focusRunId);
        }
      },
      error: () => {
        this.error.set('Erreur lors du chargement des executions');
        this.loading.set(false);
      }
    });
  }

  protected viewRun(run: Run): void {
    this.openRunById(run.id, run);
  }

  protected closeDetails(): void {
    this.selectedRun.set(null);
    this.stopPolling();
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      RUNNING: 'En cours',
      SUCCESS: 'Reussi',
      FAILED: 'Echoue',
      SKIPPED: 'Ignore'
    };
    return labels[status] || status;
  }

  protected statusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  protected durationLabel(value?: number): string {
    if (!value) {
      return '-';
    }
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
  }

  protected compactPrompt(prompt: string): string {
    return prompt.length > 95 ? `${prompt.substring(0, 95)}...` : prompt;
  }

  protected prettyJson(value: unknown): string {
    if (value === null || value === undefined) {
      return 'Aucune donnee';
    }
    return JSON.stringify(value, null, 2);
  }

  protected trackRun(_index: number, run: Run): string {
    return run.id;
  }

  protected trackStep(_index: number, step: RunStep): string {
    return step.id;
  }

  private openRunById(runId: string, fallback?: Run): void {
    this.runService.getRun(runId).subscribe({
      next: (fullRun) => {
        this.selectedRun.set(fullRun);
        if (fullRun.status === 'PENDING' || fullRun.status === 'RUNNING') {
          this.startPolling(fullRun.id);
        } else {
          this.stopPolling();
          this.refreshRunListQuietly();
        }
      },
      error: () => {
        if (fallback) {
          this.selectedRun.set(fallback);
        }
      }
    });
  }

  private startPolling(runId: string): void {
    if (this.pollingId) {
      return;
    }
    this.pollingId = setInterval(() => this.openRunById(runId), 1500);
  }

  private stopPolling(): void {
    if (this.pollingId) {
      clearInterval(this.pollingId);
      this.pollingId = null;
    }
  }

  private refreshRunListQuietly(): void {
    this.runService.getRuns({ limit: 50 }).subscribe({
      next: (response) => {
        this.runs.set(response.data);
        this.data.runs.set(response.data);
      }
    });
  }
}

