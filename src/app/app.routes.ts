import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { mfaChallengeGuard } from './core/auth/mfa-challenge.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: 'login/mfa',
    canActivate: [mfaChallengeGuard],
    loadComponent: () =>
      import('./features/auth/mfa-verification/mfa-verification.component').then(
        (m) => m.MfaVerificationComponent,
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },

  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['Admin'])],
    loadComponent: () => import('./shared/layouts/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'pos',
        loadComponent: () =>
          import('./features/admin/pos/pos.component').then((m) => m.AdminPosComponent),
      },
      {
        path: 'cash-register',
        loadComponent: () =>
          import('./features/seller/cash-register/cash-register.component').then(
            (m) => m.SellerCashRegisterComponent,
          ),
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/admin/sales/sales.component').then((m) => m.AdminSalesComponent),
      },
      {
        path: 'settlements',
        loadComponent: () =>
          import('./features/admin/settlements/settlements.component').then(
            (m) => m.AdminSettlementsComponent,
          ),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/admin/inventory/inventory.component').then(
            (m) => m.AdminInventoryComponent,
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/admin/reports/reports.component').then((m) => m.AdminReportsComponent),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/admin/tasks/tasks.component').then((m) => m.AdminTasksComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin/settings/settings.component').then(
            (m) => m.AdminSettingsComponent,
          ),
      },
    ],
  },

  {
    path: 'brand-manager',
    canActivate: [authGuard, roleGuard(['BrandManager'])],
    loadComponent: () => import('./shared/layouts/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/brand-manager/dashboard/dashboard.component').then(
            (m) => m.BrandManagerDashboardComponent,
          ),
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/brand-manager/sales/sales.component').then(
            (m) => m.BrandManagerSalesComponent,
          ),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/brand-manager/inventory/inventory.component').then(
            (m) => m.BrandManagerInventoryComponent,
          ),
      },
      {
        path: 'settlements',
        loadComponent: () =>
          import('./features/brand-manager/settlements/settlements.component').then(
            (m) => m.BrandManagerSettlementsComponent,
          ),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./features/shared/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent,
          ),
      },
    ],
  },

  {
    path: 'seller',
    canActivate: [authGuard, roleGuard(['Seller'])],
    loadComponent: () => import('./shared/layouts/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pos' },
      {
        path: 'pos',
        loadComponent: () =>
          import('./features/seller/pos/pos.component').then((m) => m.SellerPosComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/seller/inventory/inventory.component').then(
            (m) => m.SellerInventoryComponent,
          ),
      },
      {
        path: 'cash-register',
        loadComponent: () =>
          import('./features/seller/cash-register/cash-register.component').then(
            (m) => m.SellerCashRegisterComponent,
          ),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/seller/tasks/tasks.component').then((m) => m.SellerTasksComponent),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./features/shared/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent,
          ),
      },
    ],
  },

  { path: '', pathMatch: 'full', redirectTo: '/login' },
  { path: '**', redirectTo: '/login' },
];
