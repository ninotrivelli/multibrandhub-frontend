import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },

  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['Admin'])],
    loadComponent: () =>
      import('./shared/layouts/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then((m) => m.AdminDashboardComponent)
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/admin/sales/sales.component').then((m) => m.AdminSalesComponent)
      },
      {
        path: 'settlements',
        loadComponent: () =>
          import('./features/admin/settlements/settlements.component').then(
            (m) => m.AdminSettlementsComponent
          )
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/admin/inventory/inventory.component').then(
            (m) => m.AdminInventoryComponent
          )
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/admin/reports/reports.component').then((m) => m.AdminReportsComponent)
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/admin/tasks/tasks.component').then((m) => m.AdminTasksComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin/settings/settings.component').then((m) => m.AdminSettingsComponent)
      }
    ]
  },

  {
    path: 'brand-manager',
    canActivate: [authGuard, roleGuard(['BrandManager'])],
    loadComponent: () =>
      import('./shared/layouts/brand-manager-layout/brand-manager-layout').then(
        (m) => m.BrandManagerLayout
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/brand-manager/dashboard/dashboard.component').then(
            (m) => m.BrandManagerDashboardComponent
          )
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/brand-manager/sales/sales.component').then(
            (m) => m.BrandManagerSalesComponent
          )
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/brand-manager/inventory/inventory.component').then(
            (m) => m.BrandManagerInventoryComponent
          )
      },
      {
        path: 'settlements',
        loadComponent: () =>
          import('./features/brand-manager/settlements/settlements.component').then(
            (m) => m.BrandManagerSettlementsComponent
          )
      }
    ]
  },

  {
    path: 'seller',
    canActivate: [authGuard, roleGuard(['Seller'])],
    loadComponent: () =>
      import('./shared/layouts/seller-layout/seller-layout').then((m) => m.SellerLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pos' },
      {
        path: 'pos',
        loadComponent: () =>
          import('./features/seller/pos/pos.component').then((m) => m.SellerPosComponent)
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/seller/inventory/inventory.component').then(
            (m) => m.SellerInventoryComponent
          )
      },
      {
        path: 'cash-register',
        loadComponent: () =>
          import('./features/seller/cash-register/cash-register.component').then(
            (m) => m.SellerCashRegisterComponent
          )
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/seller/tasks/tasks.component').then((m) => m.SellerTasksComponent)
      }
    ]
  },

  { path: '', pathMatch: 'full', redirectTo: '/login' },
  { path: '**', redirectTo: '/login' }
];
