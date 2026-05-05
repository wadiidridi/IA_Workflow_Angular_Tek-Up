import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { PageHeadingComponent } from '../components/page-heading.component';
import { SettingsCardComponent, SettingItem } from '../components/settings-card.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent, SettingsCardComponent],
  template: `
    <app-page-heading
      eyebrow="Paramètres"
      title="Personnalisez votre environnement TekUp"
      description="Modifiez les préférences d’accès, la langue et les alertes de vos workflows."
    ></app-page-heading>

    <section class="settings-grid">
      <app-settings-card
        *ngFor="let card of cards"
        [title]="card.title"
        [description]="card.description"
        [items]="card.items"
      ></app-settings-card>
    </section>
  `,
  styles: [
    `
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      @media (max-width: 960px) {
        .settings-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);

  protected get cards() {
    const user = this.auth.currentUser;

    return [
      {
        title: 'Profil',
        description: "Informations de compte et identité de l’utilisateur.",
        items: [
          { label: 'Email', value: user?.email ?? 'Aucun utilisateur' },
          { label: 'Rôle', value: user?.role ?? 'Invité' }
        ] as SettingItem[]
      },
      {
        title: 'Notifications',
        description: 'Gérez les alertes email et mobile.',
        items: [
          { label: 'Alertes workflow', value: 'Activé' },
          { label: 'Résumé quotidien', value: 'Activé' }
        ] as SettingItem[]
      },
      {
        title: 'Intégrations',
        description: 'Connectez les outils CRM, BI et stockage cloud.',
        items: [
          { label: 'CRM', value: 'Salesforce' },
          { label: 'Stockage', value: 'Azure Blob' }
        ] as SettingItem[]
      }
    ];
  }
}
