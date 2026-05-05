import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../services/agent.service';
import { AppDataService } from '../services/app-data.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { Agent, PaginatedResponse } from '../models';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeadingComponent],
  template: `
    <app-page-heading
      eyebrow="Agents"
      title=""
      description=""
    ></app-page-heading>

    <section class="card-panel">
      <div class="panel-header">
        <h2>Agents </h2>
        <button class="btn-primary" (click)="showCreateForm = true">+ Nouvel agent</button>
      </div>

      <div class="filters">
        <input
          type="text"
          placeholder="Rechercher par nom ou famille..."
          [(ngModel)]="searchQuery"
          (input)="onSearch()"
          class="search-input"
        />
        <select [(ngModel)]="selectedFamily" (change)="onFilterChange()" class="filter-select">
          <option value="">Toutes les familles</option>
          <option value="nlp">NLP</option>
          <option value="utils">Utils</option>
          <option value="weather">Weather</option>
          <option value="cv">Computer Vision</option>
          <option value="ml">Machine Learning</option>
        </select>
      </div>

      <div *ngIf="loading" class="status-message">Chargement des agents...</div>
      <div *ngIf="error" class="status-message error">{{ error }}</div>

      <div class="table-wrapper">
        <table *ngIf="!loading && agents.length > 0" class="agents-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Famille</th>
              <th>Version</th>
              <th>Endpoint</th>
              <th>Tags</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let agent of agents">
              <td>{{ agent.name }}</td>
              <td>{{ agent.family }}</td>
              <td>{{ agent.version }}</td>
              <td class="endpoint-cell" [title]="agent.endpointUrl"><code>{{ agent.endpointUrl }}</code></td>
              <td>
                <span *ngFor="let tag of agent.tags" class="tag">{{ tag }}</span>
              </td>
              <td>
                <span class="status" [class.active]="agent.active">
                  {{ agent.active ? 'Actif' : 'Inactif' }}
                </span>
              </td>
              <td class="actions">
                <button (click)="editAgent(agent)" class="btn-small">Éditer</button>
                <button (click)="deleteAgent(agent.id)" class="btn-small danger">Supprimer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && agents.length === 0" class="status-message">
        Aucun agent trouvé
      </div>
    </section>

    <!-- Modal de création/édition -->
    <div *ngIf="showCreateForm" class="modal-overlay" (click)="closeForm()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>{{ editingAgent ? 'Éditer l\'agent' : 'Créer un nouvel agent' }}</h3>
        <form (ngSubmit)="saveAgent()">
          <div class="form-group">
            <label>Nom</label>
            <input type="text" [(ngModel)]="formData.name" name="name" required />
          </div>
          <div class="form-group">
            <label>Famille</label>
            <input type="text" [(ngModel)]="formData.family" name="family" required />
          </div>
          <div class="form-group">
            <label>Version</label>
            <input type="text" [(ngModel)]="formData.version" name="version" required />
          </div>
          <div class="form-group">
            <label>Endpoint URL</label>
            <input type="text" [(ngModel)]="formData.endpointUrl" name="endpointUrl" required />
          </div>
          <div class="form-actions">
            <button type="button" (click)="closeForm()" class="btn-secondary">
              Annuler
            </button>
            <button type="submit" class="btn-primary">
              {{ editingAgent ? 'Mettre à jour' : 'Créer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .card-panel {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 1.25rem;
      padding: 1.5rem;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .search-input, .filter-select {
      padding: 0.75rem;
      border-radius: 0.75rem;
      background: rgba(148, 163, 184, 0.1);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #e2e8f0;
    }

    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 0.75rem;
    }

    .agents-table {
      width: 100%;
      min-width: 700px;
      border-collapse: collapse;
    }

    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      white-space: nowrap;
    }

    td.endpoint-cell {
      max-width: 220px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    th {
      font-weight: 600;
      color: #94a3b8;
      font-size: 0.9rem;
      position: sticky;
      top: 0;
      background: rgba(15, 23, 42, 0.98);
    }

    td {
      color: #e2e8f0;
    }

    code {
      background: rgba(148, 163, 184, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.82rem;
      display: inline-block;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }

    .tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      border-radius: 999px;
      font-size: 0.85rem;
      margin-right: 0.5rem;
    }

    .status {
      display: inline-flex;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      font-size: 0.85rem;
      background: rgba(239, 68, 68, 0.2);
      color: #fecaca;
    }

    .status.active {
      background: rgba(22, 163, 74, 0.2);
      color: #86efac;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-small {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .btn-small.danger {
      background: rgba(239, 68, 68, 0.2);
      color: #fecaca;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 1rem;
      padding: 2rem;
      min-width: 400px;
      max-width: 600px;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border-radius: 0.75rem;
      background: rgba(148, 163, 184, 0.1);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #e2e8f0;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    .btn-primary, .btn-secondary {
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-secondary {
      background: rgba(148, 163, 184, 0.2);
      color: #cbd5e1;
    }

    .status-message {
      padding: 1rem;
      border-radius: 0.75rem;
      background: rgba(148, 163, 184, 0.1);
      color: #cbd5e1;
      text-align: center;
    }

    .status-message.error {
      background: rgba(239, 68, 68, 0.1);
      color: #fecaca;
    }

    /* ---- Responsive ---- */
    @media (max-width: 860px) {
      .card-panel { padding: 1rem; }

      .filters {
        flex-direction: column;
      }

      .search-input, .filter-select {
        width: 100%;
      }
    }

    @media (max-width: 540px) {
      .panel-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .panel-header button {
        width: 100%;
      }

      .modal-content {
        min-width: unset;
        width: calc(100vw - 2rem);
        padding: 1.25rem;
        max-height: 90vh;
        overflow-y: auto;
      }
    }
  `]
})
export class AgentsComponent implements OnInit {
  protected agents: Agent[] = [];
  protected loading = true;
  protected error: string | null = null;
  protected showCreateForm = false;
  protected editingAgent: Agent | null = null;
  protected searchQuery = '';
  protected selectedFamily = '';
  protected formData = { name: '', family: '', version: '', endpointUrl: '' };

  private readonly agentService = inject(AgentService);
  private readonly data = inject(AppDataService);

  ngOnInit(): void {
    const cachedAgents = this.data.activeAgents();
    if (cachedAgents.length > 0) {
      this.agents = cachedAgents;
      this.loading = false;
    }
    this.loadAgents();
  }

  private loadAgents(): void {
    this.loading = true;
    this.agentService.getAgents({
      search: this.searchQuery || undefined,
      family: this.selectedFamily || undefined
    }).subscribe({
      next: (response) => {
        this.agents = response.data;
        this.data.agents.set(response.data);
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement des agents';
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.loadAgents();
  }

  onFilterChange(): void {
    this.loadAgents();
  }

  editAgent(agent: Agent): void {
    this.editingAgent = agent;
    this.formData = {
      name: agent.name,
      family: agent.family,
      version: agent.version,
      endpointUrl: agent.endpointUrl
    };
    this.showCreateForm = true;
  }

  saveAgent(): void {
    const payload = {
      ...this.formData,
      schemaIn: { type: 'object', properties: { prompt: { type: 'string' } } },
      schemaOut: { type: 'object', properties: { result: { type: 'string' } } },
      tags: this.formData.family ? [this.formData.family] : []
    };

    if (this.editingAgent) {
      this.agentService.updateAgent(this.editingAgent.id, payload).subscribe({
        next: (updatedAgent) => {
          this.closeForm();
          this.agents = this.agents.map((agent) => agent.id === updatedAgent.id ? updatedAgent : agent);
          this.data.agents.set(this.agents);
        },
        error: () => this.error = 'Erreur lors de la mise à jour'
      });
    } else {
      this.agentService.createAgent(payload).subscribe({
        next: (createdAgent) => {
          this.closeForm();
          this.searchQuery = '';
          this.selectedFamily = '';
          this.agents = [createdAgent, ...this.agents.filter((agent) => agent.id !== createdAgent.id)];
          this.data.agents.set(this.agents);
        },
        error: () => this.error = 'Erreur lors de la création'
      });
    }
  }

  deleteAgent(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet agent ?')) {
      this.agentService.deleteAgent(id).subscribe({
        next: () => this.loadAgents(),
        error: () => this.error = 'Erreur lors de la suppression'
      });
    }
  }

  closeForm(): void {
    this.showCreateForm = false;
    this.editingAgent = null;
    this.formData = { name: '', family: '', version: '', endpointUrl: '' };
  }
}

