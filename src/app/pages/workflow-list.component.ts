import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkflowService } from '../services/workflow.service';
import { RunService } from '../services/run.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { Agent, Workflow, WorkflowCreate, WorkflowNode } from '../models';
import { AppDataService } from '../services/app-data.service';

type TemplateKey = 'summarize' | 'sentiment' | 'translate-summary' | 'weather' | 'single-agent' | 'custom-chain';

@Component({
  selector: 'app-workflow-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeadingComponent],
  template: `
    <app-page-heading
      eyebrow="Workflow Studio"
      title="Orchestration visuelle type n8n"
      description=""
    ></app-page-heading>

    <section class="studio-hero">
      <div>
        <span class="kicker">Live data</span>
        <h2>{{ workflows().length }} workflows, {{ agents().length }} agents actifs, {{ data.recentRuns().length }} executions</h2>
        <p>Les donnees principales sont prechargees des l'entree dans l'interface pour eviter les pages vides et les rechargements inutiles.</p>
      </div>
      <button class="btn-primary" (click)="openCreateForm()">Nouveau workflow connecte</button>
    </section>

    <section class="toolbar">
      <div class="filters">
        <input
          type="text"
          placeholder="Rechercher un workflow..."
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
        />
        <select [ngModel]="selectedStatus()" (ngModelChange)="selectedStatus.set($event)">
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="RUNNING">En cours</option>
          <option value="SUCCESS">Reussi</option>
          <option value="FAILED">Echoue</option>
        </select>
      </div>
      <button (click)="refreshAll()" [disabled]="data.loading()">{{ data.loading() ? 'Synchronisation...' : 'Rafraichir' }}</button>
    </section>

    <section *ngIf="data.loading() && workflows().length === 0" class="status-message shimmer">Chargement du studio...</section>
    <section *ngIf="error() || data.error()" class="status-message error">{{ error() || data.error() }}</section>

    <section *ngIf="filteredWorkflows().length > 0" class="workflows-grid">
      <article *ngFor="let workflow of filteredWorkflows(); trackBy: trackWorkflow" class="workflow-card">
        <div class="card-header">
          <div>
            <h3>{{ workflow.name }}</h3>
            <p>{{ workflow.nodes.length }} noeud(s) · {{ workflow.edges.length }} liaison(s) · v{{ workflow.version }}</p>
          </div>
          <span class="status" [class]="'status status-' + workflow.status.toLowerCase()">
            {{ getStatusLabel(workflow.status) }}
          </span>
        </div>

        <div class="flow-preview" [style.--node-count]="workflow.nodes.length || 1">
          <div *ngFor="let node of workflow.nodes; let index = index; trackBy: trackNode" class="flow-node">
            <span>{{ index + 1 }}</span>
            <strong>{{ node.label }}</strong>
            <small>{{ node.errorPolicy }} · retry {{ node.maxRetries ?? 0 }}</small>
          </div>
          <div *ngIf="workflow.nodes.length === 0" class="flow-node empty">
            <span>0</span>
            <strong>Aucun noeud</strong>
            <small>Ajoutez des agents</small>
          </div>
        </div>

        <div class="edge-list" *ngIf="workflow.edges.length > 0">
          <span *ngFor="let edge of workflow.edges">{{ edge.source }} → {{ edge.target }}</span>
        </div>

        <div class="card-meta">
          <span>Mis a jour {{ workflow.updatedAt | date:'d/M/yyyy HH:mm' }}</span>
          <span>{{ workflow.createdAt | date:'d/M/yyyy' }}</span>
        </div>

        <div class="card-actions">
          <button class="btn-edit" (click)="navigateToEditor(workflow)">📝 Edit</button>
          <button class="btn-run" (click)="navigateToPlayground(workflow)" [disabled]="workflow.nodes.length === 0">▶ Run</button>
          <button class="danger" (click)="deleteWorkflow(workflow.id)">🗑️ Delete</button>
        </div>
      </article>
    </section>

    <section *ngIf="!data.loading() && filteredWorkflows().length === 0" class="empty-state">
      <h3>Aucun workflow trouve</h3>
      <p>Creez un pipeline connecte: input → agent 1 → agent 2 → resultat final.</p>
      <button class="btn-primary" (click)="openCreateForm()">Creer maintenant</button>
    </section>

    <div *ngIf="showCreateForm()" class="modal-overlay" (click)="closeCreateForm()">
      <div class="modal-content builder-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <span class="kicker">Builder</span>
            <h3>Nouveau workflow connecte</h3>
            <p>Chaque noeud transmet son output au noeud suivant, comme un mini n8n.</p>
          </div>
          <button type="button" class="icon-button" (click)="closeCreateForm()">x</button>
        </div>

        <form (ngSubmit)="createWorkflow()">
          <label>
            Nom du workflow
            <input name="name" [ngModel]="newWorkflowName()" (ngModelChange)="newWorkflowName.set($event)" required placeholder="Ex: Analyse client complete" />
          </label>

          <label>
            Template
            <select name="template" [ngModel]="selectedTemplate()" (ngModelChange)="changeTemplate($event)">
              <option value="translate-summary">Translate → Summarize</option>
              <option value="weather">Geocode → Forecast</option>
              <option value="summarize">Summarize text</option>
              <option value="sentiment">Sentiment analysis</option>
              <option value="single-agent">Single selected agent</option>
              <option value="custom-chain">Custom chain multi-agents</option>
            </select>
          </label>

          <label *ngIf="selectedTemplate() === 'single-agent'">
            Agent
            <select name="agentId" [ngModel]="selectedAgentId()" (ngModelChange)="selectedAgentId.set($event)">
              <option *ngFor="let agent of agents(); trackBy: trackAgent" [value]="agent.id">{{ agent.name }} · {{ agent.family }}</option>
            </select>
          </label>

          <section *ngIf="selectedTemplate() === 'custom-chain'" class="agent-picker">
            <div class="picker-header">
              <strong>Choisir l'ordre des agents</strong>
              <button type="button" (click)="clearChain()">Vider</button>
            </div>
            <div class="agent-grid">
              <button type="button" *ngFor="let agent of agents(); trackBy: trackAgent" (click)="addAgentToChain(agent)">
                <strong>{{ agent.name }}</strong>
                <small>{{ agent.family }} · {{ agent.version }}</small>
              </button>
            </div>
          </section>

          <section class="execution-plan">
            <div class="plan-title">
              <span class="kicker">Execution plan</span>
              <strong>{{ templatePreview().length }} noeud(s), {{ previewEdges().length }} liaison(s)</strong>
            </div>

            <div class="builder-flow" [style.--node-count]="templatePreview().length || 1">
              <div *ngFor="let item of templatePreview(); let index = index" class="flow-node selected">
                <span>{{ index + 1 }}</span>
                <strong>{{ item }}</strong>
                <small>{{ index === 0 ? 'Input prompt' : 'Output precedent' }}</small>
              </div>
              <div *ngIf="templatePreview().length === 0" class="flow-node empty">
                <span>?</span>
                <strong>Aucun agent</strong>
                <small>Selectionnez au moins un agent</small>
              </div>
            </div>

            <div class="mapping-box" *ngIf="previewEdges().length > 0">
              <span *ngFor="let edge of previewEdges()">{{ edge.source }}.output → {{ edge.target }}.input</span>
            </div>
          </section>

          <div class="form-actions">
            <button type="button" (click)="closeCreateForm()">Annuler</button>
            <button type="submit" class="btn-primary" [disabled]="creating() || !newWorkflowName().trim()">
              {{ creating() ? 'Creation...' : 'Creer le workflow' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div *ngIf="runWorkflowTarget() as target" class="modal-overlay" (click)="closeRunForm()">
      <div class="modal-content run-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <span class="kicker">Execution</span>
            <h3>{{ target.name }}</h3>
            <p>{{ target.nodes.length }} agents connectes avant lancement.</p>
          </div>
          <button type="button" class="icon-button" (click)="closeRunForm()">x</button>
        </div>

        <div class="execution-plan compact">
          <div class="builder-flow" [style.--node-count]="target.nodes.length || 1">
            <div *ngFor="let node of target.nodes; let index = index; trackBy: trackNode" class="flow-node selected">
              <span>{{ index + 1 }}</span>
              <strong>{{ node.label }}</strong>
              <small>{{ index === 0 ? 'Recoit le prompt' : 'Recoit le resultat precedent' }}</small>
            </div>
          </div>
        </div>

        <form (ngSubmit)="submitRun()">
          <label>
            Input du workflow
            <textarea
              name="runPrompt"
              [ngModel]="runPrompt()"
              (ngModelChange)="runPrompt.set($event)"
              required
              rows="7"
              placeholder="Ville, texte a resumer, ou contenu a analyser..."
            ></textarea>
          </label>

          <div class="template-preview">
            <strong>Exemples rapides:</strong>
            <button type="button" *ngFor="let example of promptExamples()" (click)="runPrompt.set(example)">
              {{ example }}
            </button>
          </div>

          <div class="form-actions">
            <button type="button" (click)="closeRunForm()">Annuler</button>
            <button type="submit" class="btn-primary" [disabled]="running() || !runPrompt().trim()">
              {{ running() ? 'Lancement...' : 'Lancer et voir le resultat' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .studio-hero, .toolbar, .workflow-card, .empty-state, .status-message, .modal-content {
      border: 1px solid rgba(186, 230, 253, 0.12);
      background: rgba(9, 20, 35, 0.78);
      box-shadow: 0 24px 70px rgba(2, 6, 23, 0.18);
      backdrop-filter: blur(16px);
    }

    .studio-hero, .toolbar, .card-header, .card-meta, .card-actions, .form-actions, .modal-header, .picker-header, .plan-title {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }

    .studio-hero, .toolbar, .workflow-card, .empty-state, .status-message { border-radius: 1.25rem; padding: 1.2rem; }
    .studio-hero h2, h3, p { margin: 0; }
    .studio-hero h2, h3 { color: #f8fafc; }
    .studio-hero p, .card-header p, .card-meta, .empty-state p, .modal-header p, .flow-node small { color: #9fb0c2; }
    .kicker { color: #8fd8ce; text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.72rem; font-weight: 900; }

    .filters { display: flex; gap: 0.75rem; flex: 1; }
    input, select, textarea { width: 100%; min-height: 44px; padding: 0.78rem; border-radius: 0.85rem; background: rgba(186, 230, 253, 0.08); border: 1px solid rgba(186, 230, 253, 0.16); color: #e5eef8; }
    textarea { resize: vertical; line-height: 1.55; }
    option { color: #0f172a; }

    .workflows-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1rem; }
    .workflow-card { display: grid; gap: 1rem; transition: transform 0.22s ease, border-color 0.22s ease; }
    .workflow-card:hover { transform: translateY(-3px); border-color: rgba(45, 212, 191, 0.32); }
    .card-header h3 { font-size: 1.05rem; }

    .flow-preview, .builder-flow { --node-count: 1; position: relative; display: grid; grid-template-columns: repeat(var(--node-count), minmax(130px, 1fr)); gap: 0.85rem; overflow-x: auto; padding: 0.2rem 0; }
    .flow-preview::before, .builder-flow::before { content: ''; position: absolute; left: 1rem; right: 1rem; top: 34px; height: 2px; background: linear-gradient(90deg, #2dd4bf, #facc15); opacity: 0.5; }
    .flow-node { position: relative; z-index: 1; display: grid; gap: 0.25rem; min-width: 130px; padding: 0.8rem; border-radius: 1rem; background: rgba(2, 6, 23, 0.72); border: 1px solid rgba(186, 230, 253, 0.12); }
    .flow-node span { width: 2rem; height: 2rem; display: grid; place-items: center; border-radius: 0.75rem; background: linear-gradient(135deg, #2dd4bf, #facc15); color: #07111f; font-weight: 900; }
    .flow-node strong { color: #f8fafc; font-size: 0.92rem; }
    .flow-node.selected { background: rgba(20, 184, 166, 0.1); border-color: rgba(45, 212, 191, 0.26); }
    .flow-node.empty { opacity: 0.72; }

    .edge-list, .mapping-box, .template-preview { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem; border-radius: 0.9rem; background: rgba(186, 230, 253, 0.07); }
    .edge-list span, .mapping-box span, .template-preview button { padding: 0.35rem 0.65rem; border-radius: 999px; background: rgba(59, 130, 246, 0.14); color: #bfdbfe; font-size: 0.82rem; }

    .status { padding: 0.38rem 0.74rem; border-radius: 999px; font-size: 0.75rem; font-weight: 900; white-space: nowrap; }
    .status-draft { color: #d1d5db; background: rgba(156, 163, 175, 0.18); }
    .status-running { color: #93c5fd; background: rgba(59, 130, 246, 0.18); }
    .status-success { color: #86efac; background: rgba(22, 163, 74, 0.18); }
    .status-failed { color: #fecaca; background: rgba(239, 68, 68, 0.18); }

    button { border: none; border-radius: 0.8rem; padding: 0.68rem 0.95rem; background: rgba(59, 130, 246, 0.18); color: #bfdbfe; cursor: pointer; font-weight: 800; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-primary { background: linear-gradient(135deg, #2dd4bf, #facc15); color: #07111f; }
    .btn-edit { background: rgba(59, 130, 246, 0.18); color: #bfdbfe; }
    .btn-edit:hover { background: rgba(59, 130, 246, 0.3); }
    .btn-run { background: rgba(34, 197, 94, 0.18); color: #86efac; }
    .btn-run:hover { background: rgba(34, 197, 94, 0.3); }
    .danger { background: rgba(239, 68, 68, 0.18); color: #fecaca; }
    .danger:hover { background: rgba(239, 68, 68, 0.3); }
    .icon-button { width: 2rem; height: 2rem; padding: 0; border-radius: 50%; }

    .empty-state { text-align: center; display: grid; gap: 0.75rem; justify-items: center; }
    .status-message { color: #cbd5e1; text-align: center; }
    .status-message.error { border-color: rgba(239, 68, 68, 0.28); color: #fecaca; }
    .shimmer { position: relative; overflow: hidden; }
    .shimmer::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); animation: shimmer 1.4s infinite; }

    .modal-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 1rem; background: rgba(2, 6, 23, 0.72); backdrop-filter: blur(5px); }
    .modal-content { width: min(760px, 100%); max-height: 90vh; overflow: auto; border-radius: 1.2rem; padding: 1.5rem; }
    .builder-modal { width: min(980px, 100%); }
    .run-modal { width: min(760px, 100%); }
    form, .execution-plan { display: grid; gap: 1rem; }
    label { display: grid; gap: 0.5rem; color: #dbeafe; font-weight: 800; }
    .agent-picker, .execution-plan { padding: 1rem; border-radius: 1rem; background: rgba(186, 230, 253, 0.06); border: 1px solid rgba(186, 230, 253, 0.1); }
    .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.65rem; margin-top: 0.8rem; }
    .agent-grid button { display: grid; gap: 0.2rem; text-align: left; }
    .agent-grid small { color: #9fb0c2; }
    .template-preview strong { width: 100%; color: #f8fafc; }
    .execution-plan.compact { margin-bottom: 1rem; }

    @keyframes shimmer { 100% { transform: translateX(100%); } }

    @media (max-width: 760px) {
      .studio-hero, .toolbar, .card-header, .card-actions, .form-actions, .modal-header, .picker-header { flex-direction: column; align-items: stretch; }
      .filters { flex-direction: column; }
      .workflows-grid { grid-template-columns: 1fr; }
      .card-actions { display: grid; grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 540px) {
      .studio-hero { padding: 1rem; }
      .studio-hero h2 { font-size: 1rem; }
      .modal-content { border-radius: 1rem 1rem 0 0; max-height: 92vh; }
      .flow-preview, .builder-flow { grid-template-columns: repeat(var(--node-count), minmax(110px, 1fr)); }
      .agent-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class WorkflowListComponent implements OnInit {
  protected readonly data = inject(AppDataService);
  protected readonly workflows = this.data.workflows;
  protected readonly agents = this.data.activeAgents;
  protected readonly error = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly showCreateForm = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly selectedStatus = signal('');
  protected readonly selectedTemplate = signal<TemplateKey>('translate-summary');
  protected readonly selectedAgentId = signal('');
  protected readonly selectedChainAgentIds = signal<string[]>([]);
  protected readonly newWorkflowName = signal('Translate then summarize');
  protected readonly runWorkflowTarget = signal<Workflow | null>(null);
  protected readonly runPrompt = signal('');
  protected readonly running = signal(false);

  protected readonly filteredWorkflows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatus();
    return this.workflows().filter((workflow) => {
      const matchesQuery = !query || workflow.name.toLowerCase().includes(query) || workflow.nodes.some((node) => node.label.toLowerCase().includes(query));
      const matchesStatus = !status || workflow.status === status;
      return matchesQuery && matchesStatus;
    });
  });

  protected readonly templatePreview = computed(() => this.buildWorkflowPayload(false).nodes.map((node) => node.label));
  protected readonly previewEdges = computed(() => this.buildWorkflowPayload(false).edges);

  private readonly workflowService = inject(WorkflowService);
  private readonly runService = inject(RunService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.data.loadAll();
    if (!this.selectedAgentId() && this.agents().length > 0) {
      this.selectedAgentId.set(this.agents()[0].id);
    }
  }

  protected refreshAll(): void {
    this.data.loadAll(true);
  }

  protected openCreateForm(): void {
    this.router.navigate(['/workflows', 'new', 'edit']);
  }

  protected closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.creating.set(false);
  }

  protected changeTemplate(template: TemplateKey): void {
    this.selectedTemplate.set(template);
    this.syncDefaultName();
  }

  protected syncDefaultName(): void {
    const names: Record<TemplateKey, string> = {
      summarize: 'Summarize text',
      sentiment: 'Sentiment analysis',
      'translate-summary': 'Translate then summarize',
      weather: 'Weather check by city',
      'single-agent': 'Single agent workflow',
      'custom-chain': 'Custom AI chain'
    };
    this.newWorkflowName.set(names[this.selectedTemplate()]);
  }

  protected addAgentToChain(agent: Agent): void {
    this.selectedChainAgentIds.update((ids) => [...ids, agent.id]);
  }

  protected clearChain(): void {
    this.selectedChainAgentIds.set([]);
  }

  protected createWorkflow(): void {
    const payload = this.buildWorkflowPayload(true);
    if (payload.nodes.length === 0) {
      this.error.set('Aucun agent compatible trouve pour ce workflow. Verifiez la bibliotheque agents.');
      return;
    }

    this.creating.set(true);
    this.error.set(null);
    this.workflowService.createWorkflow(payload).subscribe({
      next: (createdWorkflow) => {
        this.closeCreateForm();
        this.searchQuery.set('');
        this.selectedStatus.set('');
        this.data.upsertWorkflow(createdWorkflow);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err?.error?.error || 'Erreur lors de la creation du workflow');
      }
    });
  }

  protected validateWorkflow(workflow: Workflow): void {
    this.workflowService.validateWorkflow(workflow.id).subscribe({
      next: (result) => {
        alert(result.valid ? 'Workflow valide et pret a executer.' : `Workflow invalide:\n${result.errors.join('\n')}`);
      },
      error: () => this.error.set('Erreur lors de la validation')
    });
  }

  protected openRunForm(workflow: Workflow): void {
    this.runWorkflowTarget.set(workflow);
    this.runPrompt.set(this.defaultPromptFor(workflow));
    this.running.set(false);
  }

  protected navigateToBuilder(workflow: Workflow): void {
    this.router.navigate(['/workflows', workflow.id, 'builder']);
  }

  protected navigateToEditor(workflow: Workflow): void {
    this.router.navigate(['/workflows', workflow.id, 'edit']);
  }

  protected navigateToPlayground(workflow: Workflow): void {
    this.router.navigate(['/workflows', workflow.id, 'run']);
  }

  protected closeRunForm(): void {
    this.runWorkflowTarget.set(null);
    this.runPrompt.set('');
    this.running.set(false);
  }

  protected submitRun(): void {
    const target = this.runWorkflowTarget();
    if (!target || !this.runPrompt().trim()) return;

    this.running.set(true);
    this.error.set(null);
    this.runService.startRun({ workflowId: target.id, prompt: this.runPrompt().trim() }).subscribe({
      next: (run) => {
        this.closeRunForm();
        this.data.refreshRuns();
        this.router.navigate(['/runs'], { queryParams: { runId: run.id } });
      },
      error: (err) => {
        this.running.set(false);
        this.error.set(err?.error?.error || 'Erreur lors du lancement de l execution');
      }
    });
  }

  protected promptExamples(): string[] {
    const target = this.runWorkflowTarget();
    if (!target) return [];
    if (this.isWeatherWorkflow(target)) return ['Tunis', 'Paris', 'London'];
    return [
      'This product is excellent. Customers love the speed and the support team is great.',
      'The delivery was late and the experience was poor, but the support team helped.',
      'Translate this feedback to English, summarize it, then extract the key sentiment.'
    ];
  }

  protected deleteWorkflow(id: string): void {
    if (confirm('Supprimer ce workflow et ses runs ?')) {
      this.workflowService.deleteWorkflow(id).subscribe({
        next: () => this.data.removeWorkflow(id),
        error: () => this.error.set('Erreur lors de la suppression')
      });
    }
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = { DRAFT: 'Brouillon', RUNNING: 'En cours', SUCCESS: 'Reussi', FAILED: 'Echoue' };
    return labels[status] || status;
  }

  protected trackWorkflow(_index: number, workflow: Workflow): string { return workflow.id; }
  protected trackNode(_index: number, node: WorkflowNode): string { return node.id; }
  protected trackAgent(_index: number, agent: Agent): string { return agent.id; }

  private findAgent(name: string): Agent | undefined {
    return this.agents().find((agent) => agent.name.toLowerCase() === name);
  }

  private findAgentById(id: string): Agent | undefined {
    return this.agents().find((agent) => agent.id === id);
  }

  private defaultPromptFor(workflow: Workflow): string {
    if (this.isWeatherWorkflow(workflow)) return 'Tunis';
    return 'This product is excellent. Customers love the speed and the support team is great.';
  }

  private isWeatherWorkflow(workflow: Workflow): boolean {
    const haystack = `${workflow.name} ${workflow.nodes.map((node) => node.label).join(' ')}`.toLowerCase();
    return haystack.includes('weather') || haystack.includes('forecast') || haystack.includes('geocode');
  }

  private buildWorkflowPayload(useFormName: boolean): WorkflowCreate {
    const name = useFormName ? this.newWorkflowName().trim() : 'preview';
    const summarize = this.findAgent('summarize');
    const sentiment = this.findAgent('sentiment');
    const translate = this.findAgent('translate');
    const geocode = this.findAgent('geocode');
    const forecast = this.findAgent('forecast');

    if (this.selectedTemplate() === 'summarize' && summarize) return this.linearWorkflow(name, [summarize], ['Summarize Text']);
    if (this.selectedTemplate() === 'sentiment' && sentiment) return this.linearWorkflow(name, [sentiment], ['Analyze Sentiment']);
    if (this.selectedTemplate() === 'translate-summary' && translate && summarize) return this.linearWorkflow(name, [translate, summarize], ['Translate to English', 'Summarize Translation']);
    if (this.selectedTemplate() === 'weather' && geocode && forecast) return this.linearWorkflow(name, [geocode, forecast], ['Geocode City', 'Get Forecast']);

    if (this.selectedTemplate() === 'custom-chain') {
      const chain = this.selectedChainAgentIds().map((id) => this.findAgentById(id)).filter((agent): agent is Agent => !!agent);
      return this.linearWorkflow(name, chain, chain.map((agent) => agent.name));
    }

    const selected = this.findAgentById(this.selectedAgentId());
    return selected ? this.linearWorkflow(name, [selected], [selected.name]) : { name, nodes: [], edges: [], variables: {} };
  }

  private linearWorkflow(name: string, agents: Agent[], labels: string[]): WorkflowCreate {
    const nodes = agents.map((agent, index) => this.node(`node-${index + 1}`, agent, labels[index] ?? agent.name, 120 + index * 360, 180, this.mappingFor(agent, index)));
    const edges = nodes.slice(1).map((node, index) => ({
      id: `edge-${index + 1}`,
      source: nodes[index].id,
      target: node.id,
      sourceHandle: 'output',
      targetHandle: 'input'
    }));
    return { name, nodes, edges, variables: {} };
  }

  private node(id: string, agent: Agent, label: string, x: number, y: number, mappingIn: Record<string, unknown>): WorkflowNode {
    return { id, agentId: agent.id, label, position: { x, y }, config: {}, mappingIn, mappingOut: {}, errorPolicy: 'STOP', maxRetries: 1, backoffMs: 1000 };
  }

  private mappingFor(agent: Agent, index: number): Record<string, unknown> {
    const source = index === 0 ? '{{prompt}}' : `{{node-${index}.result}}`;
    if (agent.name === 'geocode') return { city: source };
    if (agent.name === 'forecast') return index === 0 ? { latitude: '36.8065', longitude: '10.1815' } : { latitude: `{{node-${index}.results[0].latitude}}`, longitude: `{{node-${index}.results[0].longitude}}` };
    if (agent.name === 'translate') return { text: source, toLang: 'en' };
    if (agent.name === 'summarize') return { text: source, max_points: 3, language: 'en' };
    if (agent.name === 'sentiment') return { text: source, language: 'en' };
    const properties = (agent.schemaIn?.['properties'] ?? {}) as Record<string, unknown>;
    const key = Object.keys(properties)[0] || 'text';
    return { [key]: source };
  }
}
