import { describe, expect, it } from 'vitest';
import {
  esUtilizableProduccion,
  filasColmenaDeCorte,
  filasMermasDeCorte,
  funcionalDeSobrante,
  libresClasificados,
  metrosPrimerCorte,
  rectangulosLibres,
  resumenLibres,
  prefijoSerial,
  rotuloOrigen,
  salidasDeRollo,
  salidasDelPlan,
  serialSobrante,
  stampCorteProduccion,
  type FilaSobranteEditada,
  type OrigenCorte,
  type SalidaCorte,
} from './salidasCorte';
import { PARAMETROS_CORTE_DEFAULT } from '@/modules/cotizador/parametrosCorte';
import type { GrupoRollo, Placed, Plan } from '@/modules/cotizador/planCorte';

const pieza = (px: number, py: number, pw: number, ph: number): Placed => ({
  id: `p${px}-${py}`,
  nombre: 'Living',
  codInt: 'BK 10',
  otId: 'ot-1',
  otNum: '3189',
  w: pw,
  h: ph,
  px,
  py,
  pw,
  ph,
  rot: false,
  failed: false,
});

/**
 * Un rollo cortado: 298 útiles de 300, con las piezas ocupando `usaAncho` de
 * ancho y `usaAlto` de alto. `altoCorte` es lo que se baja del rollo.
 */
const rollo = (usaAncho: number, usaAlto: number, altoCorte: number): GrupoRollo => ({
  codInt: 'BK 10',
  placed: [pieza(0, 0, usaAncho, usaAlto)],
  anchoUtil: 298,
  altoUtil: usaAlto,
  anchoCorte: 300,
  altoCorte,
  efic: 80,
  sobInterno: null,
  tieneRotaciones: false,
  piezasRotadas: [],
  layoutVertical: null,
  altoVertical: null,
  eficVertical: 0,
  sobInternoV: null,
  decisiones: {},
});

describe('funcionalDeSobrante — para qué alcanza el trozo', () => {
  it('roller justo en el mínimo (100×200) y un centímetro menos', () => {
    expect(funcionalDeSobrante(100, 200).roller).toBe(true);
    expect(funcionalDeSobrante(99, 200).roller).toBe(false);
    expect(funcionalDeSobrante(100, 199).roller).toBe(false);
  });

  it('vertical: más angosta pero más larga (80×250)', () => {
    expect(funcionalDeSobrante(80, 250).vertical).toBe(true);
    expect(funcionalDeSobrante(80, 249).vertical).toBe(false);
    // 90×260 no da para roller (angosto) pero sí para vertical: es justo el
    // caso que el mínimo histórico de colmena (120×180) descartaba entero.
    expect(funcionalDeSobrante(90, 260)).toEqual({ roller: false, vertical: true });
  });

  it('una tira ancha y corta sirve para roller y no para vertical', () => {
    expect(funcionalDeSobrante(150, 210)).toEqual({ roller: true, vertical: false });
  });

  it('grande para las dos', () => {
    expect(funcionalDeSobrante(150, 260)).toEqual({ roller: true, vertical: true });
  });

  it('los umbrales son parámetros, no números fijos', () => {
    const estricto = { ...PARAMETROS_CORTE_DEFAULT, funcionalRollerMinAnchoCm: 140 };
    expect(funcionalDeSobrante(120, 220, estricto).roller).toBe(false);
    expect(funcionalDeSobrante(120, 220).roller).toBe(true);
  });

  it('utilizable = sirve para algo; si no, es merma', () => {
    expect(esUtilizableProduccion(90, 260)).toBe(true);
    expect(esUtilizableProduccion(50, 180)).toBe(false);
  });
});

describe('salidasDeRollo — qué queda del paño', () => {
  it('la tira del costado se registra aunque NO llegue al mínimo de colmena', () => {
    // 298 − 200 = 98 de ancho × 260 de alto: bajo 120×180, el motor la
    // descarta (sobInterno null) y antes se perdía sin dejar rastro.
    const salidas = salidasDeRollo(rollo(200, 258, 260));
    expect(salidas).toHaveLength(1);
    expect(salidas[0]).toMatchObject({
      codInt: 'BK 10',
      ancho: 98,
      alto: 260,
      detalle: 'franja_rollo',
      clase: 'sobrante', // 98×260 da para una vertical (80×250)
    });
    expect(salidas[0].funcional).toEqual({ roller: false, vertical: true });
  });

  it('una tira que no sirve para nada se anota como MERMA', () => {
    // 298 − 250 = 48 de ancho: ni roller ni vertical.
    const salidas = salidasDeRollo(rollo(250, 158, 160));
    expect(salidas).toHaveLength(1);
    expect(salidas[0]).toMatchObject({ ancho: 48, alto: 160, clase: 'merma' });
  });

  it('un recorte de menos de 10 cm no es ni sobrante ni merma', () => {
    // 298 − 292 = 6 cm de tira: recorte de mesa, no se registra.
    expect(salidasDeRollo(rollo(292, 258, 260))).toEqual([]);
  });

  it('sin sobrante útil el corte no deja salidas', () => {
    expect(salidasDeRollo(rollo(298, 258, 260))).toEqual([]);
  });

  it('la faja de abajo y la tira NO se pisan en la esquina', () => {
    // El operario bajó 400 cm para un layout que usa 258: sobran 140 de faja
    // (300 × 140) y la tira del costado queda con los 260 que siguen en pie.
    const salidas = salidasDeRollo(rollo(200, 258, 400));
    const faja = salidas.find((s) => s.detalle === 'resto_rollo');
    const tira = salidas.find((s) => s.detalle === 'franja_rollo');
    expect(faja).toMatchObject({ ancho: 300, alto: 140 });
    expect(tira).toMatchObject({ ancho: 98, alto: 260 });
    // Sumadas no pueden superar el paño que se bajó del rollo.
    const area = salidas.reduce((s, x) => s + x.ancho * x.alto, 0);
    expect(area).toBeLessThanOrEqual(300 * 400);
  });

  it('un rollo sin piezas colocadas no inventa sobrantes', () => {
    const vacio = { ...rollo(200, 258, 260), placed: [] };
    expect(salidasDeRollo(vacio)).toEqual([]);
  });

  it('salidasDelPlan recorre todos los rollos', () => {
    const plan = {
      sobrantes: [],
      rollo: [rollo(200, 258, 260), rollo(250, 158, 160)],
      sinStock: [],
      otsIncluidas: [],
    } as unknown as Plan;
    expect(salidasDelPlan(plan)).toHaveLength(2);
  });
});

describe('serial y origen', () => {
  const ot: OrigenCorte = { tipo: 'ot', numero: '3189' };
  const lote: OrigenCorte = {
    tipo: 'lote',
    nombre: 'Corte 02/09',
    ots: [{ id: 'a', numero: '3189' }],
  };

  it('el rótulo dice de dónde salió', () => {
    expect(rotuloOrigen(ot)).toBe('OT 3189');
    expect(rotuloOrigen(lote)).toBe('LOTE Corte 02/09');
  });

  it('el serial junta origen, fecha y número correlativo', () => {
    expect(serialSobrante(ot, 1, '2026-09-02T10:00:00Z')).toBe('OT3189-020926-S1');
    expect(serialSobrante(ot, 2, '2026-09-02T10:00:00Z')).toBe('OT3189-020926-S2');
  });

  it('el nombre del lote se limpia: sin espacios, símbolos ni tildes', () => {
    expect(serialSobrante(lote, 1, '2026-09-02T10:00:00Z')).toBe('LCORTE0209-020926-S1');
    const conTildes: OrigenCorte = { tipo: 'lote', nombre: 'Ñuñoa día', ots: [] };
    expect(serialSobrante(conTildes, 1, '2026-09-02T10:00:00Z')).toBe('LNUNOADIA-020926-S1');
  });

  it('el prefijo agrupa los seriales del mismo corte', () => {
    const p = prefijoSerial(ot, '2026-09-02T10:00:00Z');
    expect(serialSobrante(ot, 1, '2026-09-02T10:00:00Z').startsWith(p)).toBe(true);
    expect(p).toBe('OT3189-020926-');
  });

  it('una fecha inválida no rompe el serial', () => {
    expect(serialSobrante(ot, 1, 'no es fecha')).toBe('OT3189-000000-S1');
  });
});

describe('metrosPrimerCorte', () => {
  it('centímetros a metros con coma, como se lee en Chile', () => {
    expect(metrosPrimerCorte(452)).toBe('4,52 m');
    expect(metrosPrimerCorte(300)).toBe('3,00 m');
    expect(metrosPrimerCorte(85)).toBe('0,85 m');
  });
});

describe('payloads para la BD', () => {
  const origen: OrigenCorte = {
    tipo: 'lote',
    nombre: 'Corte 02/09',
    ots: [
      { id: 'a', numero: '3189' },
      { id: 'b', numero: '3190' },
    ],
  };
  const now = '2026-09-02T13:00:00.000Z';
  const fila: FilaSobranteEditada = {
    codInt: 'BK 10',
    ancho: 98,
    alto: 260,
    clase: 'sobrante',
    detalle: 'franja_rollo',
    funcional: { roller: false, vertical: true },
    ubicacion: ' a-54 ',
    serial: 'LCORTE0209-020926-S1',
  };

  it('la fila de colmena lleva zona CORTE, serial, funcional y las OTs del lote', () => {
    const [f] = filasColmenaDeCorte([fila], 'emp-1', origen, now);
    expect(f).toEqual({
      empresa_id: 'emp-1',
      codigo: 'BK 10',
      medida_ancho: 98,
      medida_alto: 260,
      ubicacion: 'A-54', // se limpia y sube a mayúsculas
      tipo: 'SOBRANTE',
      disponible: true,
      ot_asignada: null,
      datos_extra: {
        fuente: 'corte_rollo',
        zona: 'CORTE',
        ot_origen: 'LOTE Corte 02/09',
        creadoEn: now,
        serial: 'LCORTE0209-020926-S1',
        funcional: { roller: false, vertical: true },
        origen_detalle: 'franja_rollo',
        lote: 'Corte 02/09',
        ots_lote: origen.ots,
      },
    });
  });

  it('desde una OT suelta no se guarda lote ni lista de OTs', () => {
    const [f] = filasColmenaDeCorte([fila], 'emp-1', { tipo: 'ot', numero: '3189' }, now);
    expect(f.datos_extra.ot_origen).toBe('OT 3189');
    expect('lote' in f.datos_extra).toBe(false);
    expect('ots_lote' in f.datos_extra).toBe(false);
  });

  it('solo las mermas van a telas_mermas, con el motivo sobrante_rollo', () => {
    const salidas: SalidaCorte[] = [
      { ...fila, clase: 'sobrante' },
      { ...fila, ancho: 48, alto: 160, clase: 'merma', funcional: { roller: false, vertical: false } },
    ];
    const filas = filasMermasDeCorte(salidas, 'emp-1', origen, now);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toEqual({
      empresa_id: 'emp-1',
      codigo: 'BK 10',
      medida_ancho: 48,
      medida_alto: 160,
      motivo: 'sobrante_rollo',
      ot_origen: 'LOTE Corte 02/09',
      colmena_origen_id: null,
      fecha: now,
    });
  });

  it('sin colmena, el sello solo registra lo que salió', () => {
    const s = stampCorteProduccion(origen, now, ['LCORTE0209-020926-S1'], 2);
    expect(s).toEqual({
      confirmadoEn: now,
      panos: [],
      piezas: {},
      fuente: 'produccion',
      lote: 'Corte 02/09',
      salidas: { seriales: ['LCORTE0209-020926-S1'], mermas: 2 },
    });
  });

  it('el sello guarda los paños consumidos y de dónde salió cada cortina', () => {
    // Es lo que apaga el badge «Tela sin cortar» Y lo que deja la hoja de corte
    // mostrando el origen después, cuando el paño ya no está disponible.
    const panos = [
      {
        docId: 'd1',
        cod: 'BK 18',
        ubicacion: 'A-19',
        ancho: 219,
        alto: 200,
        accion: 'usado' as const,
        salidas: [],
      },
    ];
    const piezas = { ot1_v1_p0: { cod: 'BK 18', ancho: 219, alto: 200, ubic: 'A-19' } };
    const s = stampCorteProduccion(origen, now, [], 0, panos, piezas);
    expect(s.panos).toEqual(panos);
    expect(s.piezas).toEqual(piezas);
  });

  // ── Lo que queda de un PAÑO de colmena ──
  const deColmena: SalidaCorte = {
    codInt: 'BK 18',
    ancho: 134,
    alto: 235,
    clase: 'sobrante',
    detalle: 'resto_colmena',
    funcional: { roller: true, vertical: false },
    colmenaOrigen: { docId: 'pano-1', ubicacion: 'A-19', cod: 'BK 18', ancho: 280, alto: 235 },
  };

  it('un trozo nacido de un paño apunta al paño de origen', () => {
    const [f] = filasColmenaDeCorte(
      [{ ...deColmena, ubicacion: 'B-3', serial: 'S9' }],
      'emp-1',
      origen,
      now,
    );
    expect(f.datos_extra.origen_detalle).toBe('resto_colmena');
    expect(f.datos_extra.colmena_origen_id).toBe('pano-1');
  });

  it('la merma de un paño se anota como sobrante_colmena, con trazabilidad', () => {
    const [f] = filasMermasDeCorte(
      [{ ...deColmena, clase: 'merma', funcional: { roller: false, vertical: false } }],
      'emp-1',
      origen,
      now,
    );
    expect(f.motivo).toBe('sobrante_colmena');
    expect(f.colmena_origen_id).toBe('pano-1');
  });

  it('los seriales corren seguidos entre el rollo y la colmena', () => {
    // Se numeran por posición en la lista final: un mismo corte no puede
    // repetir un serial aunque los trozos vengan de dos orígenes distintos.
    const seriales = [1, 2, 3].map((n) => serialSobrante(origen, n, now));
    expect(new Set(seriales).size).toBe(3);
    expect(seriales[2]).toMatch(/-S3$/);
  });
});

// ── Todo lo que no es cortina ────────────────────────────────────────
const rect = (px: number, py: number, pw: number, ph: number) => ({ px, py, pw, ph });

describe('rectangulosLibres', () => {
  it('un tiro de una sola fila deja la franja del costado, entera', () => {
    // Dos cortinas al hilo en 296 útiles: 137 + 129 = 266 → franja de 30.
    expect(rectangulosLibres([rect(0, 0, 137, 256), rect(137, 0, 129, 256)], 296, 256)).toEqual([
      { x: 266, y: 0, anchoCm: 30, altoCm: 256 },
    ]);
  });

  it('una cortina más corta deja un hueco DEBAJO, que antes no se contaba', () => {
    const libres = rectangulosLibres([rect(0, 0, 150, 260), rect(150, 0, 100, 180)], 296, 260);
    expect(libres).toContainEqual({ x: 150, y: 180, anchoCm: 100, altoCm: 80 });
    // Y la franja del costado sigue saliendo entera, de arriba abajo.
    expect(libres).toContainEqual({ x: 250, y: 0, anchoCm: 46, altoCm: 260 });
  });

  it('en un acomodo apilado cuenta lo que queda AL LADO de la banda angosta', () => {
    // El caso del dibujo en negro: PPAL 275 arriba, HIJO 257 y VISITA 186 debajo.
    const libres = rectangulosLibres(
      [rect(0, 0, 275, 307), rect(0, 307, 257, 195), rect(0, 502, 186, 175)],
      298,
      677,
    );
    expect(libres).toHaveLength(3);
    // La franja del costado, entera: la misma que anota el cierre del corte.
    expect(libres).toContainEqual({ x: 275, y: 0, anchoCm: 23, altoCm: 677 });
    // Y lo que queda al lado de las dos bandas más angostas (antes, en negro).
    expect(libres).toContainEqual({ x: 257, y: 307, anchoCm: 18, altoCm: 370 });
    expect(libres).toContainEqual({ x: 186, y: 502, anchoCm: 71, altoCm: 175 });
  });

  it('junta en UN trozo lo que se apila con el mismo ancho', () => {
    // Dos cortinas en columna, del mismo ancho: la franja del lado es una sola.
    expect(rectangulosLibres([rect(0, 0, 200, 100), rect(0, 100, 200, 150)], 296, 250)).toEqual([
      { x: 200, y: 0, anchoCm: 96, altoCm: 250 },
    ]);
  });

  it('la suma de las áreas es exactamente el tiro menos las cortinas', () => {
    const piezas = [rect(0, 0, 184, 285), rect(184, 0, 94, 125), rect(184, 125, 94, 125)];
    const area = rectangulosLibres(piezas, 298, 285).reduce((s, r) => s + r.anchoCm * r.altoCm, 0);
    const ocupado = piezas.reduce((s, p) => s + p.pw * p.ph, 0);
    expect(area + ocupado).toBe(298 * 285);
  });

  it('un tiro sin cortinas es todo libre; sin medidas no hay nada', () => {
    expect(rectangulosLibres([], 296, 200)).toEqual([{ x: 0, y: 0, anchoCm: 296, altoCm: 200 }]);
    expect(rectangulosLibres([rect(0, 0, 100, 100)], 0, 200)).toEqual([]);
  });
});

describe('libresClasificados', () => {
  it('cada trozo lleva su semáforo: sirve o se perdió', () => {
    // Franja de 120 × 260 → sirve para roller; hueco de 100 × 60 → merma.
    const libres = libresClasificados([rect(0, 0, 176, 260), rect(176, 0, 100, 200)], 296, 260);
    expect(libres.find((r) => r.x === 276)).toMatchObject({ anchoCm: 20, clase: 'merma' });
    expect(libres.find((r) => r.x === 176)).toMatchObject({
      anchoCm: 100,
      altoCm: 60,
      clase: 'merma',
    });
  });

  it('un hueco grande SÍ sale como sobrante utilizable', () => {
    const libres = libresClasificados([rect(0, 0, 150, 500), rect(150, 0, 140, 250)], 296, 500);
    expect(libres.find((r) => r.y === 250)).toMatchObject({
      anchoCm: 140,
      altoCm: 250,
      clase: 'sobrante',
      funcional: { roller: true, vertical: true },
    });
  });

  it('las hilachas de menos de 1 cm no son tela: se descartan', () => {
    expect(libresClasificados([rect(0, 0, 295.6, 200)], 296, 200)).toEqual([]);
  });
});

describe('resumenLibres', () => {
  it('separa lo que vuelve al rack de lo que se perdió', () => {
    const libres = libresClasificados([rect(0, 0, 150, 500), rect(150, 0, 140, 250)], 296, 500);
    const { sobranteCm2, mermaCm2 } = resumenLibres(libres);
    expect(sobranteCm2).toBe(140 * 250); // el hueco grande, bajo la cortina corta
    expect(mermaCm2).toBe(6 * 500); // la franja angosta del costado
  });

  it('sin trozos libres no hay pérdida', () => {
    expect(resumenLibres([])).toEqual({ sobranteCm2: 0, mermaCm2: 0 });
  });
});
