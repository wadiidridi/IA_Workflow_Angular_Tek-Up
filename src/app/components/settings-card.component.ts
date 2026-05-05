import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SettingItem {
  label: string;
  value: string;
}

@Component({
  selector: 'app-settings-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="settings-card">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
      <div class="setting-row" *ngFor="let item of items">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </article>
  `,
  styles: [
    `
      .settings-card {
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.10);
        border-radius: 1.35rem;
        padding: 1.5rem;
        display: grid;
        gap: 1rem;
      }

      h3 {
        margin: 0;
      }

      p {
        margin: 0;
        color: #94a3b8;
      }

      .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(148, 163, 184, 0.06);
      }

      .setting-row span {
        color: #cbd5e1;
      }

      .setting-row strong {
        color: #f8fafc;
      }
    `
  ]
})
export class SettingsCardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() items: SettingItem[] = [];
}
