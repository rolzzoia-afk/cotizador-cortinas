import { describe, expect, it } from 'vitest';
import { construirInventario, notasTerreno } from './pdfInventario';
import type { Pano, Ventana } from '@/modules/cotizador/types';

const modeloCenefa = {
  sistema: 'CENEFA_OVALADA',
  tipo_rol: 'ROL_MANUAL_CENEFA_OV',
  mecanismo: 'MEC_09_OVALADA_NEGRO',
  diametro_tubo_mm: 38,
  codigos_tubo: 'E02;E66',
  dcto_tubo_cm: 1.8,
  dcto_cenefa_cm: 1.5,
  suma_peso_cm: 0.1,
};

function ventana(ubic: string, ancho: number, alto: number): Ventana {
  return {
    id: ubic,
    ubicacion: ubic,
    codInt: 'SC34',
    producto: 'ROLLER SCREEN PREMIUM',
    categoria: 'ROL',
    modelo: modeloCenefa,
    panos: [
      {
        ancho,
        alto,
        color: 'NEGRO',
        codCadena: 'CAD 03',
        largoCadena: '4mts',
        codPeso: 'PCA04',
        colorPeso: 'NEG', // color de accesorios; el peso PCA04 es TRANSPARENTE igual
      },
    ],
  } as unknown as Ventana;
}

describe('construirInventario', () => {
  const ventanas = [
    ventana('OFICINA IZQ-G1', 1.565, 2.476),
    ventana('OFICINA DER-G1', 1.189, 2.476),
  ];
  const data = construirInventario(ventanas);

  it('una fila por cortina con identidad y medidas a 3 decimales', () => {
    expect(data.filas).toHaveLength(2);
    const f = data.filas[0];
    expect(f.producto).toBe('ROLLER SCREEN PREMIUM');
    expect(f.tipo).toBe('ROL_MANUAL_CENEFA_OV');
    // Kit de bodega resuelto por color (NEG → MEC 32), igual que la hoja de
    // Fase 4 — NO el id del modelo Excel (MEC_09_OVALADA_NEGRO).
    expect(f.codMecanismo).toBe('KIT SIMPLE NEGRO 38MM [MEC 32]');
    // Descripción larga de la cadena (código sin espacios + nombre + color).
    expect(f.accionamiento).toBe('[CAD03] CADENA INFINITA 4 METROS');
    // Peso con descripción completa del insumo (no el color de accesorios).
    expect(f.pesoCadena).toBe('[PCA04] PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM');
    // Tubería con descripción larga por código (38 mm ≤2,2 m → E02).
    expect(f.tuberia).toBe('E02-TUBO 1.2 / Ø 38 mm');
    expect(f.ubic).toBe('OFICINA IZQ-G1');
    expect(f.anchoMts).toBe('1,565');
    expect(f.altoMts).toBe('2,476');
  });

  it('ya no arma la tabla de materiales consolidados (CORTINAS ROLLER eliminada)', () => {
    expect('materiales' in data).toBe(false);
  });

  it('roller emite tapas + tornillos + mecanismo + cadena + peso, clasificados por grupo', () => {
    // 2 cortinas roller NEG: TAP04/05 (×2), TOR02 (2/paño=4), y MEC/CAD/PCA por paño.
    const map = Object.fromEntries(data.insumos.map((i) => [i.codigo, i.cantidad]));
    expect(map.TAP04).toBe(2);
    expect(map.TAP05).toBe(2);
    expect(map.TOR02).toBe(4);
    expect(map.MEC32).toBe(2);
    expect(map['CAD 03']).toBe(2);
    expect(map.PCA04).toBe(2);
    // INSUMOS (bodega): tapas + tornillos. INSTALACIÓN: cadena, peso y kit simple.
    const grupo = (c: string) => data.insumos.find((i) => i.codigo === c)?.grupo;
    expect(grupo('TAP04')).toBe('INSUMOS');
    expect(grupo('TOR02')).toBe('INSUMOS');
    expect(grupo('CAD 03')).toBe('INSTALACION');
    expect(grupo('PCA04')).toBe('INSTALACION');
    expect(grupo('MEC32')).toBe('INSTALACION');
  });

  it('etiquetas: 1 por cortina, código según color de accesorios (NEG → INS 95 negra)', () => {
    expect(data.etiquetas).toEqual([{ cod: 'INS 95', color: 'NEGRA', cantidad: 2 }]);
  });

  it('incluye las notas de terreno (vacías si nadie anotó nada)', () => {
    expect(data.notas).toEqual([]);
  });

  it('sin peso de cadena elegido en Fase 2 (sin codPeso) → celda PESO CADENA vacía', () => {
    const v = ventana('LIVING', 1.5, 2.0);
    // Sin codPeso, aunque el sync haya dejado un colorPeso de accesorios.
    delete (v.panos![0] as { codPeso?: string }).codPeso;
    (v.panos![0] as { colorPeso?: string }).colorPeso = 'GRS';
    const d = construirInventario([v]);
    expect(d.filas[0].pesoCadena).toBe('');
  });

  it('sin codPeso guardado → igual emite el peso PCA04 (fijo, va a instalación)', () => {
    const v = ventana('LIVING', 1.5, 2.0);
    delete (v.panos![0] as { codPeso?: string }).codPeso; // OT no sincronizada en Fase 2
    const d = construirInventario([v]);
    const pca = d.insumos.find((i) => i.codigo === 'PCA04');
    expect(pca?.cantidad).toBe(1);
    expect(pca?.grupo).toBe('INSTALACION');
    expect(pca?.descripcion).toBe('[PCA04] PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM');
  });

  it('sin codCadena guardado → resuelve la cadena por alto + color con el catálogo', () => {
    const v = ventana('LIVING', 1.5, 2.0); // paño NEGRO, alto 2,0 → cadena 4 m
    delete (v.panos![0] as { codCadena?: string }).codCadena; // OT no sincronizada en Fase 2
    const cadenas = [
      { cod: 'CAD05', nemotecnico: 'CADENA INFINITA 4 METROS NEGRA', color: 'NEGRO', status: 'OK' },
    ];
    const d = construirInventario([v], {}, undefined, cadenas);
    const cad = d.insumos.find((i) => i.codigo === 'CAD05');
    expect(cad?.cantidad).toBe(1);
    expect(cad?.grupo).toBe('INSTALACION');
    expect(cad?.descripcion).toBe('[CAD05] CADENA INFINITA 4 METROS NEGRO');
  });

  it('sin codCadena y sin catálogo de cadenas → no inventa cadena (queda sin línea)', () => {
    const v = ventana('LIVING', 1.5, 2.0);
    delete (v.panos![0] as { codCadena?: string }).codCadena;
    const d = construirInventario([v]); // sin catálogo de cadenas
    expect(d.insumos.some((i) => (i.codigo || '').startsWith('CAD'))).toBe(false);
  });
});

// Las manillas se consolidan por color al inicio del bloque INSUMOS, seguidas
// del resto de insumos (tapas de peso, tornillos…).
describe('construirInventario — bloque INSUMOS', () => {
  const vMan = (ubic: string, cant: number, color: string): Ventana =>
    ({
      id: ubic,
      ubicacion: ubic,
      producto: 'ROLLER SCREEN PREMIUM',
      categoria: 'ROL',
      modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'NEGRO', manillaCant: cant, manillaColor: color }],
    }) as unknown as Ventana;

  it('las manillas van primero, consolidadas por color (CAFÉ ×9, NEG ×2)', () => {
    const d = construirInventario([
      vMan('A', 4, 'CAFÉ'),
      vMan('B', 5, 'CAFÉ'),
      vMan('C', 2, 'NEG'),
    ]);
    expect(d.insumos.slice(0, 2)).toEqual([
      { id: 1, descripcion: 'MANILLA CAFÉ', cantidad: 9, grupo: 'INSTALACION' },
      { id: 2, descripcion: 'MANILLA NEG', cantidad: 2, grupo: 'INSTALACION' },
    ]);
  });

  it('cenefa cuadrada CON_2_TAPAS → "[TAP32] TAPA CENEFA CUADRADA NEGRO" ×2 + brackets', () => {
    const v = {
      id: 'x',
      ubicacion: 'LIVING',
      producto: 'ROLLER BLACKOUT',
      categoria: 'ROL',
      color: 'BLANCO',
      modelo: modeloCenefa,
      panos: [{
        ancho: 1.5, alto: 2.0, color: 'BLANCO',
        cenefa: 'Cuadrada a techo', cenefaTapa: 'CON_2_TAPAS', colorTapa: 'NEG',
      }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const tapa = d.insumos.find((i) => i.codigo === 'TAP32');
    expect(tapa?.descripcion).toBe('[TAP32] TAPA CENEFA CUADRADA NEGRO');
    expect(tapa?.cantidad).toBe(2);
    expect(tapa?.grupo).toBe('INSTALACION'); // tapa cenefa cuadrada → instalación pese a código TAP
    // Cenefa cuadrada a techo → BRA04 × cantidadBrackets(1,5) = 3, instalación.
    const bra = d.insumos.find((i) => i.codigo === 'BRA04');
    expect(bra?.cantidad).toBe(3);
    expect(bra?.grupo).toBe('INSTALACION');
  });

  it('tapa cenefa cuadrada: código por color (BCO→TAP33, CAFÉ→TAP34); color desconocido sin código', () => {
    const mk = (colorTapa: string) =>
      ({
        id: 'c' + colorTapa, ubicacion: 'LIVING', producto: 'ROLLER BLACKOUT', categoria: 'ROL', color: 'BLANCO',
        modelo: modeloCenefa,
        panos: [{ ancho: 1.2, alto: 2.0, cenefa: 'Cuadrada a muro', cenefaTapa: 'CON_1_TAPA', colorTapa }],
      }) as unknown as Ventana;
    const bco = construirInventario([mk('BCO')]).insumos.find((i) => i.codigo === 'TAP33');
    expect(bco?.descripcion).toBe('[TAP33] TAPA CENEFA CUADRADA BLANCO');
    expect(bco?.grupo).toBe('INSTALACION');
    const cafe = construirInventario([mk('CAFÉ')]).insumos.find((i) => i.codigo === 'TAP34');
    expect(cafe?.descripcion).toBe('[TAP34] TAPA CENEFA CUADRADA CAFÉ');
    expect(cafe?.grupo).toBe('INSTALACION');
    // Defensivo: un color fuera de catálogo (dato legacy) sale sin código, igual
    // en instalación. La tapa cuadrada solo existe en negro/blanco/café.
    const otro = construirInventario([mk('VERDE')]).insumos.find((i) =>
      i.descripcion.includes('TAPA CENEFA CUADRADA'),
    );
    expect(otro?.codigo).toBeUndefined();
    expect(otro?.grupo).toBe('INSTALACION');
  });

  it('motor DOM41 + domótica (sin ovalada) → kit DOM (sin DOM40) en INSTALACIÓN + 1 DOM43 por OT', () => {
    const v = {
      id: 'm', ubicacion: 'DORM', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO',
      modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', motorModelo: 'DOM41', motorDomotica: true }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const codes = d.insumos.map((i) => i.codigo);
    expect(codes).toEqual(expect.arrayContaining(['DOM41', 'DOM42', 'DOM04', 'DOM43']));
    expect(codes).not.toContain('DOM40'); // #28: el DOM41 no lleva cable
    // Sin cenefa ovalada, todo el kit va a INSTALACIÓN (incluido el motor).
    const grupo = (c: string) => d.insumos.find((i) => i.codigo === c)?.grupo;
    expect(grupo('DOM41')).toBe('INSTALACION');
    expect(grupo('DOM42')).toBe('INSTALACION');
    // DOM43 aparece una sola vez.
    expect(d.insumos.filter((i) => i.codigo === 'DOM43')).toHaveLength(1);
  });
});

// Cenefa ovalada: el motor y el mecanismo van a PRODUCCIÓN; el resto del kit de
// motor (control/cable/enchufe) sigue en INSTALACIÓN.
describe('construirInventario — clasificación por cenefa ovalada', () => {
  it('motor de cortina ovalada → PRODUCCIÓN; control/cable/enchufe → INSTALACIÓN', () => {
    const v = {
      id: 'ov', ubicacion: 'LIVING', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO',
      modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', cenefa: 'OVALADA', motorModelo: 'DOM41' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const grupo = (c: string) => d.insumos.find((i) => i.codigo === c)?.grupo;
    // DOM41 en cenefa ovalada degrada a DOM38 (Tronic Plus con cable).
    expect(grupo('DOM38')).toBe('PRODUCCION'); // el motor
    expect(grupo('DOM39')).toBe('INSTALACION'); // control
    expect(grupo('DOM40')).toBe('INSTALACION'); // cable
    expect(grupo('DOM04')).toBe('INSTALACION'); // enchufe
  });

  it('mecanismo de cenefa ovalada → PRODUCCIÓN', () => {
    const v = {
      id: 'x', ubicacion: 'OFICINA', producto: 'ROLLER SCREEN PREMIUM', color: 'BLANCO',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      modelo: {
        sistema: 'ROLLER', tipo_rol: 'ROL_SIMPLE', mecanismo: 'MEC_10_OVALADA_BLANCO',
        diametro_tubo_mm: 38, codigos_tubo: 'E02', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 1.618, alto: 2.301, colorMecanismo: 'BCO' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const mec = d.insumos.find((i) => (i.codigo || '').startsWith('MEC'));
    expect(mec?.descripcion).toContain('OVALADA');
    expect(mec?.grupo).toBe('PRODUCCION');
  });

  it('cadena de una cortina ovalada → PRODUCCIÓN; su peso sigue en INSTALACIÓN', () => {
    const v = {
      id: 'x', ubicacion: 'PZA 1', producto: 'ROLLER SCREEN PREMIUM', color: 'BLANCO',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      modelo: {
        sistema: 'ROLLER', tipo_rol: 'ROL_SIMPLE', mecanismo: 'MEC_10_OVALADA_BLANCO',
        diametro_tubo_mm: 38, codigos_tubo: 'E02', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{
        ancho: 1.618, alto: 2.301, colorMecanismo: 'BCO',
        codCadena: 'CAD07', largoCadena: '4mts', colorCadena: 'BLANCO', codPeso: 'PCA04',
      }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    expect(d.insumos.find((i) => i.codigo === 'CAD07')?.grupo).toBe('PRODUCCION');
    expect(d.insumos.find((i) => i.codigo === 'PCA04')?.grupo).toBe('INSTALACION');
  });

  it('mismo motor DOM38 en paño ovalado y en paño normal → dos filas, una por tabla', () => {
    const vOv = {
      id: 'a', ubicacion: 'A', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO', modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', cenefa: 'OVALADA', motorModelo: 'DOM38' }],
    } as unknown as Ventana;
    const vNorm = {
      id: 'b', ubicacion: 'B', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO', modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', motorModelo: 'DOM38' }],
    } as unknown as Ventana;
    const d = construirInventario([vOv, vNorm]);
    const dom38 = d.insumos.filter((i) => i.codigo === 'DOM38');
    expect(dom38).toHaveLength(2); // NO se consolidan entre tablas
    expect(dom38.map((i) => i.grupo).sort()).toEqual(['INSTALACION', 'PRODUCCION']);
    expect(dom38.every((i) => i.cantidad === 1)).toBe(true);
  });
});

describe('construirInventario — E78 + cenefa ovalada → tapas (kit ovalada) + pivotes (kit 45) por color', () => {
  // El kit de TAPAS es el ovalada de bodega según color (39 blanco / 38 negro /
  // 12 gris); los PIVOTES salen del kit 45 mm por color (18 blanco / 23 negro);
  // el gris deja los pivotes manuales (sin línea). ROL ovalada = 1 tubo → 2+2;
  // dúo = 2 tubos → 4+4. Solo el tubo E78 gatilla las líneas.
  const modeloRolOv45 = (mec: string) => ({
    sistema: 'CENEFA_OVALADA', tipo_rol: 'ROL_CENEFA_OV_MANUAL_45mm',
    mecanismo: mec, diametro_tubo_mm: 45,
    codigos_tubo: 'E04; E05; E39; E46; E78', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
  });
  const ventRolOv = (ubic: string, color = 'BLANCO', mec = 'MEC_18_OVALADA_BLANCO') =>
    ({
      id: ubic, ubicacion: ubic, producto: 'ROLLER SCREEN PREMIUM', color,
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm', modelo: modeloRolOv45(mec),
      panos: [{ ancho: 2.0, alto: 2.2, color, cenefa: 'Ovalada' }],
    }) as unknown as Ventana;
  const tieneUnidad = (d: ReturnType<typeof construirInventario>, unidad: string) =>
    d.insumos.some((i) => i.unidad === unidad);

  it('ROL cenefa ovalada BLANCA + E78 → MEC 39 (2 TAPAS) y MEC 18 (2 PIVOTES) en PRODUCCIÓN', () => {
    const d = construirInventario([ventRolOv('LIVING')]);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 39')).toMatchObject({
      cantidad: 2, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(d.insumos.find((i) => i.descripcion === 'MEC 18')).toMatchObject({
      cantidad: 2, unidad: 'PIVOTES', grupo: 'PRODUCCION',
    });
  });

  it('ROL cenefa ovalada NEGRA + E78 → MEC 38 (TAPAS) y MEC 23 (PIVOTES)', () => {
    const d = construirInventario([ventRolOv('LIVING', 'NEGRO', 'MEC_23_OVALADA_NEGRO')]);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 38')).toMatchObject({
      cantidad: 2, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(d.insumos.find((i) => i.descripcion === 'MEC 23')).toMatchObject({
      cantidad: 2, unidad: 'PIVOTES', grupo: 'PRODUCCION',
    });
  });

  it('ROL cenefa ovalada GRIS + E78 → MEC 12 (TAPAS) y SIN línea de pivotes (manual)', () => {
    const d = construirInventario([ventRolOv('LIVING', 'GRIS', 'MEC_12_OVALADA_GRIS')]);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 12')).toMatchObject({
      cantidad: 2, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
  });

  it('DÚO manual BLANCO + E78 (sistema CENEFA_OVALADA_DUO, categoría sin "ovalada", cenefa null) → MEC 39 (4 TAPAS) y MEC 18 (4 PIVOTES)', () => {
    // Caso real OT 99990 cortina 7/8: la categoría es DUO_MANUAL_38mm (no dice
    // "ovalada") y el paño no tiene cenefa guardada; la ovalada se detecta por
    // el sistema del modelo. El dúo lleva 2 tubos → 4+4.
    const vDuo = {
      id: 'duo', ubicacion: 'DORMITORIO', producto: 'ROLLER DUO', color: 'BLANCO',
      categoria: 'DUO_MANUAL_38mm',
      modelo: {
        sistema: 'CENEFA_OVALADA_DUO', tipo_rol: 'DUO_CENEFA_OV_MANUAL_45mm',
        mecanismo: 'MEC_18_OVALADA_BLANCO', diametro_tubo_mm: 45,
        codigos_tubo: 'E04; E05; E39; E46; E78', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 2.5, alto: 2.2, color: 'BLANCO' }], // sin cenefa guardada
    } as unknown as Ventana;
    const d = construirInventario([vDuo]);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 39')).toMatchObject({
      cantidad: 4, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(d.insumos.find((i) => i.descripcion === 'MEC 18')).toMatchObject({
      cantidad: 4, unidad: 'PIVOTES', grupo: 'PRODUCCION',
    });
  });

  it('2 cortinas ROL ovalada BLANCA E78 → consolida a 4 TAPAS (MEC 39) y 4 PIVOTES (MEC 18)', () => {
    const d = construirInventario([ventRolOv('LIVING'), ventRolOv('COMEDOR')]);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 39')?.cantidad).toBe(4);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 18')?.cantidad).toBe(4);
  });

  it('mezcla de colores NO se consolida: blanca (MEC 39/18) y negra (MEC 38/23) separadas', () => {
    const d = construirInventario([
      ventRolOv('LIVING'),
      ventRolOv('COMEDOR', 'NEGRO', 'MEC_23_OVALADA_NEGRO'),
    ]);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 39')?.cantidad).toBe(2);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 18')?.cantidad).toBe(2);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 38')?.cantidad).toBe(2);
    expect(d.insumos.find((i) => i.descripcion === 'MEC 23')?.cantidad).toBe(2);
  });

  it('cenefa ovalada 38 mm (tubo E02, no E78) → NO agrega las líneas', () => {
    const v = {
      id: 'x', ubicacion: 'PZA', producto: 'ROLLER', color: 'BLANCO',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm', modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', cenefa: 'Ovalada' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    expect(tieneUnidad(d, 'TAPAS')).toBe(false);
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
  });

  it('ROL banda E78 sin cenefa (roller simple 45 mm) → NO agrega las líneas', () => {
    const v = {
      id: 'y', ubicacion: 'PZA', producto: 'ROLLER', color: 'BLANCO',
      categoria: 'ROL',
      modelo: {
        sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_SIMPLE',
        mecanismo: 'MEC_18_045_DECORELLI_BLANCO', diametro_tubo_mm: 45,
        codigos_tubo: 'E04; E05; E39; E46; E78', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 2.5, alto: 2.2, color: 'BLANCO' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    expect(tieneUnidad(d, 'TAPAS')).toBe(false);
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
  });
});

// Regresión OT 267-3 (jeffi): el PDF mostraba el id del modelo de despiece
// (MEC_05_LZ90_BLANCO / MEC_10_OVALADA_BLANCO) mientras Fase 4 mostraba el kit
// real de bodega (KIT SIMPLE BLANCO 38MM [MEC 33]). Ambos deben coincidir.
describe('construirInventario — mecanismo consistente con Fase 4', () => {
  const vjeffi = (modeloMec: string, categoria: string): Ventana =>
    ({
      id: 'x',
      ubicacion: 'OFICINA IZQ-G1',
      codInt: 'SC 93',
      producto: 'ROLLER SCREEN PREMIUM',
      color: 'BLANCO',
      categoria,
      modelo: {
        sistema: 'ROLLER',
        tipo_rol: 'ROL_SIMPLE',
        mecanismo: modeloMec,
        diametro_tubo_mm: 38,
        codigos_tubo: 'E02',
        dcto_tubo_cm: 1.8,
        suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 1.618, alto: 2.301, colorMecanismo: 'BCO' }],
    }) as unknown as Ventana;

  it('MEC legacy del modelo (MEC_05) + accesorios blancos → KIT [MEC 33], no el id del modelo', () => {
    const data = construirInventario([vjeffi('MEC_05_LZ90_BLANCO', 'ROL')]);
    expect(data.filas[0].codMecanismo).toBe('KIT SIMPLE BLANCO 38MM [MEC 33] BCO');
  });

  it('MEC_10 ovalada legacy resuelve al kit ovalada por color (MEC 39), no al id del modelo', () => {
    const data = construirInventario([
      vjeffi('MEC_10_OVALADA_BLANCO', 'ROL_MANUAL_CENEFA_OVALADA_38mm'),
    ]);
    expect(data.filas[0].codMecanismo).toBe('OVALADA BLANCO [MEC 39] BCO');
  });

  it('accesorios blancos → etiqueta blanca INS 95-1 (misma regla que Fase 4)', () => {
    const data = construirInventario([vjeffi('MEC_05_LZ90_BLANCO', 'ROL')]);
    expect(data.etiquetas).toEqual([{ cod: 'INS 95-1', color: 'BLANCA', cantidad: 1 }]);
  });
});

// Notas de terreno de Fase 2: retiro, material de instalación, cortes,
// suplementos, comentarios… antes se capturaban y no llegaban a NINGÚN
// documento; ahora salen en el bloque NOTAS DE TERRENO del inventario.
describe('notasTerreno', () => {
  it('concatena con rótulos solo los campos con contenido, una fila por paño', () => {
    const v1 = ventana('LIVING', 1.5, 2.0);
    const p = v1.panos![0] as Pano;
    p.retiro = 2;
    p.superficie = 'TECHO';
    p.materialTipo = 'CONCRETO';
    p.cortes = 'Plumavit';
    p.verVideo = true;
    p.relacionMarco = 'Dentro';
    p.cotizarConSin = 'con y sin cenefa';
    p.suplementos = 'alza 5 cm';
    p.comentarioFinal = 'ojo con el enchufe';
    const v2 = ventana('COCINA', 1.0, 1.0); // sin notas → no genera fila

    const notas = notasTerreno([v1, v2]);
    expect(notas).toHaveLength(1);
    expect(notas[0].ubic).toBe('LIVING');
    expect(notas[0].notas).toBe(
      'Retiro: 2 · Material: TECHO / CONCRETO · Cortes: Plumavit · ' +
        'Ver video de terreno · Marco: Dentro · Cotizar con y sin: con y sin cenefa · ' +
        'Suplementos: alza 5 cm · Nota: ojo con el enchufe',
    );
  });

  it("'Nada', 'N/A' y retiro 0 cuentan como sin nota (bloque omitido)", () => {
    const v = ventana('BAÑO', 1, 1);
    const p = v.panos![0] as Pano;
    p.retiro = 0;
    p.cortes = 'Nada';
    p.relacionMarco = 'N/A';
    expect(notasTerreno([v])).toEqual([]);
  });

  it('ventana multi-paño usa la ubicación por paño (-G1/-G2)', () => {
    const v = ventana('PZA 3', 1.2, 1.8);
    v.panos!.push({ ...(v.panos![0] as Pano) });
    (v.panos![1] as Pano).suplementos = 'perfil extra';
    const notas = notasTerreno([v]);
    expect(notas).toHaveLength(1);
    expect(notas[0].ubic).toBe('PZA 3-G2');
    expect(notas[0].notas).toBe('Suplementos: perfil extra');
  });

  it('construirInventario expone las notas para el bloque del PDF', () => {
    const v = ventana('OFICINA', 1.5, 2.4);
    (v.panos![0] as Pano).comentarioFinal = 'cliente pide instalar tarde';
    const d = construirInventario([v]);
    expect(d.notas).toEqual([
      { ubic: 'OFICINA', notas: 'Nota: cliente pide instalar tarde' },
    ]);
  });
});
