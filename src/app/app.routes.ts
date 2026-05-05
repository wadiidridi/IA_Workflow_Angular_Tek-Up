import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'workflows',
    title: 'Workflows',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/workflow-list.component').then((m) => m.WorkflowListComponent)
  },
  {
    path: 'workflows/:id/builder',
    title: 'Workflow Pro',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/workflow-builder.component').then((m) => m.WorkflowBuilderComponent)
  },
  {
    path: 'workflows/:id/edit',
    title: 'Workflow Editor',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/workflow-editor.component').then((m) => m.WorkflowEditorComponent)
  },
  {
    path: 'workflows/:id/run',
    title: 'Workflow Playground',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/workflow-playground.component').then((m) => m.WorkflowPlaygroundComponent)
  },
  {
    path: 'agents',
    title: 'Agents',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/agents.component').then((m) => m.AgentsComponent)
  },
  {
    path: 'runs',
    title: 'Executions',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/runs.component').then((m) => m.RunsComponent)
  },
  {
    path: 'settings',
    title: 'Paramètres',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings.component').then((m) => m.SettingsComponent)
  },
  {
    path: 'login',
    title: 'Connexion',
    loadComponent: () => import('./pages/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
