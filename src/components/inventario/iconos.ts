// El registro de submódulos guarda el NOMBRE del ícono (texto) para poder ser
// un módulo puro. Acá se traduce a componente, que es lo único que sabe de
// lucide en todo el módulo.

import {
  AlignJustify,
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  Grid3x3,
  Layers,
  LayoutDashboard,
  Package,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { IconoInventario } from '@/modules/inventario/navegacion';

export const ICONOS_INVENTARIO: Record<IconoInventario, LucideIcon> = {
  LayoutDashboard,
  Package,
  Layers,
  Grid3x3,
  AlignJustify,
  Truck,
  ShoppingBag,
  ArrowLeftRight,
  ClipboardList,
  Scissors,
  TriangleAlert,
  ShoppingCart,
  BarChart3,
  Settings,
  ShieldCheck,
};
