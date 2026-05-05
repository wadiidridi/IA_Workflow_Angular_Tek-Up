import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-heading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-heading">
      <div>
        <span class="eyebrow">{{ eyebrow }}</span>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <div *ngIf="actionLabel" class="action-pill">{{ actionLabel }}</div>
    </section>
  `,
  styles: [
    `
      .page-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .eyebrow {
        display: inline-block;
        color: #38bdf8;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.8rem;
      }

      h2 {
        margin: 0.5rem 0 0;
        font-size: clamp(1.9rem, 2.4vw, 2.4rem);
      }

      p {
        margin: 0.75rem 0 0;
        color: #cbd5e1;
        max-width: 720px;
      }

      .action-pill {
        background: rgba(56, 189, 248, 0.12);
        color: #e0f2fe;
        padding: 0.85rem 1.1rem;
        border-radius: 999px;
        font-weight: 600;
        border: 1px solid rgba(56, 189, 248, 0.24);
      }
    `
  ]
})
export class PageHeadingComponent {
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() description = '';
  @Input() actionLabel?: string;
}
