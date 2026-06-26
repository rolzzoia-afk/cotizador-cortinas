// BOM (Bill of Materials / Lista de Materiales).
// Portado desde public/legacy/index.html (líneas 4949-5044, calcularBOM).
// Acumula tubería/mecanismo/cadena/motor/manilla/cenefa por especificación
// desde las filas del optimizador (OptimizerRow con pano).

import type { BomItem } from '@/modules/ots/types';
import type { VentanaItem } from '@/modules/ots/types';
import { mecanismoParaPano, colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { tuberiaParaPano } from '@/modules/descuentos/reglas-tuberia';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import type { Pano } from './types';
import type { OptimizerRow } from './tela';
import { OPCIONES_MECANISMO, OPCIONES_TUBERIA } from './fase2';

const EMPTY_PANO: Partial<Pano> = {};

const CAT_ORDER = ['TUBERÍA', 'MECANISMO', 'CADENA', 'MOTOR', 'MANILLA', 'CENEFA', 'OTRO'];

function extraerSpec(s: string | undefined): string {
  if (!s) return '';
  const mec = s.match(/\[MEC (\d+)\]/i);
  if (mec) return `MEC ${mec[1]}`;
  const m = s.match(/\[(.+)\]/);
  return m ? m[1] : s;
}

function ventanaDeFila(row: OptimizerRow, ventanas?: VentanaItem[]): VentanaItem | undefined {
  if (!ventanas?.length) return undefined;
  return ventanas.find((v) => String(v.id) === String(row.ventanaId));
}

export function calcularBOM(rows: OptimizerRow[], ventanas?: VentanaItem[]): BomItem[] {
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
    const v = ventanaDeFila(row, ventanas);
    const modelo = (v?.modelo as ModeloDespiece | null | undefined) ?? null;
    const categoria = (v?.categoria as string) || '';
    const ventanaColor = (v?.color as string) || (p.color as string) || '';
    const anchoM = row.ancho || parseFloat(String(p.ancho ?? 0)) || 0;

    const mecChip = mecanismoParaPano(
      p,
      ventanaColor,
      modelo,
      OPCIONES_MECANISMO,
      categoria,
    );
    const mecSpec = extraerSpec(mecChip || (p.mecanismo as string));
    const mecColor = colorAccesoriosDePano(p, ventanaColor) || p.colorMecanismo || '';

    const tubChip = tuberiaParaPano(
      anchoM,
      modelo,
      p.tuberia as string,
      OPCIONES_TUBERIA,
      categoria,
    );
    const tubSpec = extraerSpec(tubChip || (p.tuberia as string));
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

    const tieneMotor = !!(p.motorTipo && p.motorTipo !== '');

    if (!tieneMotor) {
      // Cadena. Si el cotizador eligió la cadena real del inventario,
      // `codCadena` (CAD01…) va en la especificación para enlazar al stock
      // (mismo patrón que el mecanismo). Si no, cae al largo de texto antiguo.
      const cadCod = (p.codCadena || '').trim();
      const cadLargo = p.largoCadena ? String(p.largoCadena) : '';
      const cadColor = p.colorCadena || '';
      if (cadCod || cadLargo) {
        const cadKey = `CAD|${cadCod || cadLargo}|${cadColor}`;
        add(cadKey, 'CADENA', 'Cadena', cadCod || cadLargo, cadColor, 1, 'unid.');
      }
      // Peso de cadena. Si se eligió el peso real del inventario, su código
      // (PCA01/PCA04) va en la especificación para enlazar al stock.
      const pesoCod = (p.codPeso || '').trim();
      const pesoColor = p.colorPeso || '';
      if (pesoCod || pesoColor) {
        const pesoKey = `PESO|${pesoCod || pesoColor}`;
        add(pesoKey, 'CADENA', 'Peso de cadena', pesoCod, pesoColor, 1, 'unid.');
      }
    } else {
      const ladoMot = p.ladoMotor || '';
      const motEspec = [p.motorTipo, ladoMot ? `Lado ${ladoMot}` : '']
        .filter(Boolean)
        .join(' — ');
      const motKey = `MOT|${p.motorTipo}|${mecColor}|${ladoMot}`;
      add(motKey, 'MOTOR', 'Motor', motEspec, mecColor, 1, 'unid.');
      if (p.motorControlAdic) add('MOT-CTRL', 'MOTOR', 'Control adicional motor', '', '', 1, 'unid.');
      if (p.motorHubUsb) add('MOT-HUB', 'MOTOR', 'Hub USB motor', '', '', 1, 'unid.');
    }

    if (p.dual) {
      const dualKey = `DUAL|${mecColor}`;
      add(dualKey, 'MECANISMO', 'Mecanismo Dual', mecSpec || '', mecColor, 1, 'unid.');
    }

    const manCant = parseInt(String(p.manillaCant ?? '0')) || 0;
    if (manCant > 0) {
      const manColor = p.manillaColor || '';
      const manKey = `MAN|${manColor}`;
      add(manKey, 'MANILLA', 'Manilla', '', manColor, manCant, 'unid.');
    }

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
