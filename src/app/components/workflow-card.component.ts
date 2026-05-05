import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workflow-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="workflow-card">
      <div class="card-header">
        <span class="workflow-name">{{ name }}</span>
        <span class="workflow-status" [class.active]="statusClass === 'active'" [class.paused]="statusClass === 'paused'" [class.error]="statusClass === 'error'">{{ status }}</span>
      </div>
      <p>{{ description }}</p>
      <div class="card-footer">
        <span>{{ updated }}</span>
        <strong>{{ tasks }} tâches</strong>
      </div>
    </article>
  `,
  styles: [
    `
      .workflow-card {
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.10);
        border-radius: 1.4rem;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .workflow-name {
        font-weight: 700;
        color: #f8fafc;
      }

      .workflow-status {
        padding: 0.4rem 0.8rem;
        border-radius: 999px;
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .workflow-status.active {
        color: #4ade80;
        background: rgba(74, 222, 128, 0.16);
      }

      .workflow-status.paused {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.16);
      }

      .workflow-status.error {
        color: #f87171;
        background: rgba(248, 113, 133, 0.16);
      }

      p {
        margin: 0;
        color: #cbd5e1;
      }

      .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #94a3b8;
        font-size: 0.95rem;
      }
    `
  ]
})
export class WorkflowCardComponent {
  @Input() name = '';
  @Input() status = '';
  @Input() statusClass = '';
  @Input() description = '';
  @Input() updated = '';
  @Input() tasks = 0;
}
