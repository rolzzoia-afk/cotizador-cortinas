// BOM (Bill of Materials / Lista de Materiales).
// Portado desde public/legacy/index.html (líneas 4949-5044, calcularBOM).
// Acumula tubería/mecanismo/cadena/motor/manilla/cenefa por especificación
// desde las filas del optimizador (OptimizerRow con pano).

import type { BomItem } from '@/modules/ots/types';
import type { Pano } from './types';
import type { OptimizerRow } from './tela';

const EMPTY_PANO: Partial<Pano> = {};

const CAT_ORDER = ['TUBERÍA', 'MECANISMO', 'CADENA', 'MOTOR', 'MANILLA', 'CENEFA', 'OTRO'];

function extraerSpec(s: string | undefined): string {
  if (!s) return '';
  const m = s.match(/\[(.+)\]/);
  return m ? m[1] : s;
}

export function calcularBOM(rows: OptimizerRow[]): BomItem[] {
  const acc = new Map<string, BomItem>();
  const add = (
    key: string,
    categoria: string,
    descripcion: string,
    especificacion: string,
    color: string,
    cantidad: number,
    unidad: string,
  ) => {
    const existing = acc.get(key);
    if (existing) {
      existing.cantidad += cantidad;
    } else {
      acc.set(key, { categoria, descripcion, especificacion, color, cantidad, unidad });
    }
  };

  rows.forEach((row) => {
    const p = row.pano || EMPTY_PANO;
    const tieneMotor = !!(p.motorTipo && p.motorTipo !== '');

    // Mecanismo (con o sin motor) — calculado antes para que el tubo use el mismo color
    const mecSpec = extraerSpec(p.mecanismo);
    const mecColor = p.colorMecanismo || '';

    // Tubo — clave incluye el largo para separar tubos con largos distintos.
    // El color del tubo = colorMecanismo || color (van pintados juntos),
    // el largo va en especificación como "E02 · 1.42m".
    const tubSpec = extraerSpec(p.tuberia);
    const anchoCm = row.anchoCm || row.ancho * 100;
    const tubLargoM = ((anchoCm - 3.8) / 100).toFixed(2);
    const tubColor = mecColor || p.color || '';
    const tubEspec = tubSpec ? `${tubSpec} · ${tubLargoM}m` : `${tubLargoM}m`;
    const tubKey = `TUB|${tubSpec}|${tubLargoM}|${tubColor}`;
    add(tubKey, 'TUBERÍA', 'Tubo', tubEspec, tubColor, 1, 'unid.');
    if (mecSpec) {
      const mecKey = `MEC|${mecSpec}|${mecColor}`;
      add(mecKey, 'MECANISMO', 'Mecanismo', mecSpec, mecColor, 1, 'unid.');
    }

    if (!tieneMotor) {
      // Cadena
      const cadLargo = p.largoCadena ? String(p.largoCadena) : '';
      const cadColor = p.colorCadena || '';
      if (cadLargo) {
        const cadKey = `CAD|${cadLargo}|${cadColor}`;
        add(cadKey, 'CADENA', 'Cadena', cadLargo, cadColor, 1, 'unid.');
      }
      // Peso
      const pesoColor = p.colorPeso || '';
      if (pesoColor) {
        const pesoKey = `PESO|${pesoColor}`;
        add(pesoKey, 'CADENA', 'Peso de cadena', '', pesoColor, 1, 'unid.');
      }
    } else {
      // Motor (tipo + lado + color mecanismo)
      const ladoMot = p.ladoMotor || '';
      const motEspec = [p.motorTipo, ladoMot ? `Lado ${ladoMot}` : '']
        .filter(Boolean)
        .join(' — ');
      const motKey = `MOT|${p.motorTipo}|${mecColor}|${ladoMot}`;
      add(motKey, 'MOTOR', 'Motor', motEspec, mecColor, 1, 'unid.');
      if (p.motorControlAdic) add('MOT-CTRL', 'MOTOR', 'Control adicional motor', '', '', 1, 'unid.');
      if (p.motorHubUsb) add('MOT-HUB', 'MOTOR', 'Hub USB motor', '', '', 1, 'unid.');
    }

    // Mecanismo Dual
    if (p.dual) {
      const dualKey = `DUAL|${mecColor}`;
      add(dualKey, 'MECANISMO', 'Mecanismo Dual', mecSpec || '', mecColor, 1, 'unid.');
    }

    // Manillas
    const manCant = parseInt(String(p.manillaCant ?? '0')) || 0;
    if (manCant > 0) {
      const manColor = p.manillaColor || '';
      const manKey = `MAN|${manColor}`;
      add(manKey, 'MANILLA', 'Manilla', '', manColor, manCant, 'unid.');
    }

    // Cenefa
    const cenefaTipo = p.cenefa || 'No';
    if (cenefaTipo && cenefaTipo !== 'No') {
      const cenColor = p.colorTapa || '';
      const cenKey = `CENEFA|${cenefaTipo}|${cenColor}`;
      add(cenKey, 'CENEFA', `Cenefa ${cenefaTipo}`, cenefaTipo, cenColor, 1, 'unid.');
      const tapasCount =
        p.cenefaTapa === 'CON_2_TAPAS' ? 2 : p.cenefaTapa === 'CON_1_TAPA' ? 1 : 0;
      if (tapasCount > 0) {
        const tapKey = `TAPA|${cenColor}`;
        add(tapKey, 'CENEFA', 'Tapa de cenefa', '', cenColor, tapasCount, 'unid.');
      }
    }
  });

  return [...acc.values()].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a.categoria);
    const ib = CAT_ORDER.indexOf(b.categoria);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

// Persiste el BOM: actualiza datos_generales.bom y sincroniza
// la tabla orden_materiales (delete + insert) que consume Bodeguero.
export type GuardarBomResult = {
  ordenMaterialesOk: boolean;
  errorOrdenMateriales?: string;
};

type BomRow = {
  empresa_id: string;
  ot_id: string;
  orden: number;
  categoria: string;
  descripcion: string;
  especificacion: string | null;
  color: string | null;
  cantidad_req: number;
  unidad: string;
  cantidad_despachada: number;
  estado: 'pendiente';
};

export function bomToOrdenMaterialesRows(
  items: BomItem[],
  empresaId: string,
  otId: string,
): BomRow[] {
  return items.map((it, i) => ({
    empresa_id: empresaId,
    ot_id: otId,
    orden: i + 1,
    categoria: it.categoria,
    descripcion: it.descripcion,
    especificacion: it.especificacion || null,
    color: it.color || null,
    cantidad_req: it.cantidad,
    unidad: it.unidad,
    cantidad_despachada: 0,
    estado: 'pendiente',
  }));
}
