import {
  BarChart3,
  CirclePlus,
  Home,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Package,
  Receipt,
  Settings,
  Tag
} from 'lucide-angular';
import { faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons';

import { UserRole } from '../../../core/auth/auth.types';
import {
  fa,
  lucide,
  type NavItem,
  type NavSection
} from '../../components/navigation-drawer/navigation-drawer';

export interface RoleNavConfig {
  readonly label: string;
  readonly showRoleBadge: boolean;
  // When true, the top bar shows the store-wide cash register status (open/closed).
  readonly showCashRegisterStatus: boolean;
  readonly sections: ReadonlyArray<NavSection>;
  // Pinned to the bottom of the drawer, separated from the main sections.
  readonly footerItems: ReadonlyArray<NavItem>;
}

const ADMIN_SECTIONS: ReadonlyArray<NavSection> = [
  { items: [{ path: '/admin/dashboard', label: 'Inicio', icon: lucide(Home) }] },
  {
    title: 'Operativa diaria',
    items: [
      { path: '/admin/pos', label: 'Ingresar Venta / Devolución', icon: lucide(CirclePlus) },
      { path: '/admin/cash-register', label: 'Caja', icon: lucide(Receipt) },
      { path: '/admin/tasks', label: 'Tareas', icon: lucide(ListChecks) }
    ]
  },
  {
    title: 'Gestión',
    items: [
      { path: '/admin/inventory', label: 'Inventario', icon: lucide(Package) },
      { path: '/admin/settlements', label: 'Liquidaciones', icon: fa(faHandHoldingDollar) }
    ]
  },
  {
    title: 'Análisis',
    items: [
      { path: '/admin/sales', label: 'Ventas', icon: lucide(Tag) },
      { path: '/admin/reports', label: 'Centro de Reportes', icon: lucide(LineChart) }
    ]
  }
];

const ADMIN_FOOTER: ReadonlyArray<NavItem> = [
  { path: '/admin/settings', label: 'Configuración', icon: lucide(Settings) }
];

const BRAND_MANAGER_SECTIONS: ReadonlyArray<NavSection> = [
  { items: [{ path: '/brand-manager/dashboard', label: 'Mi Resumen', icon: lucide(LayoutDashboard) }] },
  {
    title: 'Gestión',
    items: [
      { path: '/brand-manager/sales', label: 'Ventas', icon: lucide(BarChart3) },
      { path: '/brand-manager/inventory', label: 'Mi Stock', icon: lucide(Package) },
      { path: '/brand-manager/settlements', label: 'Liquidaciones', icon: fa(faHandHoldingDollar) }
    ]
  }
];

const BRAND_MANAGER_FOOTER: ReadonlyArray<NavItem> = [
  { path: '/brand-manager/configuracion', label: 'Configuración', icon: lucide(Settings) }
];

const SELLER_SECTIONS: ReadonlyArray<NavSection> = [
  {
    title: 'Operativa diaria',
    items: [
      { path: '/seller/pos', label: 'Ingresar Venta / Devolución', icon: lucide(CirclePlus) },
      { path: '/seller/cash-register', label: 'Caja', icon: lucide(Receipt) },
      { path: '/seller/inventory', label: 'Inventario', icon: lucide(Package) },
      { path: '/seller/tasks', label: 'Tareas Diarias', icon: lucide(ListChecks) }
    ]
  }
];

const SELLER_FOOTER: ReadonlyArray<NavItem> = [
  { path: '/seller/configuracion', label: 'Configuración', icon: lucide(Settings) }
];

export const NAV_CONFIG: Record<UserRole, RoleNavConfig> = {
  Admin: {
    label: 'Admin',
    showRoleBadge: false,
    showCashRegisterStatus: true,
    sections: ADMIN_SECTIONS,
    footerItems: ADMIN_FOOTER
  },
  SuperAdmin: {
    label: 'Admin',
    showRoleBadge: false,
    showCashRegisterStatus: true,
    sections: ADMIN_SECTIONS,
    footerItems: ADMIN_FOOTER
  },
  BrandManager: {
    label: '',
    showRoleBadge: false,
    showCashRegisterStatus: false,
    sections: BRAND_MANAGER_SECTIONS,
    footerItems: BRAND_MANAGER_FOOTER
  },
  Seller: {
    label: 'Vendedora',
    showRoleBadge: true,
    showCashRegisterStatus: true,
    sections: SELLER_SECTIONS,
    footerItems: SELLER_FOOTER
  }
};
