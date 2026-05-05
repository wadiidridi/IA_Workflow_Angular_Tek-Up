import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="stat-card" [class.accent]="accent">
      <span class="stat-label">{{ label }}</span>
      <strong>{{ value }}</strong>
      <p>{{ description }}</p>
    </article>
  `,
  styles: [
    `
      .stat-card {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.10);
        border-radius: 1.25rem;
        padding: 1.4rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        min-height: 180px;
      }

      .stat-card.accent {
        background: linear-gradient(180deg, rgba(56, 189, 248, 0.15), rgba(59, 130, 246, 0.12));
        border-color: rgba(56, 189, 248, 0.20);
      }

      .stat-label {
        font-size: 0.9rem;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      strong {
        font-size: 2.3rem;
        color: #f8fafc;
        line-height: 1;
      }

      p {
        margin: 0;
        color: #cbd5e1;
      }
    `
  ]
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() description = '';
  @Input() accent = false;
}
