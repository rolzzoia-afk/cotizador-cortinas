// Pure helpers para el módulo bodega: extracción del BOM, rack lookup,
// matching fuzzy de insumos.

import { resolverCodCadenaBom } from '@/modules/cotizador/cadenas';

export type OT = {
  id: string;
  numero_ot: string | null;
  estado: string | null;
  datos_generales: Record<string, unknown> | null;
  items: Record<string, unknown>[] | null;
  fecha_creacion: string | null;
  fecha_entrega: string | null;
};

export type Insumo = {
  cod: string | null;
  nemotecnico: string | null;
  descriptor_proveedor: string | null;
  categoria: string | null;
  color: string | null;
  ubicacion: string | null;
  stock_mp: number | null;
  stock_liberado: number | null;
};

export type Rack = {
  rack: string;
  fila: string | number;
  columna: string | number;
  codigo_insumo: string | null;
  almacen: string | null;
};

export type TelaSlot = { posicion: string; codigo: string; almacen: string | null };
export type TelaCatalogo = {
  codigo: string;
  nemotecnico: string | null;
  tipo: string | null;
  almacen: string | null;
  posicion: string | null;
};

export type TuboColmena = {
  cod: string | null;
  n_colmena: string | number;
  medida_cm: number | null;
};

export type BOMItem = {
  id: string | number;
  categoria: string;
  descripcion: string;
  especificacion: string;
  color: string;
  cantidad_req: number;
  unidad: string;
  cantidad_despachada: number;
  estado: 'pendiente' | 'parcial' | 'completado' | string;
  _es_tela?: boolean;
  _ubicacion_rack?: string;
  _extraido_panos?: boolean;
};

// ─────────────────────────────────────────────────────────────
// Rack helpers
// ─────────────────────────────────────────────────────────────

/** ASCII-only para el contenido del QR. */
export function rackToQRContent(
  rack: string | number,
  fila: string | number,
  col: string | number,
): string {
  const ascii = (s: string | number | null | undefined) =>
    String(s ?? '')
      .trim()
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, '');
  return `LOC:${ascii(rack)}|${ascii(fila)}|${ascii(col)}`;
}

/** Texto bonito para mostrar. */
export function rackToDisplayLabel(
  rack: string | number,
  fila: string | number,
  col: string | number,
): string {
  return `${String(rack ?? '').trim()} · ${String(fila ?? '').trim()}-${String(col ?? '').trim()}`;
}

export function getRackUbicacion(
  cod: string | null | undefined,
  racks: Rack[],
): { display: string; qr: string } | null {
  if (!cod || !racks.length) return null;
  const codNorm = cod.toUpperCase().replace(/\s/g, '');
  const u = racks.find(
    (r) => (r.codigo_insumo || '').toUpperCase().replace(/\s/g, '') === codNorm,
  );
  if (!u) return null;
  return {
    display: rackToDisplayLabel(u.rack, u.fila, u.columna),
    qr: rackToQRContent(u.rack, u.fila, u.columna),
  };
}

export function getRackUbicacionPorSpec(
  spec: string | null | undefined,
  racks: Rack[],
): { display: string; qr: string } | null {
  if (!spec || !racks.length) return null;
  const specNorm = spec.toUpperCase().replace(/\s/g, '');
  const u = racks.find((r) => {
    const rc = (r.codigo_insumo || '').toUpperCase().replace(/\s/g, '');
    return rc === specNorm || rc.includes(specNorm) || specNorm.includes(rc);
  });
  if (!u) return null;
  return {
    display: rackToDisplayLabel(u.rack, u.fila, u.columna),
    qr: rackToQRContent(u.rack, u.fila, u.columna),
  };
}

export function buscarTelaSlot(
  codInt: string,
  slots: TelaSlot[],
  cat: TelaCatalogo[],
): { posicion: string; almacen: string | null } | null {
  const cod = codInt.toUpperCase();
  const slot = slots.find((s) => (s.codigo || '').toUpperCase() === cod);
  if (slot) return { posicion: slot.posicion, almacen: slot.almacen };
  const c = cat.find((x) => (x.codigo || '').toUpperCase() === cod);
  return c ? { posicion: c.posicion || '', almacen: c.almacen || null } : null;
}

// ─────────────────────────────────────────────────────────────
// Matching fuzzy de insumos BOM
// ─────────────────────────────────────────────────────────────
export function buscarInsumoMatchBOM(
  item: BOMItem,
  insumos: Insumo[],
): Insumo | null {
  if (!insumos.length) return null;

  const spec = (item.especificacion || '').toUpperCase().trim();
  const desc = (item.descripcion || '').toUpperCase().trim();
  const cat = (item.categoria || '').toUpperCase().trim();
  const color = (item.color || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Paso 1: cod exacto
  if (spec) {
    const specNorm = spec.replace(/\s/g, '');
    const found = insumos.find((ins) => {
      const nemo = (ins.nemotecnico || '').toUpperCase();
      const cod = (ins.cod || '').toUpperCase().replace(/\s/g, '');
      const nemoMatch = nemo.match(/\[([^\]]+)\]/);
      const codBracket = nemoMatch ? nemoMatch[1].replace(/\s/g, '') : '';
      return (
        cod === specNorm ||
        cod.includes(specNorm) ||
        specNorm.includes(cod) ||
        codBracket === specNorm ||
        nemo.includes(spec)
      );
    });
    if (found) return found;
  }

  // Paso 2: descripción + color
  if (desc && color.length >= 2) {
    const found = insumos.find((ins) => {
      const nemo = (ins.nemotecnico || ins.descriptor_proveedor || '').toUpperCase();
      const insColor = (ins.color || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return (
        nemo.includes(desc) &&
        (insColor.includes(color.slice(0, 3)) || color.includes(insColor.slice(0, 3)))
      );
    });
    if (found) return found;
  }

  // Paso 3: descripción sola
  if (desc) {
    const found = insumos.find((ins) => {
      const nemo = (ins.nemotecnico || ins.descriptor_proveedor || '').toUpperCase();
      return nemo.includes(desc) || desc.includes(nemo);
    });
    if (found) return found;
  }

  // Paso 4: fallback por categoría
  return (
    insumos.find((ins) => {
      const inscat = (ins.categoria || '').toUpperCase();
      return inscat.includes(cat) || cat.includes(inscat);
    }) || null
  );
}

/** Ubicación del BOM item con fallback. Retorna { display, qr } o null. */
export function getUbicacionBOM(
  item: BOMItem,
  insumos: Insumo[],
  racks: Rack[],
): { display: string; qr: string } | null {
  const spec = (item.especificacion || '').trim();
  if (spec) {
    const r = getRackUbicacionPorSpec(spec, racks);
    if (r) return { display: `📍 ${r.display}`, qr: r.qr };
  }
  const ins = buscarInsumoMatchBOM(item, insumos);
  if (ins) {
    const r = getRackUbicacion(ins.cod, racks);
    if (r) return { display: `📍 ${r.display}`, qr: r.qr };
  }
  return null;
}

export function getColmenaPorCodTubo(
  cod: string,
  tubos: TuboColmena[],
): string | null {
  if (!cod || !tubos.length) return null;
  const codU = cod.toUpperCase().trim();
  const colmenas = [
    ...new Set(
      tubos
        .filter((t) => (t.cod || '').toUpperCase().trim() === codU)
        .map((t) => t.n_colmena),
    ),
  ]
    .filter(Boolean)
    .map((c) => String(c))
    .sort();
  return colmenas.length ? colmenas.join(', ') : null;
}

// ─────────────────────────────────────────────────────────────
// BOM: telas
// ─────────────────────────────────────────────────────────────
type OptRow = {
  codInt?: string;
  cod?: string;
  ancho?: string | number;
  anchoCm?: number;
  altoReal?: string | number;
  alto?: string | number;
  producto?: string;
  pano?: Record<string, unknown>;
};

type Ventana = {
  codInt?: string;
  ancho?: string | number;
  alto?: string | number;
  producto?: string;
  panos?: Record<string, unknown>[];
};

export function extraerTelasBOM(
  ot: OT,
  slots: TelaSlot[],
  cat: TelaCatalogo[],
): BOMItem[] {
  const dg = (ot.datos_generales || {}) as Record<string, unknown>;
  const acc = new Map<
    string,
    { codInt: string; producto: string; metros: number; panos: number; anchos: string[] }
  >();

  const rows = (dg.optimizerRows as OptRow[]) || [];
  if (rows.length) {
    rows.forEach((row) => {
      const cod = (row.codInt || row.cod || '').trim().toUpperCase();
      if (!cod) return;
      const anchoM =
        parseFloat(String(row.ancho ?? (row.anchoCm ? row.anchoCm / 100 : 0))) || 0;
      const altoM =
        parseFloat(String(row.altoReal ?? (parseFloat(String(row.alto ?? 0)) + 0.25))) ||
        0;
      if (!acc.has(cod)) {
        acc.set(cod, {
          codInt: cod,
          producto: row.producto || cod,
          metros: 0,
          panos: 0,
          anchos: [],
        });
      }
      const t = acc.get(cod)!;
      t.metros += altoM;
      t.panos += 1;
      if (anchoM) t.anchos.push(anchoM.toFixed(2) + 'm');
    });
  }

  if (!acc.size) {
    const ventanas = (ot.items || []) as Ventana[];
    ventanas.forEach((v) => {
      const cod = (v.codInt || '').trim().toUpperCase();
      if (!cod) return;
      const panos = Array.isArray(v.panos) && v.panos.length ? v.panos : [{}];
      panos.forEach((p: Record<string, unknown>) => {
        const anchoM = parseFloat(String(p.ancho ?? v.ancho ?? 0)) || 0;
        const altoM = parseFloat(String(v.alto ?? 0)) + 0.25;
        if (!acc.has(cod)) {
          acc.set(cod, {
            codInt: cod,
            producto: v.producto || cod,
            metros: 0,
            panos: 0,
            anchos: [],
          });
        }
        const t = acc.get(cod)!;
        t.metros += altoM;
        t.panos += 1;
        if (anchoM) t.anchos.push(anchoM.toFixed(2) + 'm');
      });
    });
  }

  return [...acc.values()].map((t) => {
    const slot = buscarTelaSlot(t.codInt, slots, cat);
    const c = cat.find((x) => (x.codigo || '').toUpperCase() === t.codInt);
    const nemo = c?.nemotecnico || t.producto || t.codInt;
    const tipo = c?.tipo || '';
    const ubic = slot ? slot.posicion : c?.posicion || '';
    const spec = [
      t.panos > 1 ? `${t.panos} paños` : '1 paño',
      t.anchos.length ? `Anchos: ${[...new Set(t.anchos)].join(', ')}` : '',
      t.metros > 0 ? `${t.metros.toFixed(2)}m alto total` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      id: `TELA|${t.codInt}`,
      categoria: 'TELA',
      descripcion: nemo,
      especificacion: `${t.codInt}${tipo ? ' — ' + tipo : ''}`,
      color: spec,
      cantidad_req: t.panos,
      unidad: 'paño(s)',
      cantidad_despachada: 0,
      estado: 'pendiente',
      _es_tela: true,
      _ubicacion_rack: ubic,
    } satisfies BOMItem;
  });
}

// ─────────────────────────────────────────────────────────────
// BOM: insumos extraídos de panos
// ─────────────────────────────────────────────────────────────
type Pano = Record<string, unknown>;

export function extraerInsumosBOM(
  ot: OT,
  insumos: Insumo[],
  racks: Rack[],
): BOMItem[] {
  const acc = new Map<string, BOMItem>();
  const add = (
    key: string,
    cat: string,
    desc: string,
    spec: string,
    color: string,
    qty: number,
    unit: string,
    ubicacion: string,
  ) => {
    if (acc.has(key)) {
      acc.get(key)!.cantidad_req += qty;
    } else {
      acc.set(key, {
        id: `PANO|${key}`,
        categoria: cat,
        descripcion: desc,
        especificacion: spec,
        color,
        cantidad_req: qty,
        unidad: unit,
        cantidad_despachada: 0,
        estado: 'pendiente',
        _extraido_panos: true,
        _ubicacion_rack: ubicacion,
      });
    }
  };

  const buscarUbicacion = (cod: string): string => {
    const r = getRackUbicacion(cod, racks);
    return r ? r.display : '';
  };

  const processPano = (p: Pano) => {
    const cadCod = String(p.codCadena || '').trim();
    const cadLargo = String(p.largoCadena || '');
    const cadColor = String(p.colorCadena || 'BCO');
    if (cadCod || cadLargo) {
      // Si hay código del inventario (CAD01…) va en la especificación para
      // enlazar al stock; si no, cae al largo antiguo.
      const spec = cadCod || cadLargo;
      add(`CAD|${spec}|${cadColor}`, 'CADENA', `Cadena ${cadLargo || cadCod}`, spec, cadColor, 1, 'unid.', '');
      const pesoCod = String(p.codPeso || '').trim();
      const pesoColor = String(p.colorPeso || cadColor);
      add(`PESO|${pesoCod || pesoColor}`, 'CADENA', 'Peso de cadena', pesoCod, pesoColor, 1, 'unid.', '');
    }

    const mec = String(p.mecanismo || '');
    const mecCod = (mec.match(/\[([^\]]+)\]/)?.[1] || '').replace(/\s+/g, '').toUpperCase();
    if (mec) {
      const insRec = mecCod
        ? insumos.find((i) => (i.cod || '').toUpperCase() === mecCod)
        : null;
      const mecDesc = insRec ? insRec.nemotecnico || insRec.descriptor_proveedor || mec : mec;
      const mecRackLoc = mecCod ? buscarUbicacion(mecCod) : '';
      add(
        `MEC|${mecCod || mec}`,
        'MECANISMO',
        mecDesc || mec,
        mecCod ? `[${mecCod}]` : mec,
        '',
        1,
        'unid.',
        mecRackLoc,
      );
    }

    const cenefa = String(p.cenefa || '');
    const cenColor = String(p.color || '');
    if (cenefa && cenefa !== 'No' && cenefa !== '') {
      add(`CEN|${cenefa}|${cenColor}`, 'CENEFA', `Cenefa ${cenefa}`, cenefa, cenColor, 1, 'unid.', '');
      const tapColor = String(p.colorTapa || cenColor);
      add(`TAPA|${cenefa}|${tapColor}`, 'CENEFA', `Tapa cenefa ${cenefa}`, cenefa, tapColor, 2, 'unid.', '');
    }

    const manCant = parseInt(String(p.manillaCant || '0')) || 0;
    const manColor = String(p.manillaColor || '');
    if (manCant > 0) {
      add(`MAN|${manColor}`, 'MANILLA', 'Manilla', '', manColor, manCant, 'unid.', '');
    }

    const motTipo = String(p.motorTipo || '');
    const motColor = String(p.motorColor || p.color || '');
    if (motTipo) {
      add(`MOT|${motTipo}`, 'MOTOR', 'Motor', motTipo, motColor, 1, 'unid.', '');
      if (p.motorControlAdic)
        add('MOT-CTRL', 'MOTOR', 'Control adicional motor', '', '', 1, 'unid.', '');
      if (p.motorHubUsb) add('MOT-HUB', 'MOTOR', 'Hub USB motor', '', '', 1, 'unid.', '');
    }
  };

  const dg = (ot.datos_generales || {}) as Record<string, unknown>;
  const rows = (dg.optimizerRows as OptRow[]) || [];

  if (rows.length) {
    rows.forEach((row) => processPano((row.pano || {}) as Pano));
    return [...acc.values()];
  }

  const ventanas = (ot.items || []) as Ventana[];
  ventanas.forEach((v) => {
    const panos = Array.isArray(v.panos) && v.panos.length ? v.panos : [v as Pano];
    panos.forEach((p) => processPano(p));
  });
  return [...acc.values()];
}

/** Construye el BOM completo para una OT (combina orden_materiales + telas + panos extraídos). */
export function construirBOM(
  ot: OT,
  ordenMat: Array<{
    id: string;
    categoria: string;
    descripcion: string;
    especificacion: string | null;
    color: string | null;
    cantidad_req: number;
    unidad: string | null;
    cantidad_despachada: number | null;
    estado: string | null;
  }>,
  insumos: Insumo[],
  racks: Rack[],
  slots: TelaSlot[],
  telasCat: TelaCatalogo[],
): BOMItem[] {
  const dg = (ot.datos_generales || {}) as Record<string, unknown>;
  const bomLegacy = (dg.bom as Array<Record<string, unknown>>) || [];

  let bom: BOMItem[] =
    ordenMat && ordenMat.length
      ? ordenMat.map(
          (r) =>
            ({
              id: r.id,
              categoria: r.categoria,
              descripcion: r.descripcion,
              especificacion: r.especificacion || '',
              color: r.color || '',
              cantidad_req: r.cantidad_req,
              unidad: r.unidad || 'unid.',
              cantidad_despachada: r.cantidad_despachada || 0,
              estado: r.estado || 'pendiente',
            }) as BOMItem,
        )
      : bomLegacy.map(
          (b, i) =>
            ({
              id: i,
              categoria: String(b.categoria || ''),
              descripcion: String(b.descripcion || ''),
              especificacion: String(b.especificacion || ''),
              color: String(b.color || ''),
              cantidad_req: Number(b.cantidad || 0),
              unidad: String(b.unidad || 'unid.'),
              cantidad_despachada: 0,
              estado: 'pendiente',
            }) as BOMItem,
        );

  const telas = extraerTelasBOM(ot, slots, telasCat);
  bom = [...telas, ...bom];

  const categoriasYaEnBOM = new Set(bom.map((b) => (b.categoria || '').toUpperCase()));
  const categoriasCriticas = ['CADENA', 'MECANISMO', 'CENEFA', 'MANILLA', 'MOTOR'];
  const faltan = categoriasCriticas.some((c) => !categoriasYaEnBOM.has(c));

  if (faltan || bom.filter((b) => !b._es_tela).length === 0) {
    const fromPanos = extraerInsumosBOM(ot, insumos, racks);
    const filtrados = fromPanos.filter(
      (i) => !categoriasYaEnBOM.has((i.categoria || '').toUpperCase()),
    );
    if (filtrados.length) bom = [...bom, ...filtrados];
  }

  // Pase final: enlazar cada línea de CADENA a su código de inventario
  // (CAD01…). Para cotizaciones nuevas la especificación ya trae el código;
  // para OTs antiguas (texto suelto como "3mts") lo resolvemos desde el
  // inventario por largo + color. Si no se puede resolver, se deja igual.
  bom = bom.map((b) => {
    if ((b.categoria || '').toUpperCase() !== 'CADENA') return b;
    const cod = resolverCodCadenaBom(b, insumos);
    return cod && cod !== b.especificacion ? { ...b, especificacion: cod } : b;
  });

  return bom;
}
