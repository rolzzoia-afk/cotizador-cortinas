// Categorías del select de Fase 1, agrupadas por optgroup.
// Portado de legacy index.html líneas 1242-1271.

export type CategoriaOption = { value: string; label: string };
export type CategoriaGroup = { label: string; options: CategoriaOption[] };

export const CATEGORIAS_FASE1: CategoriaGroup[] = [
  {
    label: 'Roller Simple',
    options: [
      { value: 'ROL', label: 'ROL — Roller simple' },
      { value: 'PLETINA_ROLLER_V', label: 'PLETINA_ROLLER_V — Roller con pletina en V' },
    ],
  },
  {
    label: 'Roller + Cenefa Manual',
    options: [
      { value: 'ROL_MANUAL_CENEFA_OVALADA_38mm', label: 'ROL_MANUAL_CENEFA_OVALADA_38mm' },
      { value: 'ROL_MANUAL_CENEFA_OVALADA_45mm', label: 'ROL_MANUAL_CENEFA_OVALADA_45mm' },
    ],
  },
  {
    label: 'Roller + Cenefa Motor',
    options: [
      { value: 'ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO', label: 'ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO' },
      { value: 'ROL_CENEFA_OVALADA_MOTOR_GRANDE', label: 'ROL_CENEFA_OVALADA_MOTOR_GRANDE' },
    ],
  },
  {
    label: 'Dual / Duo',
    options: [
      { value: 'ROL_DUAL', label: 'ROL_DUAL — Roller doble tela' },
      { value: 'DUO_MANUAL_38mm', label: 'DUO_MANUAL_38mm' },
      { value: 'DUO_MANUAL_45mm', label: 'DUO_MANUAL_45mm' },
      { value: 'DUO_MOTOR_PEQUEÑO_38mm', label: 'DUO_MOTOR_PEQUEÑO_38mm' },
      { value: 'DUO_MOTOR_GRANDE_45mm', label: 'DUO_MOTOR_GRANDE_45mm' },
      { value: 'PLETINA_DUO_V', label: 'PLETINA_DUO_V — Duo con pletina en V' },
    ],
  },
  {
    label: 'Vertical',
    options: [{ value: 'VERTICAL', label: 'VERTICAL' }],
  },
  {
    label: 'Oscuridad / Especiales',
    options: [
      { value: 'SOFT_LIGHT_38mm', label: 'SOFT_LIGHT_38mm' },
      { value: 'SOFT_LIGHT_45mm', label: 'SOFT_LIGHT_45mm' },
      { value: 'DARK_38mm', label: 'DARK_38mm' },
      { value: 'DARK_45mm', label: 'DARK_45mm' },
      { value: 'OSCURANTI_63mm', label: 'OSCURANTI_63mm' },
      { value: 'BEEBLACK', label: 'BEEBLACK — Cierre horizontal' },
    ],
  },
];

// Color del badge según la categoría.
// Portado de catBadge() líneas ~3053-3062 (colores inferidos de optgroup labels).
export function catBadgeColor(categoria: string): { bg: string; color: string; border: string } {
  const cat = (categoria || '').toUpperCase();
  if (cat.includes('MOTOR'))
    return {
      bg: 'rgba(251,146,60,0.15)',
      color: '#fb923c',
      border: 'rgba(251,146,60,0.4)',
    };
  if (cat.includes('DUO') || cat.includes('DUAL'))
    return {
      bg: 'rgba(168,85,247,0.15)',
      color: '#c084fc',
      border: 'rgba(168,85,247,0.4)',
    };
  if (cat.includes('CENEFA'))
    return {
      bg: 'rgba(34,197,94,0.15)',
      color: '#4ade80',
      border: 'rgba(34,197,94,0.4)',
    };
  if (cat.includes('VERTICAL'))
    return {
      bg: 'rgba(148,163,184,0.15)',
      color: '#94a3b8',
      border: 'rgba(148,163,184,0.4)',
    };
  if (cat.includes('BEEBLACK'))
    return {
      bg: 'rgba(30,30,30,0.25)',
      color: '#a3a3a3',
      border: 'rgba(100,100,100,0.5)',
    };
  if (cat.includes('SOFT_LIGHT') || cat.includes('DARK') || cat.includes('OSCURANTI'))
    return {
      bg: 'rgba(239,68,68,0.15)',
      color: '#f87171',
      border: 'rgba(239,68,68,0.4)',
    };
  return {
    bg: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    border: 'rgba(99,102,241,0.4)',
  };
}
