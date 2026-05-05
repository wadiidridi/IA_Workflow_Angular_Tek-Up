import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PageHeadingComponent } from '../components/page-heading.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHeadingComponent],
  template: `
    <app-page-heading
      eyebrow="Connexion"
      title="Accédez à votre espace TekUp"
      description="Connexion sécurisée pour piloter vos workflows IA et surveiller les indicateurs clés."
    ></app-page-heading>

    <section class="auth-shell">
      <div class="auth-card">
        <form #loginForm="ngForm" (ngSubmit)="submit(loginForm)">
          <label>
            Adresse email
            <input
              name="email"
              [(ngModel)]="credentials.email"
              required
              type="email"
              placeholder="votre@exemple.com"
            />
          </label>

          <label>
            Mot de passe
            <input
              name="password"
              [(ngModel)]="credentials.password"
              required
              type="password"
              placeholder="••••••••"
            />
          </label>

          <button type="submit" [disabled]="loginForm.invalid || loading">
            <span *ngIf="loading" class="spinner"></span>
            <span>{{ loading ? 'Connexion en cours…' : 'Se connecter' }}</span>
          </button>

          <div *ngIf="successMsg()" class="alert-success">
            <span class="alert-icon">✓</span>
            <span>{{ successMsg() }}</span>
          </div>

          <div *ngIf="error()" class="alert-error" (click)="dismissError()">
            <span class="alert-icon">✕</span>
            <span>{{ error() }}</span>
            <small class="alert-hint">Cliquer pour fermer</small>
          </div>

          <div class="hint-row">
            <span>Pas encore de compte ?</span>
            <a [routerLink]="['/settings']">Créer un espace</a>
          </div>
        </form>

        <div class="login-help">
          <div>
            <strong>Support 24/7</strong>
            <p>Assistance continue pour vos déploiements et automatisations.</p>
          </div>
          <div>
            <strong>Intégrations</strong>
            <p>Connexion avec vos outils CRM, ticketing et data science.</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        display: grid;
        place-items: center;
        min-height: 70vh;
        padding: 2rem 0;
      }

      .auth-card {
        width: min(560px, 100%);
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.10);
        border-radius: 1.5rem;
        padding: 2.2rem;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.32);
      }

      form {
        display: grid;
        gap: 1.25rem;
      }

      label {
        display: grid;
        gap: 0.55rem;
        color: #cbd5e1;
        font-size: 0.95rem;
      }

      input {
        width: 100%;
        border-radius: 0.95rem;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(15, 23, 42, 0.8);
        color: #e2e8f0;
        padding: 0.95rem 1rem;
      }

      button {
        width: 100%;
        padding: 0.95rem 1.25rem;
        border: none;
        border-radius: 999px;
        background: linear-gradient(135deg, #38bdf8, #818cf8);
        color: #020617;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s ease, opacity 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      button:not(:disabled):hover {
        transform: translateY(-1px);
      }

      .spinner {
        width: 1.1rem;
        height: 1.1rem;
        border: 2.5px solid rgba(2, 6, 23, 0.25);
        border-top-color: #020617;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        flex-shrink: 0;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .alert-success,
      .alert-error {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.85rem 1rem;
        border-radius: 0.9rem;
        font-size: 0.9rem;
        margin-top: 0.5rem;
        animation: alert-in 0.3s ease both;
      }

      .alert-success {
        background: rgba(34, 197, 94, 0.14);
        border: 1px solid rgba(34, 197, 94, 0.3);
        color: #86efac;
      }

      .alert-error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.28);
        color: #fca5a5;
        cursor: pointer;
        flex-wrap: wrap;
      }

      .alert-icon {
        font-size: 1rem;
        font-weight: 900;
        flex-shrink: 0;
        margin-top: 0.05rem;
      }

      .alert-hint {
        width: 100%;
        margin-left: 1.65rem;
        font-size: 0.75rem;
        opacity: 0.65;
      }

      @keyframes alert-in {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .hint-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #94a3b8;
        margin-top: 0.65rem;
        font-size: 0.95rem;
      }

      .hint-row a {
        color: #38bdf8;
        text-decoration: none;
      }

      .login-help {
        margin-top: 2rem;
        display: grid;
        gap: 1rem;
      }

      .login-help div {
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(148, 163, 184, 0.06);
      }

      .login-help strong {
        display: block;
        margin-bottom: 0.4rem;
        color: #f8fafc;
      }

      .login-help p {
        margin: 0;
        color: #cbd5e1;
      }

      @media (max-width: 640px) {
        .auth-card {
          padding: 1.5rem;
        }
      }
    `
  ]
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected credentials = {
    email: '',
    password: ''
  };

  protected loading = false;
  protected readonly error = signal<string | null>(null);
  protected readonly successMsg = signal<string | null>(null);

  protected dismissError(): void {
    this.error.set(null);
  }

  protected submit(form: NgForm): void {
    if (form.valid !== true) {
      return;
    }
    this.loading = true;
    this.error.set(null);
    this.successMsg.set(null);

    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg.set('Connexion réussie ! Redirection en cours…');
        setTimeout(() => this.router.navigate(['/']), 1000);
      },
      error: () => {
        this.loading = false;
        this.error.set('Email ou mot de passe incorrect. Veuillez réessayer.');
      }
    });
  }
}
