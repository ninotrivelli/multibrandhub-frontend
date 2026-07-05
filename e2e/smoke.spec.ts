import { test, expect, type Page } from '@playwright/test';

import {
  collectSmokeWatchers,
  expectRouteReady,
  expectSmokeClean,
  gotoAs,
  installSmokeClock,
  installSession,
  mockSmokeApi,
  type SmokeWatchers,
} from './support/smoke-app';
import type { SmokeRole } from '../src/testing/smoke-fixtures';

let watchers: SmokeWatchers;

test.beforeEach(async ({ page }) => {
  watchers = collectSmokeWatchers(page);
  await installSmokeClock(page);
  await mockSmokeApi(page, watchers);
});

test.afterEach(async () => {
  expectSmokeClean(watchers);
});

test.describe('auth and role guards', () => {
  test('redirects protected routes to login without a session', async ({ page }) => {
    await installSession(page, null);
    await page.goto('/admin/inventory');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'MultiBrandHub' })).toBeVisible();
    await expect(page.getByText('Ingresá con tu cuenta')).toBeVisible();
  });

  test('redirects role-mismatched users to their own home', async ({ page }) => {
    await gotoAs(page, 'BrandManager', '/admin/settings');
    await expectRouteReady(page, /\/brand-manager\/dashboard$/, 'Mi Resumen');

    await gotoAs(page, 'Seller', '/admin/settings');
    await expectRouteReady(page, /\/seller\/pos$/, 'Ingresar Venta');

    await gotoAs(page, 'Admin', '/seller/pos');
    await expectRouteReady(page, /\/admin\/dashboard$/, 'Inicio');
  });
});

test.describe('route sweep', () => {
  const cases: Record<SmokeRole, Array<{ path: string; heading: string }>> = {
    Admin: [
      { path: '/admin/dashboard', heading: 'Inicio' },
      { path: '/admin/pos', heading: 'Ingresar Venta' },
      { path: '/admin/sales', heading: 'Ventas' },
      { path: '/admin/settlements', heading: 'Liquidaciones' },
      { path: '/admin/inventory', heading: 'Control de Inventario' },
      { path: '/admin/reports', heading: 'Centro de Reportes' },
      { path: '/admin/tasks', heading: 'Tareas' },
      { path: '/admin/settings', heading: 'Configuración' },
    ],
    BrandManager: [
      { path: '/brand-manager/dashboard', heading: 'Mi Resumen' },
      { path: '/brand-manager/sales', heading: 'Ventas' },
      { path: '/brand-manager/inventory', heading: 'Mi Stock' },
      { path: '/brand-manager/settlements', heading: 'Liquidaciones' },
      { path: '/brand-manager/configuracion', heading: 'Configuración' },
    ],
    Seller: [
      { path: '/seller/pos', heading: 'Ingresar Venta' },
      { path: '/seller/inventory', heading: 'Control de Inventario' },
      { path: '/seller/cash-register', heading: 'Caja' },
      { path: '/seller/tasks', heading: 'Tareas Diarias' },
      { path: '/seller/configuracion', heading: 'Configuración' },
    ],
  };

  for (const [role, routes] of Object.entries(cases) as Array<
    [SmokeRole, (typeof cases)[SmokeRole]]
  >) {
    test(`${role} can render every sidebar route`, async ({ page }) => {
      await installSession(page, role);

      for (const route of routes) {
        await page.goto(route.path);
        await page.waitForLoadState('networkidle');
        await expectRouteReady(
          page,
          new RegExp(`${route.path.replace(/\//g, '\\/')}$`),
          route.heading,
        );
      }
    });
  }
});

test.describe('deep smoke interactions', () => {
  test('Admin Inicio shows operational data and navigates key shortcuts', async ({ page }) => {
    await gotoAs(page, 'Admin', '/admin/dashboard');

    await expect(page.getByText('Ventas de hoy')).toBeVisible();
    await expect(page.getByText('Atención requerida')).toBeVisible();
    await expect(page.getByRole('link', { name: /Caja cerrada La caja del local/ })).toBeVisible();
    await expect(page.getByText('Reponer bolsas')).toBeVisible();

    await page.getByRole('link', { name: /Ventas de hoy/ }).click();
    await expect(page).toHaveURL(/\/admin\/sales\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();

    await gotoAs(page, 'Admin', '/admin/dashboard');
    await page.getByRole('link', { name: /Alertas de stock/ }).click();
    await expect(page).toHaveURL(/\/admin\/inventory\?kpi=alerts$/);
    await expect(page.getByRole('heading', { name: 'Control de Inventario' })).toBeVisible();

    await gotoAs(page, 'Admin', '/admin/dashboard');
    await page.getByRole('checkbox', { name: 'Marcar como completada' }).first().click();
    await expect(page.getByText('Reponer bolsas')).toHaveCount(0);

    await gotoAs(page, 'Admin', '/admin/dashboard');
    await page.getByRole('link', { name: /Nueva Venta/ }).first().click();
    await expectRouteReady(page, /\/admin\/pos$/, 'Ingresar Venta');
  });

  test('BrandManager Mi Resumen shows brand data and navigates shortcuts', async ({ page }) => {
    await gotoAs(page, 'BrandManager', '/brand-manager/dashboard');

    await expect(page.getByText('Ventas del mes')).toBeVisible();
    await expect(page.getByText('Top 10 productos')).toBeVisible();
    await expect(page.getByText('Producto estrella')).toBeVisible();
    await expect(page.getByText('A favor de tu marca').first()).toBeVisible();
    await expect(page.getByText('Stock a revisar')).toBeVisible();

    await page.getByRole('link', { name: /Ver mis ventas/ }).first().click();
    await expectRouteReady(page, /\/brand-manager\/sales$/, 'Ventas');

    await gotoAs(page, 'BrandManager', '/brand-manager/dashboard');
    await page.getByRole('link', { name: /Ver stock/ }).click();
    await expect(page).toHaveURL(/\/brand-manager\/inventory\?kpi=alerts$/);
    await expect(page.getByRole('heading', { name: 'Mi Stock' })).toBeVisible();

    await gotoAs(page, 'BrandManager', '/brand-manager/dashboard');
    await page.getByRole('button', { name: 'Últimos 3 meses' }).click();
    await expect(page.getByText(/1 de abril al 30 de junio/)).toBeVisible();
  });

  test('Admin inventory opens product, import, movement dialogs and movements tab', async ({
    page,
  }) => {
    await gotoAs(page, 'Admin', '/admin/inventory');

    await page.getByRole('button', { name: 'Nuevo Artículo' }).click();
    await expect(page.getByRole('dialog', { name: 'Crear Nuevo Artículo' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).last().click();

    await page.getByRole('button', { name: 'Importar varios artículos' }).click();
    await expect(page.getByRole('dialog', { name: 'Importar varios artículos' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).last().click();

    await page.getByRole('button', { name: 'Reg. Movimiento' }).click();
    await expect(page.getByRole('dialog', { name: 'Registrar Movimiento' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).last().click();

    await page.getByRole('button', { name: 'Movimientos' }).click();
    await expect(page.getByText('Mostrando 1 a')).toBeVisible();
  });

  test('Seller cash register opens and records a manual movement', async ({ page }) => {
    await gotoAs(page, 'Seller', '/seller/cash-register');

    await page.getByLabel('Efectivo inicial').fill('1000');
    await page.getByRole('button', { name: 'Abrir Caja' }).click();
    await expect(page.getByText('Caja abierta')).toBeVisible();

    await page.getByRole('button', { name: 'Registrar movimiento' }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar movimiento' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Salida' }).click();
    await dialog.getByLabel('Monto').fill('150');
    await dialog.getByLabel('Descripción').fill('Pago distribuidor');
    await dialog.getByLabel('Notas').fill('Factura D-100');
    await dialog.getByRole('button', { name: 'Registrar movimiento' }).click();

    await expect(page.getByText('Pago distribuidor')).toBeVisible();
    await expect(page.getByText('Factura D-100')).toBeVisible();
    await expect(page.getByText('Salidas manuales')).toBeVisible();
  });

  test('inventory permissions differ correctly by role', async ({ page }) => {
    await gotoAs(page, 'BrandManager', '/brand-manager/inventory');
    await expect(page.getByRole('heading', { name: 'Mi Stock' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo Artículo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Importar varios artículos' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reg. Movimiento' })).toHaveCount(0);

    await gotoAs(page, 'Seller', '/seller/inventory');
    await expect(page.getByRole('button', { name: 'Nuevo Artículo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importar varios artículos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reg. Movimiento' })).toBeVisible();
  });

  test('Admin settings renders all tabs and opens user/brand dialogs', async ({ page }) => {
    await gotoAs(page, 'Admin', '/admin/settings');

    await page.getByRole('tab', { name: 'Marcas Asociadas' }).click();
    await expect(page.getByRole('heading', { name: 'Marcas Asociadas' })).toBeVisible();
    await page.getByRole('button', { name: 'Nueva Marca' }).click();
    await expect(page.getByRole('dialog', { name: 'Nueva Marca' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).last().click();

    await page.getByRole('tab', { name: 'Equipo' }).click();
    await expect(page.getByRole('heading', { name: 'Equipo' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo Usuario' }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo Usuario' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).last().click();

    await page.getByRole('tab', { name: 'Ajustes Generales' }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes Generales' })).toBeVisible();
    await expect(page.getByLabel('Ajustes Generales').getByText('Local Smoke')).toBeVisible();
  });

  test('self-service settings opens password dialog and changes theme', async ({ page }) => {
    await gotoAs(page, 'BrandManager', '/brand-manager/configuracion');

    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByRole('dialog', { name: 'Cambiar mi contraseña' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('radio', { name: /Fresco/ }).click();
    await expect(page.getByRole('radio', { name: /Fresco/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('POS can add a product and open the sale review for Admin and Seller', async ({ page }) => {
    for (const role of ['Admin', 'Seller'] as const) {
      await smokePosSaleReview(page, role);
    }
  });

  test('sales dashboards render for Admin and BrandManager without chart/runtime errors', async ({
    page,
  }) => {
    await gotoAs(page, 'Admin', '/admin/sales');
    await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
    await expect(page.getByText('Total vendido')).toBeVisible();
    await expect(page.getByText('TCK-SMOKE-001')).toBeVisible();

    await gotoAs(page, 'BrandManager', '/brand-manager/sales');
    await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
    await expect(page.getByText('Total vendido')).toBeVisible();
    await expect(page.getByText('TCK-SMOKE-001')).toBeVisible();
  });

  test('Admin reports can select a template and generate a preview', async ({ page }) => {
    await gotoAs(page, 'Admin', '/admin/reports');

    await expect(page.getByRole('heading', { name: 'Centro de Reportes' })).toBeVisible();
    await page.getByRole('button', { name: /Ventas detalladas/ }).click();
    await page.getByRole('button', { name: 'Vista previa' }).click();

    await expect(page.getByText('Ventas netas')).toBeVisible();
    await expect(page.getByText('TCK-SMOKE-001')).toBeVisible();
    await expect(page.getByText('Camisa Serena')).toBeVisible();
  });

  test('settlements dashboards render persisted rows and detail by role', async ({ page }) => {
    await gotoAs(page, 'Admin', '/admin/settlements');
    await expect(page.getByRole('heading', { name: 'Liquidaciones', exact: true })).toBeVisible();
    await expect(page.getByText('Lumina')).toBeVisible();
    await expect(page.getByText('La marca debe pagar al local').first()).toBeVisible();
    await page.getByRole('row', { name: /Lumina/ }).first().click();
    const adminDetail = page.getByRole('dialog', { name: 'Detalle de liquidación' });
    await expect(adminDetail).toBeVisible();
    await expect(adminDetail.getByText('Saldo final').first()).toBeVisible();

    await gotoAs(page, 'BrandManager', '/brand-manager/settlements');
    await expect(page.getByRole('heading', { name: 'Liquidaciones', exact: true })).toBeVisible();
    await expect(page.getByText('Balance de liquidación')).toBeVisible();
    await expect(page.getByText('Lumina').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Generar|Recalcular/ })).toHaveCount(0);
    await page.getByRole('row', { name: /Lumina/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Detalle de liquidación' })).toBeVisible();
  });

  test('mobile drawer can navigate key screens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAs(page, 'Seller', '/seller/pos');

    await page.locator('header button').first().click();
    await page.getByRole('link', { name: 'Configuración' }).click();
    await expectRouteReady(page, /\/seller\/configuracion$/, 'Configuración');

    await page.locator('header button').first().click();
    await page.getByRole('link', { name: 'Inventario' }).click();
    await expectRouteReady(page, /\/seller\/inventory$/, 'Control de Inventario');
  });
});

async function smokePosSaleReview(page: Page, role: SmokeRole): Promise<void> {
  const path = role === 'Admin' ? '/admin/pos' : '/seller/pos';
  await gotoAs(page, role, path);

  await expect(page.getByText('Buzo Oversize')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar a la venta' }).first().click();
  await expect(page.getByText('1 ítem en el ticket')).toBeVisible();
  await page.getByRole('combobox', { name: 'Seleccioná la tarjeta' }).click();
  await page.getByRole('option', { name: 'Visa' }).click();
  await page.getByRole('button', { name: 'Ingresar Venta' }).click();
  // The smoke fixture has no open cash register, so the POS warns before the
  // review (sales aren't blocked, just flagged) — continue past the prompt.
  await page.getByRole('button', { name: 'Continuar igualmente' }).click();
  await expect(page.getByRole('dialog', { name: 'Revisar venta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeVisible();
}
