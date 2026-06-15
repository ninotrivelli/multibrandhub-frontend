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
import { fa, lucide, type NavItem } from '../../components/navigation-drawer/navigation-drawer';

export interface RoleNavConfig {
  readonly label: string;
  readonly showRoleBadge: boolean;
  readonly navItems: ReadonlyArray<NavItem>;
}

const ADMIN_NAV: ReadonlyArray<NavItem> = [
  { path: '/admin/dashboard', label: 'Inicio', icon: lucide(Home) },
  { path: '/admin/pos', label: 'Ingresar Venta / Devolución', icon: lucide(CirclePlus) },
  { path: '/admin/sales', label: 'Ventas', icon: lucide(Tag) },
  { path: '/admin/settlements', label: 'Liquidaciones', icon: fa(faHandHoldingDollar) },
  { path: '/admin/inventory', label: 'Inventario', icon: lucide(Package) },
  { path: '/admin/reports', label: 'Centro de Reportes', icon: lucide(LineChart) },
  { path: '/admin/tasks', label: 'Tareas', icon: lucide(ListChecks) },
  { path: '/admin/settings', label: 'Configuración', icon: lucide(Settings) }
];

const BRAND_MANAGER_NAV: ReadonlyArray<NavItem> = [
  { path: '/brand-manager/dashboard', label: 'Mi Resumen', icon: lucide(LayoutDashboard) },
  { path: '/brand-manager/sales', label: 'Ventas', icon: lucide(BarChart3) },
  { path: '/brand-manager/inventory', label: 'Mi Stock', icon: lucide(Package) },
  { path: '/brand-manager/settlements', label: 'Liquidaciones', icon: fa(faHandHoldingDollar) },
  { path: '/brand-manager/configuracion', label: 'Configuración', icon: lucide(Settings) }
];

const SELLER_NAV: ReadonlyArray<NavItem> = [
  { path: '/seller/pos', label: 'Ingresar Venta / Devolución', icon: lucide(CirclePlus) },
  { path: '/seller/inventory', label: 'Inventario', icon: lucide(Package) },
  { path: '/seller/cash-register', label: 'Caja', icon: lucide(Receipt) },
  { path: '/seller/tasks', label: 'Tareas Diarias', icon: lucide(ListChecks) },
  { path: '/seller/configuracion', label: 'Configuración', icon: lucide(Settings) }
];

export const NAV_CONFIG: Record<UserRole, RoleNavConfig> = {
  Admin: {
    label: 'Admin',
    showRoleBadge: false,
    navItems: ADMIN_NAV
  },
  SuperAdmin: {
    label: 'Admin',
    showRoleBadge: false,
    navItems: ADMIN_NAV
  },
  BrandManager: {
    label: '',
    showRoleBadge: false,
    navItems: BRAND_MANAGER_NAV
  },
  Seller: {
    label: 'Vendedora',
    showRoleBadge: true,
    navItems: SELLER_NAV
  }
};
